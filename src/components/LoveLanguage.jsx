/**
 * dilbar — components/LoveLanguage.jsx
 * ─────────────────────────────────────────────────────────────
 * Displays the love language detection results for both people.
 *
 * Shows:
 *   - 4 language bars per person (Words, Quality Time, Humor, Reassurance)
 *   - Primary love language highlighted
 *   - Compatibility score between the two people
 *   - One-line description of each person's style
 *
 * Props:
 *   loveLanguageResult   — from loveLanguage.js
 *   senders              string[]
 * ─────────────────────────────────────────────────────────────
 */

import { getLoveLanguageSummary } from "../engine/loveLanguage.js";

const LANGUAGE_KEYS = [
  { key: "wordsOfAffirmation", label: "Words of Affirmation", icon: "ti-message-heart" },
  { key: "qualityTime",        label: "Quality Time",         icon: "ti-clock-heart"   },
  { key: "humor",              label: "Humor & Playfulness",  icon: "ti-mood-happy"    },
  { key: "reassurance",        label: "Reassurance",          icon: "ti-shield-heart"  },
];

export default function LoveLanguage({ loveLanguageResult, senders }) {
  if (!loveLanguageResult) return null;

  const [a, b]      = senders;
  const resultA     = loveLanguageResult.perPerson[a];
  const resultB     = loveLanguageResult.perPerson[b];
  const { compatibility } = loveLanguageResult;

  const summary = getLoveLanguageSummary(resultA, a, resultB, b);

  return (
    <div className="lang-card">

      {/* Header */}
      <div className="chart-title">Love Language Detector</div>
      <div className="chart-sub">{summary}</div>

      {/* Two-column person blocks */}
      <div className="lang-persons">
        {[[a, resultA], [b, resultB]].map(([name, result]) => (
          <div key={name} className="lang-person">

            <div className="lang-person-name">{name}</div>
            <div className="lang-primary-badge">
              {result.primaryName}
            </div>
            <div className="lang-description">{result.description}</div>

            {/* Language bars */}
            <div className="lang-bars">
              {LANGUAGE_KEYS.map(({ key, label, icon }) => {
                const score     = result.scores[key] || 0;
                const isPrimary = result.primary === key;
                return (
                  <div
                    key={key}
                    className={`lang-row ${isPrimary ? "lang-row--primary" : ""}`}
                  >
                    <div className="lang-icon-label">
                      <i className={`ti ${icon}`} />
                      <span className="lang-name">{label}</span>
                    </div>
                    <div className="lang-track">
                      <div
                        className={`lang-fill ${isPrimary ? "lang-fill-burg" : "lang-fill-lav"}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <div className="lang-pct">{score}</div>
                  </div>
                );
              })}
            </div>

          </div>
        ))}
      </div>

      {/* Compatibility score */}
      <div className="compat-section">
        <div className="compat-header">
          <span className="compat-label">Love Language Compatibility</span>
          <span className="compat-score">{compatibility.score} / 100</span>
        </div>
        <div className="compat-track">
          <div
            className="compat-fill"
            style={{ width: `${compatibility.score}%` }}
          />
        </div>
        <div className="compat-status">{compatibility.label}</div>
        <div className="compat-desc">{compatibility.description}</div>
      </div>

    </div>
  );
}
