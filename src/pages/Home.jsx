/**
 * dilbar — pages/Home.jsx
 * ─────────────────────────────────────────────────────────────
 * The landing screen users see before analysis.
 *
 * Shows:
 *   - Intro banner explaining what dilbar does
 *   - Upload zone to select the .txt file
 *   - Progress bar once analysis starts
 *   - Error message if something goes wrong
 *   - A "how to export" guide below the upload zone
 * ─────────────────────────────────────────────────────────────
 */

import UploadZone   from "../components/UploadZone.jsx";
import ProgressBar  from "../components/ProgressBar.jsx";

export default function Home({ status, progress, error, onFile }) {
  const isAnalyzing = status === "analyzing";
  const isError     = status === "error";

  return (
    <div className="home-page">

      {/* Intro banner */}
      <div className="intro-banner">
        <div className="intro-text-block">
          <div className="intro-urdu">
            ہر لفظ میں چھپی ہے کہانی — Every word hides a story
          </div>
          <div className="intro-title">
            Your relationship, decoded<br />with honesty and care.
          </div>
          <div className="intro-body">
            dilbar reads through your WhatsApp conversations to reveal what
            words cannot always say — the love, the patterns, the fights, and
            what they mean for your bond. Upload your chat file to get started.
          </div>
        </div>
        <div className="intro-ornament">♡</div>
      </div>

      {/* Progress bar — shown while analyzing */}
      {isAnalyzing && <ProgressBar progress={progress} />}

      {/* Error state */}
      {isError && (
        <div className="error-banner">
          <i className="ti ti-alert-circle" />
          <div>
            <div className="error-title">Analysis failed</div>
            <div className="error-body">{error}</div>
          </div>
        </div>
      )}

      {/* Upload zone — always visible unless analyzing */}
      {!isAnalyzing && (
        <UploadZone
          onFile={onFile}
          disabled={isAnalyzing}
        />
      )}

      {/* How to export guide */}
      {!isAnalyzing && (
        <div className="export-guide">
          <div className="guide-title">
            <i className="ti ti-info-circle" />
            How to export your WhatsApp chat
          </div>
          <div className="guide-steps">
            <div className="guide-step">
              <span className="guide-num">1</span>
              <span>Open WhatsApp and go to the chat you want to analyze</span>
            </div>
            <div className="guide-step">
              <span className="guide-num">2</span>
              <span>Tap the three dots (Android) or name at the top (iPhone)</span>
            </div>
            <div className="guide-step">
              <span className="guide-num">3</span>
              <span>Select <strong>More</strong> → <strong>Export Chat</strong></span>
            </div>
            <div className="guide-step">
              <span className="guide-num">4</span>
              <span>Choose <strong>Without Media</strong> — this creates a .txt file</span>
            </div>
            <div className="guide-step">
              <span className="guide-num">5</span>
              <span>Save or share the file to your device and upload it above</span>
            </div>
          </div>
          <div className="guide-privacy">
            <i className="ti ti-shield-check" />
            The file is read entirely in your browser.
            No messages are uploaded or stored anywhere.
          </div>
        </div>
      )}

    </div>
  );
}
