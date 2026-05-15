/**
 * dilbar — components/BondScoreCard.jsx
 * ─────────────────────────────────────────────────────────────
 * Displays the overall 0–100 bond strength score with a
 * breakdown of the three contributing factors.
 *
 * Props:
 *   bondResult   BondResult   — from bondScorer.js
 *   senders      string[]     — [senderA, senderB]
 * ─────────────────────────────────────────────────────────────
 */

import { getBalanceLabel } from "../engine/bondScorer.js";

export default function BondScoreCard({ bondResult, senders }) {
  if (!bondResult) return null;
  const [a, b] = senders;
  const { score, label, description, factors, perPerson, balanceScore } = bondResult;

  const balanceLabel = getBalanceLabel(balanceScore);
  const pA = perPerson[a];
  const pB = perPerson[b];

  return (
    <div className="health-row">

      {/* Big score number */}
      <div className="health-score-card">
        <div className="health-score-label">Relationship health</div>
        <div>
          <span className="health-score-num">{score}</span>
          <span className="health-score-denom">/100</span>
        </div>
        <div className="health-score-status">{label}</div>
        <div className="health-score-bar">
          <div className="health-score-bar-fill" style={{ width: `${score}%` }} />
        </div>
        <div className="health-score-desc">{description}</div>
      </div>

      {/* Factor breakdown */}
      <div className="bond-factors">

        {/* Responsiveness */}
        <div className="factor-card">
          <div className="factor-header">
            <i className="ti ti-clock factor-icon" />
            <div>
              <div className="factor-name">Responsiveness</div>
              <div className="factor-meta">Avg reply · {factors.responsiveness.raw} min</div>
            </div>
            <div className="factor-score">{factors.responsiveness.score}</div>
          </div>
          <div className="factor-track">
            <div className="factor-fill" style={{ width: `${factors.responsiveness.score}%` }} />
          </div>
          <div className="factor-label">{factors.responsiveness.label}</div>
        </div>

        {/* Consistency */}
        <div className="factor-card">
          <div className="factor-header">
            <i className="ti ti-calendar-check factor-icon" />
            <div>
              <div className="factor-name">Consistency</div>
              <div className="factor-meta">Active days/month · {factors.consistency.raw}</div>
            </div>
            <div className="factor-score">{factors.consistency.score}</div>
          </div>
          <div className="factor-track">
            <div className="factor-fill" style={{ width: `${factors.consistency.score}%` }} />
          </div>
          <div className="factor-label">{factors.consistency.label}</div>
        </div>

        {/* Depth */}
        <div className="factor-card">
          <div className="factor-header">
            <i className="ti ti-message-2 factor-icon" />
            <div>
              <div className="factor-name">Depth</div>
              <div className="factor-meta">Avg words/message · {factors.depth.raw}</div>
            </div>
            <div className="factor-score">{factors.depth.score}</div>
          </div>
          <div className="factor-track">
            <div className="factor-fill" style={{ width: `${factors.depth.score}%` }} />
          </div>
          <div className="factor-label">{factors.depth.label}</div>
        </div>

        {/* Balance */}
        <div className="factor-card">
          <div className="factor-header">
            <i className="ti ti-scale factor-icon" />
            <div>
              <div className="factor-name">Balance</div>
              <div className="factor-meta">
                {a} {pA?.messageShare}% · {b} {pB?.messageShare}%
              </div>
            </div>
            <div className="factor-score">{balanceScore}</div>
          </div>
          <div className="factor-track">
            <div className="factor-fill" style={{ width: `${balanceScore}%` }} />
          </div>
          <div className="factor-label">{balanceLabel}</div>
        </div>

      </div>
    </div>
  );
}
