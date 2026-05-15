/**
 * dilbar — components/ProgressBar.jsx
 * ─────────────────────────────────────────────────────────────
 * Animated progress bar shown while the analysis engines run.
 *
 * Shows:
 *   - A smooth percentage fill bar with shimmer animation
 *   - Step pills showing pending / active / done / error states
 *   - Current step label and overall percentage
 *
 * Receives the progress object from useAnalysis directly.
 * ─────────────────────────────────────────────────────────────
 */

export default function ProgressBar({ progress }) {
  const { percent, steps } = progress;

  const currentStep = steps.find(s => s.status === "active");
  const hasError    = steps.some(s => s.status === "error");

  return (
    <div className="progress-card">

      {/* Header */}
      <div className="progress-top">
        <div className="progress-label">
          <i className={`ti ${hasError ? "ti-alert-circle" : "ti-loader-2"}`} />
          {hasError
            ? "Analysis stopped"
            : currentStep
              ? currentStep.label
              : percent === 100
                ? "Report ready"
                : "Preparing analysis"
          }
        </div>
        <div className="progress-pct">{percent}%</div>
      </div>

      {/* Track */}
      <div className="progress-track">
        <div
          className={`progress-fill ${hasError ? "progress-fill--error" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Step pills */}
      <div className="progress-steps">
        {steps.map(step => (
          <span
            key={step.id}
            className={[
              "step",
              step.status === "done"    ? "step-done"    : "",
              step.status === "active"  ? "step-active"  : "",
              step.status === "pending" ? "step-pending"  : "",
              step.status === "error"   ? "step-error"   : "",
            ].filter(Boolean).join(" ")}
          >
            {step.status === "done"   && <i className="ti ti-check" />}
            {step.status === "error"  && <i className="ti ti-x" />}
            {step.label}
          </span>
        ))}
      </div>

    </div>
  );
}
