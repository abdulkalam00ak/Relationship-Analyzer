/**
 * dilbar — components/NarrativeCard.jsx
 * ─────────────────────────────────────────────────────────────
 * The optional AI insights section.
 *
 * States:
 *   idle      — Shows a button "Generate AI Narrative"
 *   loading   — Shows a subtle loading indicator
 *   done      — Displays the narrative paragraph
 *   error     — Shows the error with a retry button
 *
 * The API is only called when the user explicitly clicks
 * the button — never automatically.
 *
 * Props:
 *   anonymizedStats   AnonymizedStats   — from anonymizer.js
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { generateNarrativeSafe } from "../api/geminiClient.js";

export default function NarrativeCard({ anonymizedStats }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [narrative, setNarrative] = useState(null);
  const [errMsg, setErrMsg]       = useState(null);

  const handleGenerate = async () => {
    setState("loading");
    setErrMsg(null);

    const result = await generateNarrativeSafe(anonymizedStats);

    if (result.success) {
      setNarrative(result.narrative);
      setState("done");
    } else {
      setErrMsg(result.error);
      setState("error");
    }
  };

  return (
    <div className="narrative-card">

      {/* Header */}
      <div className="narrative-header">
        <span className="narrative-badge">AI Insights</span>
        <span className="narrative-title">What dilbar sees in your bond</span>
      </div>

      {/* Idle — prompt to generate */}
      {state === "idle" && (
        <div className="narrative-idle">
          <div className="narrative-idle-text">
            Want a personalised narrative written by AI? dilbar will read
            all your anonymized stats and write a warm, honest paragraph
            about your relationship — with one specific suggestion.
          </div>
          <div className="narrative-privacy-note">
            <i className="ti ti-shield-check" />
            Only anonymized numbers are sent — no names, no messages.
          </div>
          <button className="btn btn-primary narrative-btn" onClick={handleGenerate}>
            <i className="ti ti-sparkles" />
            Generate AI narrative
          </button>
        </div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div className="narrative-loading">
          <div className="narrative-spinner" />
          <span>Reading your relationship data…</span>
        </div>
      )}

      {/* Done — show narrative */}
      {state === "done" && narrative && (
        <div className="narrative-body">
          {narrative}
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="narrative-error">
          <i className="ti ti-alert-circle" />
          <span>{errMsg}</span>
          <button
            className="btn btn-outline"
            onClick={handleGenerate}
            style={{ marginTop: 10 }}
          >
            <i className="ti ti-refresh" />
            Try again
          </button>
        </div>
      )}

    </div>
  );
}
