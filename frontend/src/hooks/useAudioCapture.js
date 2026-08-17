import { useState, useEffect, useRef, useCallback } from 'react';
import { transcribeAudio } from '../services/api';

const MIC_ARM_THRESHOLD = 0.006;
const MIC_SPEECH_THRESHOLD = 0.011;
const SYSTEM_ARM_THRESHOLD = 0.005;
const SYSTEM_SPEECH_THRESHOLD = 0.008;
const CHECK_INTERVAL_MS = 40;
const MIN_SPEECH_MS = 550;
const MIN_TEXT_LENGTH = 3;
const SYSTEM_GAIN = 2.5;
const RECORDER_BITRATE = 64000;
const RECORDER_TIMESLICE_MS = 100;

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

function getRmsVolume(analyser) {
  if (!analyser) return 0;

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);

  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const sample = (data[i] - 128) / 128;
    sum += sample * sample;
  }

  return Math.sqrt(sum / data.length);
}


export function useAudioCapture({ onFinalTranscript, micSilenceDelay = 1100, systemSilenceDelay = 1300 }) {
  const [captureMode, setCaptureMode] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [statusHint, setStatusHint] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  const streamsRef = useRef([]);
  const audioContextRef = useRef(null);
  const activeAnalyserRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const segmentChunksRef = useRef([]);
  const checkIntervalRef = useRef(null);
  const modeRef = useRef('');
  const listeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const speechStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef(null);
  const processingRef = useRef(false);
  const skipProcessRef = useRef(false);
  const silenceDelayRef = useRef(micSilenceDelay);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const transcriptionQueueRef = useRef([]);

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

  const getThresholds = useCallback(() => {
    if (modeRef.current === 'system') {
      return { arm: SYSTEM_ARM_THRESHOLD, speech: SYSTEM_SPEECH_THRESHOLD };
    }
    return { arm: MIC_ARM_THRESHOLD, speech: MIC_SPEECH_THRESHOLD };
  }, []);

  const armRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'inactive') {
      segmentChunksRef.current = [];
      recorder.start(RECORDER_TIMESLICE_MS);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        skipProcessRef.current = true;
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

    activeAnalyserRef.current = null;
    segmentChunksRef.current = [];
    transcriptionQueueRef.current = [];
    isSpeakingRef.current = false;
    silenceStartedAtRef.current = null;
    listeningRef.current = false;
    modeRef.current = '';
    setCaptureMode('');
    setDisplayText('');
    setStatusHint('');
  }, []);

  const drainTranscriptionQueue = useCallback(async () => {
    if (processingRef.current) return;

    const webmBlob = transcriptionQueueRef.current.shift();
    if (!webmBlob) return;

    processingRef.current = true;

    try {
      setStatusHint('Transcribing...');
      const text = (await transcribeAudio(webmBlob, 'audio/webm')).trim();

      if (text.length >= MIN_TEXT_LENGTH && onFinalTranscriptRef.current) {
        setDisplayText(text);
        onFinalTranscriptRef.current(text);
        setDisplayText('');
      }
    } catch (err) {
      console.error('Audio transcription error:', err);
      setStatusHint('Transcription failed — still listening...');
    } finally {
      processingRef.current = false;
      if (transcriptionQueueRef.current.length) {
        drainTranscriptionQueue();
      } else if (listeningRef.current) {
        setStatusHint(
          modeRef.current === 'system'
            ? 'Listening to tab audio...'
            : 'Listening to microphone...'
        );
      }
    }
  }, []);

  const enqueueRecording = useCallback(() => {
    if (skipProcessRef.current) {
      skipProcessRef.current = false;
      segmentChunksRef.current = [];
      return;
    }

    if (!segmentChunksRef.current.length) return;

    const webmBlob = new Blob(segmentChunksRef.current, { type: 'audio/webm' });
    segmentChunksRef.current = [];

    if (webmBlob.size < 2000) return;

    transcriptionQueueRef.current.push(webmBlob);
    drainTranscriptionQueue();
  }, [drainTranscriptionQueue]);

  const finishSpeechSegment = useCallback(() => {
    const duration = Date.now() - speechStartedAtRef.current;
    isSpeakingRef.current = false;
    silenceStartedAtRef.current = null;

    if (duration < MIN_SPEECH_MS) {
      skipProcessRef.current = true;
      segmentChunksRef.current = [];
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startSpeechSegment = useCallback(() => {
    isSpeakingRef.current = true;
    if (!speechStartedAtRef.current) {
      speechStartedAtRef.current = Date.now();
    }
    silenceStartedAtRef.current = null;
    setDisplayText('Speech detected...');
    armRecorder();
  }, [armRecorder]);

  const monitorAudio = useCallback(() => {
    const level = getRmsVolume(activeAnalyserRef.current);
    if (!activeAnalyserRef.current) return;

    const { arm, speech } = getThresholds();

    if (level > arm) {
      armRecorder();
    }

    if (level > speech) {
      if (!isSpeakingRef.current) {
        speechStartedAtRef.current = Date.now();
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

    if (Date.now() - silenceStartedAtRef.current >= silenceDelayRef.current) {
      finishSpeechSegment();
    }
  }, [armRecorder, finishSpeechSegment, getThresholds, startSpeechSegment]);

  const connectStream = useCallback((audioContext, stream, destination, analyser, gainValue = 1) => {
    const source = audioContext.createMediaStreamSource(stream);
    const gain = audioContext.createGain();
    gain.gain.value = gainValue;
    source.connect(gain);
    gain.connect(destination);
    gain.connect(analyser);
  }, []);

  const beginCapture = useCallback(
    async (mode, stream, gainValue, statusMessage) => {
      const mimeType = getSupportedMimeType();
      const audioContext = new AudioContext({ sampleRate: 48000 });
      await audioContext.resume();

      const destination = audioContext.createMediaStreamDestination();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      connectStream(audioContext, stream, destination, analyser, gainValue);

      audioContextRef.current = audioContext;
      activeAnalyserRef.current = analyser;

      const recorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: RECORDER_BITRATE,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          segmentChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        enqueueRecording();
      };

      mediaRecorderRef.current = recorder;
      checkIntervalRef.current = setInterval(monitorAudio, CHECK_INTERVAL_MS);
      listeningRef.current = true;
      modeRef.current = mode;
      silenceDelayRef.current = mode === 'system' ? systemSilenceDelay : micSilenceDelay;
      setCaptureMode(mode);
      setStatusHint(statusMessage);
    },
    [connectStream, micSilenceDelay, monitorAudio, enqueueRecording, systemSilenceDelay]
  );

  const startMicListening = useCallback(async () => {
    if (!isSupported) return;
    if (listeningRef.current) {
      cleanup();
      if (modeRef.current === 'mic') return;
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      streamsRef.current.push(micStream);
      await beginCapture('mic', micStream, 1, 'Listening to microphone...');
    } catch (err) {
      console.error('Microphone error:', err);
      cleanup();
      alert('Microphone access denied. Allow microphone permission and try again.');
    }
  }, [beginCapture, cleanup, isSupported]);

  const startSystemListening = useCallback(async () => {
    if (!isSupported || !navigator.mediaDevices.getDisplayMedia) {
      alert('System/tab audio requires Chrome or Edge.');
      return;
    }

    if (listeningRef.current) {
      cleanup();
      if (modeRef.current === 'system') return;
    }

    let displayStream = null;

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false,
        },
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        systemAudio: 'include',
      });
    } catch (err) {
      console.warn('Tab audio capture cancelled:', err);
      return;
    }

    const audioTracks = displayStream.getAudioTracks();
    if (!audioTracks.length) {
      displayStream.getTracks().forEach((track) => track.stop());
      alert(
        'No tab audio detected.\n\nPick a Chrome tab (YouTube, Google Meet, etc.) and turn ON "Share tab audio" before clicking Share.'
      );
      return;
    }

    displayStream.getVideoTracks().forEach((track) => {
      track.enabled = false;
      track.onended = () => cleanup();
    });

    audioTracks.forEach((track) => {
      track.onended = () => cleanup();
    });

    streamsRef.current.push(displayStream);

    const systemStream = new MediaStream([...audioTracks]);

    await beginCapture(
      'system',
      systemStream,
      SYSTEM_GAIN,
      'Listening to tab audio (Meet, YouTube, etc.)...'
    );
  }, [beginCapture, cleanup, isSupported]);

  const stopListening = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMicListening = useCallback(() => {
    if (listeningRef.current && modeRef.current === 'mic') {
      stopListening();
    } else {
      startMicListening();
    }
  }, [startMicListening, stopListening]);

  const toggleSystemListening = useCallback(() => {
    if (listeningRef.current && modeRef.current === 'system') {
      stopListening();
    } else {
      startSystemListening();
    }
  }, [startSystemListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setDisplayText('');
    if (listeningRef.current) {
      setStatusHint(
        modeRef.current === 'system'
          ? 'Listening to tab audio...'
          : 'Listening to microphone...'
      );
    } else {
      setStatusHint('');
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isListening: captureMode !== '',
    isMicListening: captureMode === 'mic',
    isSystemListening: captureMode === 'system',
    captureMode,
    isSupported,
    displayText: statusHint || displayText,
    toggleMicListening,
    toggleSystemListening,
    stopListening,
    resetTranscript,
  };
}
