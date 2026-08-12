import { useState, useEffect, useRef, useCallback } from 'react';

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export function useVoiceRecognition({ onFinalTranscript, autoSendDelay = 2000 }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const accumulatedRef = useRef('');
  const listeningRef = useRef(false);

  useEffect(() => {
    listeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    setIsSupported(!!SpeechRecognition);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const text = accumulatedRef.current.trim();
      if (text && onFinalTranscript) {
        onFinalTranscript(text);
        accumulatedRef.current = '';
        setTranscript('');
        setInterimTranscript('');
      }
    }, autoSendDelay);
  }, [autoSendDelay, onFinalTranscript, clearSilenceTimer]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + final.trim();
        setTranscript(accumulatedRef.current);
        startSilenceTimer();
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start recognition:', err);
      listeningRef.current = false;
    }
  }, [startSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    listeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [clearSilenceTimer]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      accumulatedRef.current = '';
      setTranscript('');
      setInterimTranscript('');
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  const displayText = transcript + (interimTranscript ? ' ' + interimTranscript : '');

  return {
    isListening,
    isSupported,
    displayText,
    transcript: accumulatedRef.current,
    toggleListening,
    stopListening,
    resetTranscript,
  };
}
