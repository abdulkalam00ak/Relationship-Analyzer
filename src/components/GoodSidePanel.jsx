/**
 * dilbar — components/GoodSidePanel.jsx
 * ─────────────────────────────────────────────────────────────
 * Displays the positive side of the relationship.
 *
 * Shows:
 *   - Total love expressions + per-person breakdown
 *   - Nickname each person uses for the other
 *   - Top love phrases per person
 *   - Love category breakdown (direct, longing, warmth etc.)
 *   - Peak loving month
 *   - Word tags (most used affectionate phrases)
 *
 * Props:
 *   data   — from selectGoodSide(result)
 * ─────────────────────────────────────────────────────────────
 */

import { getLoveIntensityLabel } from "../engine/loveDetector.js";

const CATEGORY_LABELS = {
  direct:    "Direct love",
  longing:   "Missing them",
  warmth:    "Warmth",
  affection: "Affection",
  routine:   "Daily care",
};

export default function GoodSidePanel({ data }) {
  if (!data) return null;

  const {
    senders, totalLoveCount, dominantLover,
    peakMonth, perPersonLove, bondScore,
  } = data;

  const [a, b] = senders;
  const loveA  = perPersonLove[a];
  const loveB  = perPersonLove[b];

  const pctA = totalLoveCount > 0
    ? Math.round((loveA.count / totalLoveCount) * 100)
    : 50;
  const pctB = 100 - pctA;

  return (
    <div className="report-panel">

      {/* Header */}
      <div className="panel-header">
        <i className="ti ti-heart panel-header-icon good" />
        <span className="panel-header-title good">The Good Side</span>
        <span className="panel-sub-badge">
          {getLoveIntensityLabel(
            (loveA.weightedScore || 0) + (loveB.weightedScore || 0),
            totalLoveCount
          )} love intensity
        </span>
      </div>

      <div className="panel-body">

        {/* Total love count */}
        <div className="panel-row panel-row--highlight">
          <div className="panel-row-dot dot-good" />
          <div className="panel-row-text">Total love expressions</div>
          <div className="panel-row-val">{totalLoveCount}</div>
        </div>

        {/* Per-person love */}
        <div className="panel-row">
          <div className="panel-row-dot dot-good" />
          <div className="panel-row-text">{a} expresses love</div>
          <div className="panel-row-val">{loveA.count} times ({pctA}%)</div>
        </div>

        <div className="panel-row">
          <div className="panel-row-dot dot-good" />
          <div className="panel-row-text">{b} expresses love</div>
          <div className="panel-row-val">{loveB.count} times ({pctB}%)</div>
        </div>

        {/* Nicknames */}
        {loveA.nickname && (
          <div className="panel-row">
            <div className="panel-row-dot dot-good" />
            <div className="panel-row-text">{a} calls {b}</div>
            <div className="panel-row-val">"{loveA.nickname}"</div>
          </div>
        )}

        {loveB.nickname && (
          <div className="panel-row">
            <div className="panel-row-dot dot-good" />
            <div className="panel-row-text">{b} calls {a}</div>
            <div className="panel-row-val">"{loveB.nickname}"</div>
          </div>
        )}

        {/* Dominant lover */}
        <div className="panel-row">
          <div className="panel-row-dot dot-good" />
          <div className="panel-row-text">Expresses more love</div>
          <div className="panel-row-val">{dominantLover}</div>
        </div>

        {/* Peak month */}
        {peakMonth && (
          <div className="panel-row">
            <div className="panel-row-dot dot-good" />
            <div className="panel-row-text">Most loving month</div>
            <div className="panel-row-val">{formatMonthLabel(peakMonth)}</div>
          </div>
        )}

        {/* Bond score */}
        <div className="panel-row">
          <div className="panel-row-dot dot-good" />
          <div className="panel-row-text">Bond strength score</div>
          <div className="panel-row-val">{bondScore} / 100</div>
        </div>

      </div>

      {/* Love category breakdown */}
      <div className="panel-section">
        <div className="panel-section-title">How love is expressed</div>
        <div className="category-rows">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const countA = loveA.byCategory?.[key] || 0;
            const countB = loveB.byCategory?.[key] || 0;
            const total  = countA + countB;
            if (total === 0) return null;
            return (
              <div key={key} className="category-row">
                <div className="category-label">{label}</div>
                <div className="category-bar-track">
                  <div
                    className="category-bar-fill"
                    style={{ width: `${Math.min(100, total * 3)}%` }}
                  />
                </div>
                <div className="category-count">{total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top phrases */}
      <div className="word-tags">
        {[...(loveA.topPhrases || []), ...(loveB.topPhrases || [])]
          .sort((x, y) => y.count - x.count)
          .slice(0, 8)
          .map((p, i) => (
            <span key={p.phrase} className={`tag ${i % 2 === 0 ? "" : "lav"}`}>
              {p.phrase}
            </span>
          ))
        }
      </div>

    </div>
  );
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}
