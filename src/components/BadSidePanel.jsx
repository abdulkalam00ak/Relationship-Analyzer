/**
 * dilbar — components/BadSidePanel.jsx
 * ─────────────────────────────────────────────────────────────
 * Displays the difficult side of the relationship honestly
 * and constructively — not to judge but to surface patterns
 * the couple might not have noticed themselves.
 *
 * Shows:
 *   - Last fight date and severity
 *   - Fight frequency label
 *   - Longest silence gap
 *   - Average recovery time
 *   - Top trigger words
 *   - Ghost/cold reply patterns per person
 *   - Recurring mistake phrases with fix suggestions
 *
 * Props:
 *   data   — from selectBadSide(result)
 * ─────────────────────────────────────────────────────────────
 */

import {
  getConflictFrequencyLabel,
  getSeverityLabel,
} from "../engine/conflictDetector.js";

export default function BadSidePanel({ data }) {
  if (!data) return null;

  const {
    senders,
    conflictCount,
    lastConflict,
    longestSilence,
    avgRecoveryTime,
    triggerWords,
    recurringMistakes,
    perPersonConflict,
    balanceScore,
    dominantSender,
  } = data;

  const [a, b] = senders;
  const conflictA = perPersonConflict[a];
  const conflictB = perPersonConflict[b];

  // Relationship months approximation for frequency label
  const freqLabel = getConflictFrequencyLabel(conflictCount, 12);

  const mistakesA = recurringMistakes?.[a] || [];
  const mistakesB = recurringMistakes?.[b] || [];

  return (
    <div className="report-panel">

      {/* Header */}
      <div className="panel-header">
        <i className="ti ti-alert-circle panel-header-icon bad" />
        <span className="panel-header-title bad">The Bad Side</span>
        <span className="panel-sub-badge panel-sub-badge--bad">
          {freqLabel}
        </span>
      </div>

      <div className="panel-body">

        {/* Fight count */}
        <div className="panel-row panel-row--highlight">
          <div className="panel-row-dot dot-bad" />
          <div className="panel-row-text">Conflicts detected</div>
          <div className="panel-row-val">{conflictCount}</div>
        </div>

        {/* Last fight */}
        {lastConflict && (
          <div className="panel-row">
            <div className="panel-row-dot dot-bad" />
            <div className="panel-row-text">Last conflict</div>
            <div className="panel-row-val">
              {lastConflict.dateStr}
              <span className="severity-badge severity-badge--{lastConflict.severity}">
                {getSeverityLabel(lastConflict.severity)}
              </span>
            </div>
          </div>
        )}

        {/* Longest silence */}
        {longestSilence && (
          <div className="panel-row">
            <div className="panel-row-dot dot-bad" />
            <div className="panel-row-text">Longest silence</div>
            <div className="panel-row-val">{longestSilence.hours} hours</div>
          </div>
        )}

        {/* Recovery time */}
        {avgRecoveryTime > 0 && (
          <div className="panel-row">
            <div className="panel-row-dot dot-bad" />
            <div className="panel-row-text">Avg recovery time</div>
            <div className="panel-row-val">{avgRecoveryTime} hours</div>
          </div>
        )}

        {/* Cold replies */}
        {conflictA?.coldReplyCount > 0 && (
          <div className="panel-row">
            <div className="panel-row-dot dot-bad" />
            <div className="panel-row-text">{a} cold replies</div>
            <div className="panel-row-val">{conflictA.coldReplyCount} times</div>
          </div>
        )}

        {conflictB?.coldReplyCount > 0 && (
          <div className="panel-row">
            <div className="panel-row-dot dot-bad" />
            <div className="panel-row-text">{b} cold replies</div>
            <div className="panel-row-val">{conflictB.coldReplyCount} times</div>
          </div>
        )}

        {/* Conversation balance warning */}
        {balanceScore < 45 && (
          <div className="panel-row">
            <div className="panel-row-dot dot-bad" />
            <div className="panel-row-text">Carries the conversation</div>
            <div className="panel-row-val">{dominantSender}</div>
          </div>
        )}

      </div>

      {/* Trigger words */}
      {triggerWords.length > 0 && (
        <div className="panel-section">
          <div className="panel-section-title">Most repeated trigger words</div>
          <div className="word-tags">
            {triggerWords.slice(0, 6).map((t, i) => (
              <span key={t.word} className={`tag ${i % 2 === 0 ? "" : "lav"}`}>
                {t.word}
                <span className="tag-count">{t.count}x</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recurring mistakes */}
      {(mistakesA.length > 0 || mistakesB.length > 0) && (
        <div className="panel-section">
          <div className="panel-section-title">Recurring patterns</div>
          {mistakesA.map((m, i) => (
            <div key={i} className="mistake-row">
              <div className="mistake-sender">{a}</div>
              <div className="mistake-phrase">"{m.phrase}"</div>
              <div className="mistake-count">×{m.count}</div>
            </div>
          ))}
          {mistakesB.map((m, i) => (
            <div key={i} className="mistake-row">
              <div className="mistake-sender">{b}</div>
              <div className="mistake-phrase">"{m.phrase}"</div>
              <div className="mistake-count">×{m.count}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
