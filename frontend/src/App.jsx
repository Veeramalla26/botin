import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { auth, isFirebaseConfigured } from './firebase';
import AuthPage from './components/AuthPage';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useHideApp } from './hooks/useHideApp';
import { useFloatingPanel, useResponseSync, markExplicitPanelClose } from './hooks/useFloatingPanel';
import StealthOverlay from './components/StealthOverlay';
import FloatingResponsePanel from './components/FloatingResponsePanel';
import * as firestoreApi from './services/firestore';
import { streamChatResponse, buildHeading, parseResumeFile, RESUME_ACCEPT } from './services/api';
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

function SessionSetup({ user, onJoin, waitingForSync }) {
  const [company, setCompany] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onJoin(user.displayName || user.email, company.trim());
  };

  return (
    <div className="setup-overlay">
      <form className="setup-form" onSubmit={handleSubmit}>
        <h2>Start Interview Session</h2>
        <p className="auth-subtitle">Signed in as {user.displayName || user.email}</p>
        {waitingForSync && (
          <p className="auth-subtitle">Syncing with your other devices...</p>
        )}
        <input
          type="text"
          placeholder="Company (e.g. eBay)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <button type="submit">Start Session</button>
        <p className="auth-subtitle">
          This session syncs across all devices signed in with this account.
        </p>
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

function UserMenu({
  user,
  resumes,
  selectedResumeId,
  onSelectResume,
  onUploadResume,
  onDeleteResume,
  uploadingResume,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const [showResumeList, setShowResumeList] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowResumeList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId);
  const displayName = user.displayName || user.email;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOpen(true);
    await onUploadResume(file);
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        title="Account menu"
        aria-expanded={open}
      >
        <div className="avatar">👤</div>
        <span className="user-menu-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">{displayName}</div>

          <button
            type="button"
            className={`user-menu-item${showResumeList ? ' active' : ''}`}
            onClick={() => setShowResumeList((prev) => !prev)}
          >
            Select Resume
            {selectedResume ? `: ${selectedResume.name}` : ''}
          </button>

          {showResumeList && (
            <div className="resume-list">
              {resumes.length === 0 && (
                <div className="resume-list-empty">No resumes uploaded yet</div>
              )}
              {resumes.map((resume) => (
                <div key={resume.id} className="resume-list-row">
                  <button
                    type="button"
                    className={`resume-list-item${resume.id === selectedResumeId ? ' selected' : ''}`}
                    onClick={() => onSelectResume(resume.id)}
                  >
                    {resume.name}
                  </button>
                  <button
                    type="button"
                    className="resume-delete-btn"
                    onClick={() => onDeleteResume(resume.id)}
                    title="Delete resume"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="user-menu-item"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingResume}
          >
            {uploadingResume ? 'Uploading...' : 'Upload Resume (PDF, DOC, TXT)'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={RESUME_ACCEPT}
            className="hidden-file-input"
            onChange={handleFileChange}
          />

          <div className="user-menu-divider" />
          <button type="button" className="user-menu-item" onClick={onSignOut}>
            Logout
          </button>
        </div>
      )}
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

function FloatWindowApp() {
  const { remoteState } = useResponseSync(false);

  useEffect(() => {
    const onBeforeUnload = () => {
      markExplicitPanelClose();
      try {
        const channel = new BroadcastChannel('interview-bot-float-sync');
        channel.postMessage({ type: 'explicit-close' });
        channel.close();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <div className="app float-window">
      <FloatingResponsePanel
        responses={remoteState?.responses || []}
        streamingResponse={remoteState?.streamingResponse || null}
        loading={remoteState?.loading || false}
        isPopoutWindow
      />
    </div>
  );
}

export { FloatWindowApp };

const TAB_ID = `tab-${Math.random().toString(36).slice(2, 11)}`;

function loadCompletedStreamIds(sessionId) {
  try {
    const raw = sessionStorage.getItem(`botin-completed-${sessionId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function rememberCompletedStreamId(sessionId, streamId, completedSet) {
  completedSet.add(streamId);
  if (completedSet.size > 20) {
    const trimmed = new Set([...completedSet].slice(-20));
    completedSet.clear();
    trimmed.forEach((id) => completedSet.add(id));
  }
  try {
    sessionStorage.setItem(
      `botin-completed-${sessionId}`,
      JSON.stringify([...completedSet])
    );
  } catch {
    /* ignore quota errors */
  }
}

function isStaleOrphanDraft(draft) {
  if (draft.ownerTabId) return false;
  const updatedAt = draft.updatedAt?.toDate?.()?.getTime?.() ?? 0;
  return updatedAt > 0 && Date.now() - updatedAt > 120000;
}

export default function App() {
  const isPopout = new URLSearchParams(window.location.search).get('popout') === '1';
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [sessionResolving, setSessionResolving] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [notes, setNotes] = useState('');
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [streamingResponse, setStreamingResponse] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const notesTimerRef = useRef(null);
  const promptTimerRef = useRef(null);
  const draftTimerRef = useRef(null);
  const notesEditingRef = useRef(false);
  const promptEditingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const draftWriteGenRef = useRef(0);
  const completedStreamIdsRef = useRef(new Set());
  const prevSessionIdRef = useRef(null);
  const sessionRef = useRef(null);
  const loadingRef = useRef(false);
  const userRef = useRef(null);
  const resetTranscriptRef = useRef(() => {});
  const stopListeningRef = useRef(() => {});
  const responsesRef = useRef([]);
  const lastResponseRef = useRef(null);
  const selectedResumeIdRef = useRef(null);
  const resumesRef = useRef([]);

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    lastResponseRef.current = lastResponse;
  }, [lastResponse]);

  useEffect(() => {
    selectedResumeIdRef.current = selectedResumeId;
  }, [selectedResumeId]);

  useEffect(() => {
    resumesRef.current = resumes;
  }, [resumes]);

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
    if (!user) {
      setSessionResolving(false);
      return undefined;
    }

    setSessionResolving(true);
    let migrated = false;

    const unsub = firestoreApi.subscribeToActiveSession(user.uid, async (activeSession) => {
      if (activeSession) {
        setSession((prev) => (prev?.id === activeSession.id ? prev : activeSession));
        setSessionResolving(false);
        return;
      }

      if (!migrated) {
        migrated = true;
        const recent = await firestoreApi.getMostRecentSession(user.uid);
        if (recent) {
          await firestoreApi.setActiveSession(user.uid, recent.id);
          setSession(recent);
        } else {
          const sess = await firestoreApi.createSession(
            user.uid,
            user.displayName || user.email,
            ''
          );
          setSession(sess);
        }
      }
      setSessionResolving(false);
    });

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setResumes([]);
      setSelectedResumeId(null);
      return undefined;
    }

    const unsubResumes = firestoreApi.subscribeToResumes(user.uid, setResumes);
    const unsubSelected = firestoreApi.subscribeToSelectedResumeId(user.uid, setSelectedResumeId);

    return () => {
      unsubResumes();
      unsubSelected();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !resumes.length) return;
    if (selectedResumeId && resumes.some((r) => r.id === selectedResumeId)) return;
    if (selectedResumeId && !resumes.some((r) => r.id === selectedResumeId)) {
      firestoreApi.setSelectedResumeId(user.uid, null).catch(() => {});
    }
  }, [user, resumes, selectedResumeId]);

  useEffect(() => {
    if (!session?.id) return undefined;
    if (prevSessionIdRef.current === session.id) return undefined;
    prevSessionIdRef.current = session.id;

    setPrompt('');
    setNotes('');
    setStreamingResponse(null);
    setLoading(false);
    loadingRef.current = false;
    isGeneratingRef.current = false;
    setLastResponse(null);
    setResponses([]);
    completedStreamIdsRef.current = loadCompletedStreamIds(session.id);
  }, [session?.id]);

  useEffect(() => {
    if (!user || !session) return undefined;

    const unsubResponses = firestoreApi.subscribeToResponses(user.uid, session.id, (items) => {
      setResponses(items);
      if (items.length) setLastResponse(items[0]);
    });

    const unsubNotes = firestoreApi.subscribeToNotes(user.uid, session.id, (data) => {
      if (notesEditingRef.current) return;
      setNotes(data.content || '');
    });

    const unsubDraft = firestoreApi.subscribeToDraft(user.uid, session.id, (draft) => {
      if (!draft) {
        if (!isGeneratingRef.current) {
          setStreamingResponse(null);
          setLoading(false);
          loadingRef.current = false;
        }
        return;
      }

      // Local generation owns UI state while in progress.
      if (isGeneratingRef.current) return;

      const isOwnStaleDraft =
        draft.ownerTabId === TAB_ID ||
        (draft.streamId && completedStreamIdsRef.current.has(draft.streamId)) ||
        isStaleOrphanDraft(draft);

      if (isOwnStaleDraft) {
        firestoreApi.clearDraft(user.uid, session.id).catch(() => {});
        setStreamingResponse(null);
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      // Another device/tab is generating.
      setStreamingResponse({
        id: draft.streamId || 'remote-stream',
        heading: draft.heading,
        response: draft.response || '',
        mode: draft.mode,
        prompt: draft.prompt,
      });
      setLoading(true);
      loadingRef.current = true;
    });

    const unsubUi = firestoreApi.subscribeToUiState(user.uid, session.id, (state) => {
      if (promptEditingRef.current) return;
      if (state.prompt !== undefined) setPrompt(state.prompt);
    });

    return () => {
      unsubResponses();
      unsubNotes();
      unsubDraft();
      unsubUi();
    };
  }, [user, session]);

  const handlePromptKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (!loadingRef.current && !isGeneratingRef.current && prompt.trim()) {
      handleGenerate('send');
    }
  };

  const handleJoin = async (userName, company) => {
    const existing = await firestoreApi.getActiveSession(user.uid);
    if (existing) {
      setSession(existing);
      return;
    }
    const sess = await firestoreApi.createSession(user.uid, userName, company);
    setSession(sess);
  };

  const syncPromptRemote = useCallback((value) => {
    if (!userRef.current || !sessionRef.current) return;
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => {
      firestoreApi.saveUiState(userRef.current.uid, sessionRef.current.id, { prompt: value }).catch(() => {});
      promptEditingRef.current = false;
    }, 200);
  }, []);

  const syncDraftRemote = useCallback((draft, writeGen) => {
    if (!userRef.current || !sessionRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (writeGen !== draftWriteGenRef.current) return;
      if (!isGeneratingRef.current) return;
      firestoreApi.saveDraft(userRef.current.uid, sessionRef.current.id, draft).catch(() => {});
    }, 150);
  }, []);

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
    let text = (overridePrompt ?? prompt).trim();
    if (!text && mode === 'resume') {
      text = 'Tell me about yourself';
    }
    if ((!text && !questionText) || !sessionRef.current || !userRef.current) return;
    if (loadingRef.current || isGeneratingRef.current) return;

    const heading = buildHeading(text, mode, questionText);
    const streamId = `stream-${Date.now()}`;
    draftWriteGenRef.current += 1;
    const writeGen = draftWriteGenRef.current;
    const draftBase = {
      streamId,
      ownerTabId: TAB_ID,
      heading,
      response: '',
      mode,
      prompt: text || questionText,
    };

    isGeneratingRef.current = true;
    loadingRef.current = true;
    setLoading(true);
    setStreamingResponse({
      id: streamId,
      heading,
      response: '',
      mode,
      prompt: text || questionText,
    });
    firestoreApi.saveDraft(userRef.current.uid, sessionRef.current.id, draftBase).catch(() => {});

    try {
      const conversationHistory = buildConversationHistory();
      const activeResume = resumesRef.current.find((r) => r.id === selectedResumeIdRef.current);
      const resumeText = activeResume?.extractedText || undefined;

      const responseText = await streamChatResponse(
        {
          prompt: text,
          mode,
          questionText,
          previousResponse: mode === 'elaborate' ? lastResponse?.response : undefined,
          conversationHistory: mode === 'elaborate' ? undefined : conversationHistory,
          resumeText,
        },
        (partial) => {
          setStreamingResponse((prev) =>
            prev?.id === streamId ? { ...prev, response: partial } : prev
          );
          syncDraftRemote({ ...draftBase, response: partial }, writeGen);
        }
      );

      const saved = await firestoreApi.saveResponse(userRef.current.uid, sessionRef.current.id, {
        prompt: text || questionText,
        response: responseText,
        mode,
        heading,
      });

      setLastResponse(saved);
      if (!overridePrompt) {
        setPrompt('');
        firestoreApi.saveUiState(userRef.current.uid, sessionRef.current.id, { prompt: '' }).catch(() => {});
      }
      resetTranscriptRef.current();
      firestoreApi.updateSessionTimestamp(userRef.current.uid, sessionRef.current.id).catch(() => {});
    } catch (err) {
      alert(err.message);
    } finally {
      draftWriteGenRef.current += 1;
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }

      completedStreamIdsRef.current.add(streamId);
      if (completedStreamIdsRef.current.size > 20) {
        completedStreamIdsRef.current = new Set([...completedStreamIdsRef.current].slice(-20));
      }
      if (sessionRef.current?.id) {
        rememberCompletedStreamId(sessionRef.current.id, streamId, completedStreamIdsRef.current);
      }

      isGeneratingRef.current = false;
      loadingRef.current = false;
      setStreamingResponse(null);
      setLoading(false);

      const uid = userRef.current?.uid;
      const sid = sessionRef.current?.id;
      if (uid && sid) {
        try {
          await firestoreApi.clearDraft(uid, sid);
        } catch {
          /* draft may not exist */
        }
      }
    }
  };

  const handleVoiceTranscript = useCallback(async (text) => {
    if (!sessionRef.current || !userRef.current) return;

    const cleaned = text.trim();
    if (cleaned.length < 3) return;

    setPrompt(cleaned);
    promptEditingRef.current = true;
    syncPromptRemote(cleaned);

    if (loadingRef.current) {
      return;
    }

    handleGenerate('send', cleaned);
  }, [syncPromptRemote]);

  const {
    hideApp,
    toggleHideApp,
    isHidden,
  } = useHideApp();

  const getSyncPayload = useCallback(
    () => ({ responses, streamingResponse, loading }),
    [responses, streamingResponse, loading]
  );

  const { broadcast } = useResponseSync(true, getSyncPayload);

  const {
    isOpen: isFloatOpen,
    isMinimized: isFloatMinimized,
    openPanel: openFloatPanel,
    closePanel: closeFloatPanel,
    setPanelMinimized,
    renderInPanel,
    pipWindow,
  } = useFloatingPanel({ enabled: !isPopout });

  useEffect(() => {
    broadcast({ responses, streamingResponse, loading });
  }, [responses, streamingResponse, loading, broadcast]);

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
    micSilenceDelay: 650,
    systemSilenceDelay: 800,
  });

  resetTranscriptRef.current = resetTranscript;
  stopListeningRef.current = stopListening;

  useEffect(() => {
    if (isListening && voiceDisplayText) {
      setPrompt(voiceDisplayText);
      promptEditingRef.current = true;
      syncPromptRemote(voiceDisplayText);
    }
  }, [voiceDisplayText, isListening, syncPromptRemote]);

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
    notesEditingRef.current = true;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      if (session && user) {
        firestoreApi.saveNotes(user.uid, session.id, value).finally(() => {
          notesEditingRef.current = false;
        });
      } else {
        notesEditingRef.current = false;
      }
    }, 400);
  };

  const handlePromptChange = (value) => {
    setPrompt(value);
    promptEditingRef.current = true;
    syncPromptRemote(value);
  };

  const handlePromptReset = () => {
    setPrompt('');
    resetTranscript();
    promptEditingRef.current = true;
    syncPromptRemote('');
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
    prevSessionIdRef.current = null;
    setSession(null);
    setResponses([]);
    setNotes('');
    setPrompt('');
    setResumes([]);
    setSelectedResumeId(null);
  };

  const handleSelectResume = async (resumeId) => {
    if (!user) return;
    const nextId = selectedResumeId === resumeId ? null : resumeId;
    await firestoreApi.setSelectedResumeId(user.uid, nextId);
  };

  const handleUploadResume = async (file) => {
    if (!user) return;
    setUploadingResume(true);
    try {
      const extractedText = await parseResumeFile(file);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const saved = await firestoreApi.saveResume(user.uid, {
        name: baseName,
        fileName: file.name,
        extractedText,
      });
      await firestoreApi.setSelectedResumeId(user.uid, saved.id);
    } catch (err) {
      alert(err.message || 'Failed to upload resume');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = async (resumeId) => {
    if (!user) return;
    const resume = resumes.find((r) => r.id === resumeId);
    const label = resume?.name || 'this resume';
    if (!confirm(`Delete "${label}"?`)) return;
    await firestoreApi.deleteResume(user.uid, resumeId);
    if (selectedResumeId === resumeId) {
      await firestoreApi.setSelectedResumeId(user.uid, null);
    }
  };

  if (!isFirebaseConfigured()) return <ConfigMissing />;
  if (!authReady) return <div className="setup-overlay"><div className="setup-form"><p>Loading...</p></div></div>;
  if (!user) return <AuthPage onAuthSuccess={() => {}} />;
  if (sessionResolving) {
    return (
      <div className="setup-overlay">
        <div className="setup-form"><p>Syncing session...</p></div>
      </div>
    );
  }
  if (!session) {
    return (
      <SessionSetup
        user={user}
        onJoin={handleJoin}
        waitingForSync
      />
    );
  }

  const sessionLabel = session.company
    ? `${session.company} - ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')}`
    : new Date().toLocaleDateString();

  const activeResume = resumes.find((r) => r.id === selectedResumeId);

  return (
    <div className={`app${isPopout ? ' popout' : ''}${isHidden ? ' app-hidden' : ''}`}>
      {isHidden && <StealthOverlay />}
      {renderInPanel(
        <FloatingResponsePanel
          responses={responses}
          streamingResponse={streamingResponse}
          loading={loading}
          isMinimized={isFloatMinimized}
          onSetMinimized={setPanelMinimized}
          onClose={closeFloatPanel}
          dragWindow={pipWindow}
        />
      )}
      {!isHidden && (
        <>
      <header className="header">
        <div className="header-left">
          <h1>{isPopout ? 'Notes' : 'Interview Bot'}</h1>
          <span className="session-info">
            Session joined: {session.userName}
            {activeResume ? ` · Resume: ${activeResume.name}` : ''}
          </span>
        </div>
        <div className="header-right">
          <button
            className={`voice-btn ${hideApp ? 'stealth-active' : ''}`}
            onClick={toggleHideApp}
            title={
              hideApp
                ? 'Hide App is ON — tab looks like Google Docs (safe for screen share). Click or Ctrl+Shift+H to show app.'
                : 'Hide App is OFF — click or Ctrl+Shift+H to disguise tab as Google Docs during screen share'
            }
          >
            {hideApp ? '📄 Hide App: ON' : '📄 Hide App: OFF'}
          </button>
          {!isPopout && (
            <button
              className={`voice-btn ${isFloatOpen ? 'float-active' : ''}`}
              onClick={isFloatOpen ? closeFloatPanel : openFloatPanel}
              title="Floating panel — stays visible over Meet and other tabs"
            >
              {isFloatOpen ? '✕ Close Panel' : '▣ Response Panel'}
            </button>
          )}
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
          <UserMenu
            user={user}
            resumes={resumes}
            selectedResumeId={selectedResumeId}
            onSelectResume={handleSelectResume}
            onUploadResume={handleUploadResume}
            onDeleteResume={handleDeleteResume}
            uploadingResume={uploadingResume}
            onSignOut={handleSignOut}
          />
        </div>
      </header>

      <main className="main">
        <div className="left-panel">
          <section className="prompt-section">
            <label>Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder="Type your prompt here or use voice detection..."
              rows={5}
            />
            <div className="button-grid">
              <button className="btn reset" onClick={handlePromptReset}>Reset</button>
              <button className="btn clear" onClick={handlePromptReset}>Clear</button>
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
        </>
      )}
    </div>
  );
}
