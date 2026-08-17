export default function StealthOverlay() {
  return (
    <div className="stealth-overlay">
      <div className="stealth-doc">
        <header className="stealth-doc-header">
          <div className="stealth-doc-icon">📄</div>
          <div className="stealth-doc-title">
            <span className="stealth-doc-name">Untitled document</span>
            <span className="stealth-doc-app">Google Docs</span>
          </div>
        </header>

        <div className="stealth-toolbar">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Insert</span>
          <span>Format</span>
          <span>Tools</span>
        </div>

        <div className="stealth-body">
          <p className="stealth-placeholder">Start typing your notes...</p>
          <p className="stealth-fake-line" />
          <p className="stealth-fake-line short" />
          <p className="stealth-fake-line medium" />
        </div>
      </div>
    </div>
  );
}
