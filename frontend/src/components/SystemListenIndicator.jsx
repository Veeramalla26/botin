import { useState, useRef, useCallback } from 'react';

export default function SystemListenIndicator({ onStop }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState(null);
  const dragRef = useRef(null);
  const barRef = useRef(null);

  const clampPosition = useCallback((x, y) => {
    const bar = barRef.current;
    const width = bar?.offsetWidth || 320;
    const height = bar?.offsetHeight || 40;
    return {
      x: Math.max(8, Math.min(window.innerWidth - width - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, y)),
    };
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('button')) return;

    const bar = barRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    bar.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      const next = clampPosition(
        e.clientX - dragRef.current.offsetX,
        e.clientY - dragRef.current.offsetY
      );
      setPos(next);
    },
    [clampPosition]
  );

  const endDrag = useCallback((e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }, []);

  const positionStyle =
    pos != null
      ? { left: pos.x, top: pos.y, transform: 'none' }
      : { top: 12, left: '50%', transform: 'translateX(-50%)' };

  if (collapsed) {
    return (
      <button
        ref={barRef}
        type="button"
        className="meet-share-pill"
        style={positionStyle}
        onClick={() => setCollapsed(false)}
        title="Show sharing indicator"
        aria-label="Show sharing indicator"
      >
        <span aria-hidden="true">⏸</span>
        <span>meet.google.com</span>
      </button>
    );
  }

  return (
    <div
      ref={barRef}
      className="meet-share-bar"
      style={positionStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="status"
      aria-live="polite"
    >
      <span className="meet-share-icon" aria-hidden="true">
        ⏸
      </span>
      <span className="meet-share-text">meet.google.com is sharing a window.</span>
      <button type="button" className="meet-share-stop" onClick={onStop}>
        Stop sharing
      </button>
      <button type="button" className="meet-share-hide" onClick={() => setCollapsed(true)}>
        Hide
      </button>
    </div>
  );
}
