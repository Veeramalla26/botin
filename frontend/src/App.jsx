import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { auth, isFirebaseConfigured } from './firebase';
import AuthPage from './components/AuthPage';
import { useAudioCapture } from './hooks/useAudioCapture';
import * as firestoreApi from './services/firestore';
import { streamChatResponse, buildHeading } from './services/api';
import { FIXED_QUESTIONS } from './data/fixedQuestions';
import './App.css';

function ConfigMissing() {
  return (
    <div className="setup-overlay">
      <div className="setup-form">
        <h2>Firebase Not Configured</h2>
        <p className="auth-subtitle">
          Copy <code>frontend/.env.example</code> to <code>frontend/.env</code> and add your Firebase project keys.
        </p>
      </div>
    </div>
  );
}

function SessionSetup({ user, onJoin }) {
  const [company, setCompany] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onJoin(user.displayName || user.email, company.trim());
  };

  return (
    <div className="setup-overlay">
      <form className="setup-form" onSubmit={handleSubmit}>
        <h2>Join Interview Session</h2>
        <p className="auth-subtitle">Signed in as {user.displayName || user.email}</p>
        <input
          type="text"
          placeholder="Company (e.g. eBay)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <button type="submit">Join Session</button>
      </form>
    </div>
  );
}

function FixedQuestionModal({ questions, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Select Fixed Question</h3>
        <div className="question-list">
          {questions.map((q) => (
            <button key={q.id} className="question-item" onClick={() => onSelect(q)}>
              <span className="q-num">{q.question_number}.</span> {q.question_text}
            </button>
          ))}
        </div>
        <button className="btn-close-modal" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const markdownComponents = {
  strong: ({ children }) => <strong className="keyword">{children}</strong>,
  p: ({ children }) => <p className="response-paragraph">{children}</p>,
};

function ResponseItem({ item, onDelete, onAddToNotes, onCopy, isStreaming = false }) {
  return (
    <div className={`response-item${isStreaming ? ' streaming' : ''}`}>
      <div className="response-heading">{item.heading || item.prompt}</div>
      <div className="response-body">
        {item.response ? (
          <ReactMarkdown components={markdownComponents}>{item.response}</ReactMarkdown>
        ) : isStreaming ? (
          <span className="streaming-placeholder">Generating answer...</span>
        ) : null}
        {isStreaming && item.response && <span className="streaming-cursor" aria-hidden="true" />}
      </div>
      {!isStreaming && (
        <div className="response-actions">
          <button className="icon-btn delete" onClick={() => onDelete(item.id)} title="Delete">🗑</button>
          <button className="icon-btn add" onClick={() => onAddToNotes(item.response)} title="Add to Notes">+</button>
          <button className="icon-btn copy" onClick={() => onCopy(item.response)} title="Copy">📋</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [notes, setNotes] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [streamingResponse, setStreamingResponse] = useState(null);
  const notesTimerRef = useRef(null);
  const sessionRef = useRef(null);
  const loadingRef = useRef(false);
  const userRef = useRef(null);
  const resetTranscriptRef = useRef(() => {});
  const stopListeningRef = useRef(() => {});
  const responsesRef = useRef([]);
  const lastResponseRef = useRef(null);

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    lastResponseRef.current = lastResponse;
  }, [lastResponse]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthReady(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !session) return undefined;

    const unsub = firestoreApi.subscribeToResponses(user.uid, session.id, (items) => {
      setResponses(items);
      if (items.length) setLastResponse(items[0]);
    });

    firestoreApi.getNotes(user.uid, session.id).then((data) => {
      setNotes(data.content || '');
    });

    return unsub;
  }, [user, session]);

  const handlePromptKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (!loading && prompt.trim()) {
      handleGenerate('send');
    }
  };

  const handleJoin = async (userName, company) => {
    const sess = await firestoreApi.createSession(user.uid, userName, company);
    setSession(sess);
  };

  const buildConversationHistory = () => {
    const turns = [];
    const seen = new Set();

    const last = lastResponseRef.current;
    if (last?.response && (last.prompt || last.heading)) {
      turns.push({
        prompt: last.prompt || last.heading,
        response: last.response.slice(0, 1000),
      });
      seen.add(last.id);
    }

    for (const item of responsesRef.current) {
      if (seen.has(item.id) || turns.length >= 3) continue;
      if (item.response && (item.prompt || item.heading)) {
        turns.push({
          prompt: item.prompt || item.heading,
          response: item.response.slice(0, 1000),
        });
        seen.add(item.id);
      }
    }

    return turns.reverse();
  };

  const handleGenerate = async (mode, overridePrompt, questionText) => {
    const text = (overridePrompt ?? prompt).trim();
    if ((!text && !questionText) || !sessionRef.current || !userRef.current || loadingRef.current) return;

    const heading = buildHeading(text, mode, questionText);
    const streamId = `stream-${Date.now()}`;

    setLoading(true);
    setStreamingResponse({
      id: streamId,
      heading,
      response: '',
      mode,
      prompt: text || questionText,
    });

    try {
      const conversationHistory = buildConversationHistory();

      const responseText = await streamChatResponse(
        {
          prompt: text,
          mode,
          questionText,
          previousResponse: mode === 'elaborate' ? lastResponse?.response : undefined,
          conversationHistory: mode === 'elaborate' ? undefined : conversationHistory,
        },
        (partial) => {
          setStreamingResponse((prev) =>
            prev?.id === streamId ? { ...prev, response: partial } : prev
          );
        }
      );

      const saved = await firestoreApi.saveResponse(userRef.current.uid, sessionRef.current.id, {
        prompt: text || questionText,
        response: responseText,
        mode,
        heading,
      });

      setLastResponse(saved);
      if (!overridePrompt) setPrompt('');
      resetTranscriptRef.current();
      firestoreApi.updateSessionTimestamp(userRef.current.uid, sessionRef.current.id).catch(() => {});
    } catch (err) {
      alert(err.message);
    } finally {
      setStreamingResponse(null);
      setLoading(false);
    }
  };

  const handleVoiceTranscript = useCallback(async (text) => {
    if (!sessionRef.current || !userRef.current) return;

    const cleaned = text.trim();
    if (cleaned.length < 3) return;

    setPrompt(cleaned);

    if (loadingRef.current) {
      return;
    }

    handleGenerate('send', cleaned);
  }, [lastResponse]);

  const {
    isListening,
    isMicListening,
    isSystemListening,
    displayText: voiceDisplayText,
    toggleMicListening,
    toggleSystemListening,
    stopListening,
    resetTranscript,
  } = useAudioCapture({
    onFinalTranscript: handleVoiceTranscript,
    micSilenceDelay: 900,
    systemSilenceDelay: 1100,
  });

  resetTranscriptRef.current = resetTranscript;
  stopListeningRef.current = stopListening;

  useEffect(() => {
    if (isListening && voiceDisplayText) {
      setPrompt(voiceDisplayText);
    }
  }, [voiceDisplayText, isListening]);

  useEffect(() => () => stopListeningRef.current(), []);

  const handleFixedQuestion = async (question) => {
    setShowFixedModal(false);
    const questionText = `${question.question_number}. ${question.question_text}`;
    await handleGenerate('fixed_question', '', questionText);
  };

  const handleRegenerate = async () => {
    if (!lastResponse) return;
    await handleGenerate(lastResponse.mode, lastResponse.prompt);
  };

  const handleNotesChange = (value) => {
    setNotes(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      if (session && user) firestoreApi.saveNotes(user.uid, session.id, value);
    }, 1000);
  };

  const handleAddToNotes = (text) => {
    handleNotesChange(notes ? `${notes}\n\n${text}` : text);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleDeleteResponse = async (id) => {
    if (!user || !session) return;
    await firestoreApi.deleteResponse(user.uid, session.id, id);
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all responses?') || !user || !session) return;
    await firestoreApi.clearResponses(user.uid, session.id);
    setLastResponse(null);
  };

  const handleSignOut = async () => {
    stopListeningRef.current();
    await signOut(auth);
    setSession(null);
    setResponses([]);
    setNotes('');
    setPrompt('');
  };

  if (!isFirebaseConfigured()) return <ConfigMissing />;
  if (!authReady) return <div className="setup-overlay"><div className="setup-form"><p>Loading...</p></div></div>;
  if (!user) return <AuthPage onAuthSuccess={() => {}} />;
  if (!session) return <SessionSetup user={user} onJoin={handleJoin} />;

  const sessionLabel = session.company
    ? `${session.company} - ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')}`
    : new Date().toLocaleDateString();

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>Interview Bot</h1>
          <span className="session-info">Session joined: {session.userName}</span>
        </div>
        <div className="header-right">
          <button
            className={`voice-btn ${isMicListening ? 'active' : ''}`}
            onClick={toggleMicListening}
            title={isMicListening ? 'Stop microphone' : 'Listen to your microphone'}
          >
            {isMicListening ? '🔴 Listening' : '🎤 Listen'}
          </button>
          <button
            className={`voice-btn meet-btn ${isSystemListening ? 'active' : ''}`}
            onClick={toggleSystemListening}
            title={
              isSystemListening
                ? 'Stop tab audio'
                : 'Capture tab audio — share YouTube, Google Meet, etc. with "Share tab audio" on'
            }
          >
            {isSystemListening ? '🔴 System Listen' : '🔊 System Listen'}
          </button>
          <button className="voice-btn" onClick={handleSignOut} title="Sign out">Sign Out</button>
          <div className="avatar">👤</div>
        </div>
      </header>

      <main className="main">
        <div className="left-panel">
          <section className="prompt-section">
            <label>Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder="Type your prompt here or use voice detection..."
              rows={5}
            />
            <div className="button-grid">
              <button className="btn reset" onClick={() => { setPrompt(''); resetTranscript(); }}>Reset</button>
              <button className="btn clear" onClick={() => { setPrompt(''); resetTranscript(); }}>Clear</button>
              <button className="btn send" onClick={() => handleGenerate('send')} disabled={loading}>
                {loading ? 'Generating...' : 'Send'}
              </button>
              <button className="btn elaborate" onClick={() => handleGenerate('elaborate')} disabled={loading}>Elaborate</button>
              <button className="btn resume" onClick={() => handleGenerate('resume')} disabled={loading}>Resume</button>
              <button className="btn fixed" onClick={() => setShowFixedModal(true)} disabled={loading}>Fixed Question</button>
              <button className="btn system-design" onClick={() => handleGenerate('system_design')} disabled={loading}>System Design</button>
              <button className="btn brief" onClick={() => handleGenerate('brief')} disabled={loading}>Brief</button>
              <button className="btn code" onClick={() => handleGenerate('code')} disabled={loading}>Code</button>
            </div>
            <div className="session-label">{sessionLabel}</div>
          </section>

          <section className="notes-section">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Type notes here"
              rows={3}
            />
          </section>
        </div>

        <div className="right-panel">
          <label>Response</label>
          <div className="response-feed">
            {responses.length === 0 && !streamingResponse && (
              <div className="empty-state">
                {isSystemListening
                  ? 'System Listen is active — tab audio from Google Meet / YouTube is transcribed when speech pauses.'
                  : isMicListening
                    ? 'Listen is active — speak into your microphone. Response is generated automatically after a short pause.'
                    : 'Click Listen for microphone, or System Listen and share a tab with audio enabled (Google Meet, YouTube, etc.).'}
              </div>
            )}
            {streamingResponse && (
              <ResponseItem
                key={streamingResponse.id}
                item={streamingResponse}
                isStreaming
              />
            )}
            {responses.map((item) => (
              <ResponseItem
                key={item.id}
                item={item}
                onDelete={handleDeleteResponse}
                onAddToNotes={handleAddToNotes}
                onCopy={handleCopy}
              />
            ))}
          </div>
          <div className="response-footer">
            <button className="btn regenerate" onClick={handleRegenerate} disabled={loading || !lastResponse}>
              Regenerate
            </button>
            <button className="btn clear-all" onClick={handleClearAll}>Clear All Responses</button>
          </div>
        </div>
      </main>

      {showFixedModal && (
        <FixedQuestionModal
          questions={FIXED_QUESTIONS}
          onSelect={handleFixedQuestion}
          onClose={() => setShowFixedModal(false)}
        />
      )}
    </div>
  );
}
