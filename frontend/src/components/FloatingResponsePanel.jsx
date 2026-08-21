import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  CHANNEL_NAME,
  markExplicitPanelClose,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  PANEL_MIN_WIDTH,
  POPOUT_MIN_HEIGHT,
  PIP_MIN_HEIGHT,
} from '../hooks/useFloatingPanel';
import { useWindowDrag } from '../hooks/useWindowDrag';

function notifyExplicitPanelClose() {
  markExplicitPanelClose();
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'explicit-close' });
    channel.close();
  } catch {
    /* ignore */
  }
}

function notifyClearResponses() {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'clear-responses' });
    channel.close();
  } catch {
    /* ignore */
  }
}

const markdownComponents = {
  strong: ({ children }) => <strong className="keyword">{children}</strong>,
  p: ({ children }) => <p className="response-paragraph">{children}</p>,
};

function resizeHostWindow(minimized, isPopout) {
  try {
    window.resizeTo(
      minimized ? PANEL_MIN_WIDTH : PANEL_WIDTH,
      minimized ? (isPopout ? POPOUT_MIN_HEIGHT : PIP_MIN_HEIGHT) : PANEL_HEIGHT
    );
  } catch {
    /* ignore */
  }
}

export default function FloatingResponsePanel({
  responses = [],
  streamingResponse = null,
  loading = false,
  onSetMinimized,
  onClose,
  onClearResponses,
  isPopoutWindow = false,
  isMinimized: controlledMinimized,
  dragWindow = null,
}) {
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = controlledMinimized ?? localMinimized;

  const targetWindow = dragWindow || (isPopoutWindow ? window : null);
  const chromeRef = useWindowDrag(targetWindow, !!targetWindow);

  const allItems = streamingResponse
    ? [streamingResponse, ...responses.filter((r) => r.id !== streamingResponse.id)]
    : responses;

  const handleMinimize = useCallback(() => {
    const next = !minimized;
    setLocalMinimized(next);
    onSetMinimized?.(next);
    if (isPopoutWindow) {
      resizeHostWindow(next, true);
    }
  }, [minimized, isPopoutWindow, onSetMinimized]);

  const handleClose = useCallback(() => {
    notifyExplicitPanelClose();
    if (isPopoutWindow) {
      window.setTimeout(() => {
        window.close();
      }, 0);
    } else {
      onClose?.();
    }
  }, [isPopoutWindow, onClose]);

  const handleClear = useCallback(() => {
    if (isPopoutWindow) {
      notifyClearResponses();
    } else {
      onClearResponses?.();
    }
  }, [isPopoutWindow, onClearResponses]);

  return (
    <div className={`float-panel${minimized ? ' minimized' : ''}`}>
      <div
        ref={chromeRef}
        className="float-window-chrome"
        title={targetWindow ? 'Drag to move' : undefined}
      >
        <div className="float-window-brand">
          <span className="float-window-icon" aria-hidden="true" />
          <span className="float-window-title">
            Docs{minimized ? '' : ` — Responses (${allItems.length})`}
          </span>
        </div>
        <div className="float-window-controls">
          {loading && !minimized && <span className="float-panel-status">...</span>}
          <button
            type="button"
            className="float-win-btn float-win-minimize"
            onClick={handleMinimize}
            title={minimized ? 'Restore' : 'Minimize'}
            aria-label={minimized ? 'Restore' : 'Minimize'}
          >
            {minimized ? '▢' : '─'}
          </button>
          <button
            type="button"
            className="float-win-btn float-win-close"
            onClick={handleClose}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
        <div className="float-panel-feed">
          {allItems.length === 0 ? (
            <p className="float-panel-empty">No responses yet.</p>
          ) : (
            allItems.map((item) => (
              <div
                key={item.id || 'stream'}
                className={`response-item float-item${item.id?.startsWith('stream') ? ' streaming' : ''}`}
              >
                <div className="response-heading">{item.prompt || item.heading}</div>
                <div className="response-body">
                  {item.response ? (
                    <ReactMarkdown components={markdownComponents}>{item.response}</ReactMarkdown>
                  ) : (
                    <span className="streaming-placeholder">Generating answer...</span>
                  )}
                  {item.id?.startsWith('stream') && item.response && (
                    <span className="streaming-cursor" aria-hidden="true" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="float-panel-footer">
          <button
            type="button"
            className="float-panel-clear"
            onClick={handleClear}
            disabled={allItems.length === 0 && !loading}
            title="Clear all responses"
          >
            Clear responses
          </button>
        </div>
        </>
      )}
    </div>
  );
}
