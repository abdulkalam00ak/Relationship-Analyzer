/**
 * dilbar — components/Topbar.jsx
 * ─────────────────────────────────────────────────────────────
 * Top navigation bar shown after analysis is complete.
 *
 * Shows:
 *   - Chat participants names and analysis metadata
 *   - Total messages and date range
 *   - Export button (triggers print/save as PDF)
 *   - New analysis button (resets the app)
 *
 * Props:
 *   result     AnalysisResult | null
 *   onReset    fn   — called when "New analysis" is clicked
 * ─────────────────────────────────────────────────────────────
 */

export default function Topbar({ result, onReset }) {
  // ── Format date range ──────────────────────────────────
  const formatDateRange = (dateRange) => {
    if (!dateRange) return "";
    const fmt = (d) => d.toLocaleDateString("en-IN", {
      month: "short", year: "numeric"
    });
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`;
  };

  // ── Format message count ───────────────────────────────
  const formatCount = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n;

  const handleExport = () => window.print();

  if (!result) {
    // Minimal topbar before analysis
    return (
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">dilbar</div>
          <div className="topbar-sub">Upload a WhatsApp chat to get started</div>
        </div>
      </div>
    );
  }

  const { senders, parseResult } = result;
  const [a, b] = senders;

  return (
    <div className="topbar">

      {/* Left — chat info */}
      <div className="topbar-left">
        <div className="topbar-title">
          {a} &amp; {b}
        </div>
        <div className="topbar-sub">
          {formatCount(parseResult.totalMessages)} messages
          &nbsp;·&nbsp;
          {formatDateRange(parseResult.dateRange)}
          &nbsp;·&nbsp;
          {parseResult.mediaCount > 0 && `${formatCount(parseResult.mediaCount)} media`}
          {parseResult.errors.length > 0 && (
            <span style={{ color: "var(--burg-mid)", marginLeft: 8 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} />
              &nbsp;{parseResult.errors[0]}
            </span>
          )}
        </div>
      </div>

      {/* Right — actions */}
      <div className="topbar-right">
        <button
          className="btn btn-outline"
          onClick={handleExport}
          title="Save report as PDF"
        >
          <i className="ti ti-download" />
          Export
        </button>
        <button
          className="btn btn-primary"
          onClick={onReset}
          title="Start a new analysis"
        >
          <i className="ti ti-plus" />
          New analysis
        </button>
      </div>

    </div>
  );
}
