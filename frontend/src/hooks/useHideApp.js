import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'interviewBotHideApp';
const HIDDEN_TITLE = 'Untitled document - Google Docs';
const NORMAL_TITLE = 'Interview Bot';

export function useHideApp() {
  const [hideApp, setHideAppState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? false : stored === 'true';
    } catch {
      return false;
    }
  });

  const setHideApp = useCallback((value) => {
    setHideAppState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHideApp = useCallback(() => {
    setHideAppState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') {
        e.preventDefault();
        toggleHideApp();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleHideApp]);

  const isHidden = hideApp;

  useEffect(() => {
    document.title = isHidden ? HIDDEN_TITLE : NORMAL_TITLE;
    return () => {
      document.title = NORMAL_TITLE;
    };
  }, [isHidden]);

  useEffect(() => {
    try {
      if (typeof navigator.mediaDevices?.setCaptureHandleConfig === 'function') {
        const result = navigator.mediaDevices.setCaptureHandleConfig({
          handle: 'private-interview-assistant',
          exposeOrigin: false,
          permittedOrigins: [],
        });
        if (result && typeof result.catch === 'function') {
          result.catch(() => {});
        }
      }
    } catch {
      /* unsupported */
    }
  }, []);

  return {
    hideApp,
    setHideApp,
    toggleHideApp,
    isHidden,
  };
}
