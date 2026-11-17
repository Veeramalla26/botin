import { useCallback, useEffect, useState } from 'react';

// Light/dark preference, shared by the main tab, the ?float=1 popout and the PiP panel.
const STORAGE_KEY = 'botin-theme';

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme, doc = document) {
  try {
    doc.documentElement.setAttribute('data-theme', theme);
  } catch {
    /* window may already be closed */
  }
}

export function applyStoredTheme() {
  applyTheme(readStoredTheme());
}

export function useTheme() {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keeps other windows (e.g. the popout panel) in sync when the theme changes elsewhere.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setTheme(e.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return { theme, toggleTheme };
}
