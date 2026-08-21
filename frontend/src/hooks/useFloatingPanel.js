import { useState, useEffect, useCallback, useRef } from 'react';

import { createPortal } from 'react-dom';



export const CHANNEL_NAME = 'interview-bot-float-sync';

export const EXPLICIT_CLOSE_STORAGE_KEY = 'interview-bot-float-explicit-close';

/** Shared via localStorage so main window and float popout can read the same flag. */
export function markExplicitPanelClose() {
  try {
    localStorage.setItem(EXPLICIT_CLOSE_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearExplicitPanelCloseFlag() {
  try {
    localStorage.removeItem(EXPLICIT_CLOSE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function consumeExplicitPanelCloseFlag() {
  try {
    if (localStorage.getItem(EXPLICIT_CLOSE_STORAGE_KEY)) {
      localStorage.removeItem(EXPLICIT_CLOSE_STORAGE_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function isExplicitPanelClosePending() {
  try {
    return Boolean(localStorage.getItem(EXPLICIT_CLOSE_STORAGE_KEY));
  } catch {
    return false;
  }
}

export const PANEL_WIDTH = 380;

export const PANEL_HEIGHT = 520;

export const PANEL_MIN_WIDTH = 300;

/** Inner chrome bar height */

export const PANEL_CHROME_HEIGHT = 36;

/** @deprecated use PANEL_CHROME_HEIGHT */

export const PANEL_MIN_HEIGHT = PANEL_CHROME_HEIGHT;

/** Popout outer height when minimized */

export const POPOUT_MIN_HEIGHT = 100;

/** PiP window height when minimized */

export const PIP_MIN_HEIGHT = 44;



export function useResponseSync(isMainWindow, getPayload) {

  const [remoteState, setRemoteState] = useState(null);

  const channelRef = useRef(null);

  const getPayloadRef = useRef(getPayload);



  useEffect(() => {

    getPayloadRef.current = getPayload;

  }, [getPayload]);



  useEffect(() => {

    if (typeof BroadcastChannel === 'undefined') return undefined;



    const channel = new BroadcastChannel(CHANNEL_NAME);

    channelRef.current = channel;



    channel.onmessage = (event) => {

      if (event.data?.type === 'sync' && !isMainWindow) {

        setRemoteState(event.data.payload);

      }

      if (event.data?.type === 'request-sync' && isMainWindow && getPayloadRef.current) {

        channel.postMessage({ type: 'sync', payload: getPayloadRef.current() });

      }

    };



    if (!isMainWindow) {

      channel.postMessage({ type: 'request-sync' });

    }



    return () => {

      channel.close();

      channelRef.current = null;

    };

  }, [isMainWindow]);



  const broadcast = useCallback((payload) => {

    channelRef.current?.postMessage({ type: 'sync', payload });

  }, []);



  return { remoteState, broadcast };

}



function copyStyles(sourceDoc, targetDoc) {

  [...sourceDoc.styleSheets].forEach((sheet) => {

    try {

      if (sheet.href) {

        const link = targetDoc.createElement('link');

        link.rel = 'stylesheet';

        link.href = sheet.href;

        targetDoc.head.appendChild(link);

        return;

      }

      const rules = sheet.cssRules;

      if (!rules) return;

      const style = targetDoc.createElement('style');

      [...rules].forEach((rule) => {

        style.appendChild(targetDoc.createTextNode(rule.cssText));

      });

      targetDoc.head.appendChild(style);

    } catch {

      if (sheet.href) {

        const link = targetDoc.createElement('link');

        link.rel = 'stylesheet';

        link.href = sheet.href;

        targetDoc.head.appendChild(link);

      }

    }

  });

}



export function openFloatPopout() {

  const left = Math.max(0, window.screen.availWidth - PANEL_WIDTH - 24);

  const top = Math.max(0, window.screen.availHeight - PANEL_HEIGHT - 48);

  const url = `${window.location.origin}${window.location.pathname}?float=1`;



  return window.open(

    url,

    'InterviewBotFloat',

    [

      'popup=yes',

      `width=${PANEL_WIDTH}`,

      `height=${PANEL_HEIGHT}`,

      `left=${left}`,

      `top=${top}`,

      'menubar=no',

      'toolbar=no',

      'location=no',

      'status=no',

      'scrollbars=yes',

      'resizable=yes',

    ].join(',')

  );

}



function resizePanelWindow(targetWindow, minimized, isPopout) {

  if (!targetWindow || targetWindow.closed) return;

  try {

    if (minimized) {

      targetWindow.resizeTo(

        PANEL_MIN_WIDTH,

        isPopout ? POPOUT_MIN_HEIGHT : PIP_MIN_HEIGHT

      );

    } else {

      targetWindow.resizeTo(PANEL_WIDTH, PANEL_HEIGHT);

    }

  } catch {

    /* resize may be blocked in some contexts */

  }

}



export function useFloatingPanel({ enabled = true } = {}) {

  const [pipWindow, setPipWindow] = useState(null);

  const [isOpen, setIsOpen] = useState(false);

  const [usePopout, setUsePopout] = useState(false);

  const [isMinimized, setIsMinimized] = useState(false);

  const panelWindowRef = useRef(null);

  const popoutRef = useRef(null);

  const explicitCloseRef = useRef(false);

  const userClosedPanelRef = useRef(false);

  const reopenTimerRef = useRef(null);

  const reopenAttemptsRef = useRef(0);

  const allowPopoutCleanupRef = useRef(false);

  const openPanelRef = useRef(null);

  const closePanelRef = useRef(null);

  const openingPanelRef = useRef(false);

  const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;



  const setPanelMinimized = useCallback(

    (minimized) => {

      setIsMinimized(minimized);

      if (panelWindowRef.current) {

        resizePanelWindow(panelWindowRef.current, minimized, usePopout);

      }

    },

    [usePopout]

  );



  const clearReopenTimer = useCallback(() => {

    if (reopenTimerRef.current) {

      clearTimeout(reopenTimerRef.current);

      reopenTimerRef.current = null;

    }

  }, []);



  const closePanel = useCallback(() => {

    userClosedPanelRef.current = true;

    explicitCloseRef.current = true;

    markExplicitPanelClose();

    clearReopenTimer();

    const hadOpenWindow =

      (panelWindowRef.current && !panelWindowRef.current.closed) ||

      (popoutRef.current && !popoutRef.current.closed);



    if (panelWindowRef.current && !panelWindowRef.current.closed) {

      panelWindowRef.current.close();

    }

    if (popoutRef.current && !popoutRef.current.closed) {

      popoutRef.current.close();

    }

    panelWindowRef.current = null;

    popoutRef.current = null;

    setPipWindow(null);

    setIsOpen(false);

    setUsePopout(false);

    setIsMinimized(false);

    reopenAttemptsRef.current = 0;

    if (!hadOpenWindow) {

      explicitCloseRef.current = false;

    }

  }, [clearReopenTimer]);



  const openPipWindow = useCallback(async () => {

    const w = await window.documentPictureInPicture.requestWindow({

      width: PANEL_WIDTH,

      height: PANEL_HEIGHT,

    });

    w.document.body.style.visibility = 'hidden';

    w.document.body.style.opacity = '0';

    copyStyles(document, w.document);

    w.document.body.classList.add('float-panel-body');

    w.document.body.style.margin = '0';

    w.document.body.style.padding = '0';

    w.document.body.style.background = 'transparent';

    w.document.body.style.overflow = 'hidden';

    w.document.body.tabIndex = -1;

    try {

      w.focus();

    } catch {

      /* ignore */

    }

    const onPipKeyDown = (e) => {
      if (!e.ctrlKey || !e.shiftKey || e.code !== 'KeyP') return;
      e.preventDefault();
      closePanelRef.current?.();
    };

    w.addEventListener('keydown', onPipKeyDown);



    w.addEventListener('pagehide', () => {

      w.removeEventListener('keydown', onPipKeyDown);

      panelWindowRef.current = null;

      setPipWindow(null);

      setIsMinimized(false);

      const wasExplicitClose =

        userClosedPanelRef.current ||

        explicitCloseRef.current ||

        consumeExplicitPanelCloseFlag() ||

        isExplicitPanelClosePending();



      if (wasExplicitClose) {

        clearExplicitPanelCloseFlag();

        setIsOpen(false);

        setUsePopout(false);

        reopenAttemptsRef.current = 0;

        explicitCloseRef.current = false;

        return;

      }



      /* PiP closes when clicking outside — reopen unless user clicked ✕ */

      reopenTimerRef.current = setTimeout(() => {

        reopenTimerRef.current = null;

        if (

          userClosedPanelRef.current ||

          explicitCloseRef.current ||

          consumeExplicitPanelCloseFlag() ||

          isExplicitPanelClosePending() ||

          !enabled

        ) {

          return;

        }

        if (reopenAttemptsRef.current >= 8) return;

        reopenAttemptsRef.current += 1;

        openPanelRef.current?.();

      }, 80);

    });



    panelWindowRef.current = w;

    setPipWindow(w);

    setUsePopout(false);

    setIsOpen(true);

    setIsMinimized(false);

    reopenAttemptsRef.current = 0;

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        if (w.closed) return;

        w.document.body.style.transition = 'opacity 120ms ease';

        w.document.body.style.visibility = 'visible';

        w.document.body.style.opacity = '1';

      });

    });

    return w;

  }, [enabled]);



  const openPopoutWindow = useCallback(() => {

    const popout = openFloatPopout();

    if (!popout) return null;



    try {

      popout.opener = null;

    } catch {

      /* ignore */

    }



    popoutRef.current = popout;

    panelWindowRef.current = popout;

    setUsePopout(true);

    setIsOpen(true);

    setIsMinimized(false);

    reopenAttemptsRef.current = 0;

    return popout;

  }, []);



  const openPanel = useCallback(async () => {

    if (!enabled || openingPanelRef.current) return;



    const existing = panelWindowRef.current;

    if (existing && !existing.closed) {

      setIsOpen(true);

      setUsePopout(Boolean(popoutRef.current && !popoutRef.current.closed));

      try {

        existing.focus();

      } catch {

        /* ignore */

      }

      return;

    }



    openingPanelRef.current = true;

    userClosedPanelRef.current = false;

    explicitCloseRef.current = false;

    clearExplicitPanelCloseFlag();

    clearReopenTimer();



    try {

      if (pipSupported) {

        try {

          await openPipWindow();

          return;

        } catch (err) {

          if (err?.name !== 'NotAllowedError') {

            console.warn('PiP failed, using popout fallback:', err);

          }

        }

      }



      openPopoutWindow();

    } finally {

      openingPanelRef.current = false;

    }

  }, [enabled, pipSupported, openPipWindow, openPopoutWindow, clearReopenTimer]);



  useEffect(() => {

    openPanelRef.current = openPanel;

  }, [openPanel]);



  useEffect(() => {

    closePanelRef.current = closePanel;

  }, [closePanel]);



  useEffect(() => {

    if (typeof BroadcastChannel === 'undefined') return undefined;



    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event) => {

      if (event.data?.type === 'explicit-close') {

        userClosedPanelRef.current = true;

        explicitCloseRef.current = true;

        markExplicitPanelClose();

        consumeExplicitPanelCloseFlag();

        clearReopenTimer();

        setIsOpen(false);

        setUsePopout(false);

        setIsMinimized(false);

        setPipWindow(null);

        panelWindowRef.current = null;

        popoutRef.current = null;

        reopenAttemptsRef.current = 0;

        explicitCloseRef.current = false;

      }

    };



    return () => channel.close();

  }, [clearReopenTimer]);



  useEffect(() => {

    if (!isOpen || !usePopout) return undefined;



    const id = setInterval(() => {

      const popout = popoutRef.current;

      if (!popout || !popout.closed) return;



      popoutRef.current = null;

      panelWindowRef.current = null;



      const wasExplicitClose =

        userClosedPanelRef.current ||

        explicitCloseRef.current ||

        consumeExplicitPanelCloseFlag() ||

        isExplicitPanelClosePending();



      if (wasExplicitClose) {

        clearExplicitPanelCloseFlag();

        setIsOpen(false);

        setUsePopout(false);

        setIsMinimized(false);

        explicitCloseRef.current = false;

        return;

      }



      openPanelRef.current?.();

    }, 200);



    return () => clearInterval(id);

  }, [isOpen, usePopout]);



  useEffect(() => {

    const onBeforeUnload = () => {

      allowPopoutCleanupRef.current = true;

    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {

      window.removeEventListener('beforeunload', onBeforeUnload);

      clearReopenTimer();

      if (allowPopoutCleanupRef.current) {

        popoutRef.current?.close();

      }

    };

  }, [clearReopenTimer]);



  const renderInPanel = useCallback(

    (children) => {

      if (!isOpen || usePopout) return null;

      if (pipWindow) {

        return createPortal(children, pipWindow.document.body);

      }

      return null;

    },

    [isOpen, pipWindow, usePopout]

  );



  return {

    isOpen,

    isMinimized,

    openPanel,

    closePanel,

    setPanelMinimized,

    renderInPanel,

    usePopout,

    pipWindow,

  };

}


