import { useState, useEffect, useRef, useCallback } from 'react';
import { transcribeAudio } from '../services/api';

const SPEECH_THRESHOLD = 18;
const CHECK_INTERVAL_MS = 120;
const MIN_SPEECH_MS = 600;
const MIN_TEXT_LENGTH = 8;

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  return null;
}

export function useAudioCapture({ onFinalTranscript, autoSendDelay = 1400 }) {
  const [isListening, setIsListening] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [statusHint, setStatusHint] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  const streamsRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const checkIntervalRef = useRef(null);
  const listeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const speechStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef(null);
  const processingRef = useRef(false);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    setIsSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined' &&
        !!getSupportedMimeType()
    );
  }, []);

  const cleanup = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;

    streamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    streamsRef.current = [];

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    chunksRef.current = [];
    isSpeakingRef.current = false;
    silenceStartedAtRef.current = null;
    listeningRef.current = false;
    setIsListening(false);
    setDisplayText('');
    setStatusHint('');
  }, []);

  const getAverageVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return data.reduce((sum, value) => sum + value, 0) / data.length;
  }, []);

  const processRecording = useCallback(async () => {
    if (processingRef.current || !chunksRef.current.length) return;

    processingRef.current = true;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    try {
      setStatusHint('Transcribing...');
      const text = await transcribeAudio(blob);
      if (text && text.length >= MIN_TEXT_LENGTH && onFinalTranscriptRef.current) {
        setDisplayText(text);
        await onFinalTranscriptRef.current(text);
        setDisplayText('');
      }
    } catch (err) {
      console.error('Audio transcription error:', err);
    } finally {
      processingRef.current = false;
      if (listeningRef.current) {
        setStatusHint('Listening...');
      }
    }
  }, []);

  const finishSpeechSegment = useCallback(() => {
    const duration = Date.now() - speechStartedAtRef.current;
    isSpeakingRef.current = false;
    silenceStartedAtRef.current = null;

    if (duration < MIN_SPEECH_MS) {
      chunksRef.current = [];
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      processRecording();
    }
  }, [processRecording]);

  const startSpeechSegment = useCallback(() => {
    isSpeakingRef.current = true;
    speechStartedAtRef.current = Date.now();
    silenceStartedAtRef.current = null;
    chunksRef.current = [];
    setDisplayText('Speech detected...');

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'inactive') {
      recorder.start(250);
    }
  }, []);

  const monitorAudio = useCallback(() => {
    const volume = getAverageVolume();
    const speaking = volume > SPEECH_THRESHOLD;

    if (speaking) {
      if (!isSpeakingRef.current) {
        startSpeechSegment();
      } else {
        silenceStartedAtRef.current = null;
      }
      return;
    }

    if (!isSpeakingRef.current) return;

    if (!silenceStartedAtRef.current) {
      silenceStartedAtRef.current = Date.now();
      return;
    }

    if (Date.now() - silenceStartedAtRef.current >= autoSendDelay) {
      finishSpeechSegment();
    }
  }, [autoSendDelay, finishSpeechSegment, getAverageVolume, startSpeechSegment]);

  const connectSource = useCallback((audioContext, stream, destination, analyser) => {
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(destination);
    source.connect(analyser);
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported || listeningRef.current) return;

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      alert('Audio recording is not supported in this browser.');
      return;
    }

    let micStream = null;
    let displayStream = null;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.warn('Microphone access unavailable:', err);
    }

    if (navigator.mediaDevices.getDisplayMedia) {
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          preferCurrentTab: false,
        });
      } catch (err) {
        console.warn('System/tab audio capture unavailable:', err);
      }
    }

    const hasMic = !!micStream?.getAudioTracks().length;
    const systemTracks = displayStream?.getAudioTracks() || [];
    const hasSystem = systemTracks.length > 0;

    if (!hasMic && !hasSystem) {
      micStream?.getTracks().forEach((track) => track.stop());
      displayStream?.getTracks().forEach((track) => track.stop());
      alert(
        'No audio source available. Allow microphone access and/or share a browser tab with "Share tab audio" enabled (YouTube, Google Meet, etc.).'
      );
      return;
    }

    if (displayStream) {
      displayStream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    const audioContext = new AudioContext();
    await audioContext.resume();

    const destination = audioContext.createMediaStreamDestination();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    if (hasMic) {
      connectSource(audioContext, micStream, destination, analyser);
      streamsRef.current.push(micStream);
    }

    if (hasSystem) {
      connectSource(
        audioContext,
        new MediaStream(systemTracks),
        destination,
        analyser
      );
      streamsRef.current.push(displayStream);
      systemTracks.forEach((track) => {
        track.onended = () => cleanup();
      });
    }

    if (displayStream && !hasSystem) {
      displayStream.getTracks().forEach((track) => track.stop());
    }

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 64000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      processRecording();
    };

    mediaRecorderRef.current = recorder;
    checkIntervalRef.current = setInterval(monitorAudio, CHECK_INTERVAL_MS);
    listeningRef.current = true;
    setIsListening(true);

    if (hasMic && hasSystem) {
      setStatusHint('Listening to microphone and system audio...');
    } else if (hasMic) {
      setStatusHint('Listening to microphone...');
    } else {
      setStatusHint('Listening to system audio...');
    }
  }, [cleanup, connectSource, isSupported, monitorAudio, processRecording]);

  const stopListening = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleListening = useCallback(() => {
    if (listeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setDisplayText('');
    setStatusHint(listeningRef.current ? 'Listening...' : '');
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isListening,
    isSupported,
    displayText: statusHint || displayText,
    toggleListening,
    stopListening,
    resetTranscript,
  };
}
