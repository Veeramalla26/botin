import { useEffect, useRef } from 'react';

export function useWindowDrag(targetWindow, enabled = true) {
  const chromeRef = useRef(null);
  const dragState = useRef(null);

  useEffect(() => {
    const chrome = chromeRef.current;
    const win = targetWindow;
    if (!chrome || !win || win.closed || !enabled) return undefined;

    const onMouseDown = (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;

      dragState.current = {
        startScreenX: e.screenX,
        startScreenY: e.screenY,
        startWinX: win.screenX,
        startWinY: win.screenY,
      };
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!dragState.current) return;
      const { startScreenX, startScreenY, startWinX, startWinY } = dragState.current;
      try {
        win.moveTo(
          startWinX + (e.screenX - startScreenX),
          startWinY + (e.screenY - startScreenY)
        );
      } catch {
        /* moveTo blocked */
      }
    };

    const onMouseUp = () => {
      dragState.current = null;
    };

    chrome.addEventListener('mousedown', onMouseDown);
    win.addEventListener('mousemove', onMouseMove);
    win.addEventListener('mouseup', onMouseUp);

    return () => {
      chrome.removeEventListener('mousedown', onMouseDown);
      win.removeEventListener('mousemove', onMouseMove);
      win.removeEventListener('mouseup', onMouseUp);
    };
  }, [targetWindow, enabled]);

  return chromeRef;
}
