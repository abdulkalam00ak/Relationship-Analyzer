/**
 * dilbar — components/EmojiEmotions.jsx
 * ─────────────────────────────────────────────────────────────
 * Displays emoji usage analysis for both partners.
 *
 * Shows per person:
 *   - Top 5 most used emojis with count and emotion label
 *   - Emotional spectrum bars (positive / negative / neutral %)
 *   - Dominant emotion label
 *   - Emotional shift warning if tone changed significantly
 *
 * Props:
 *   data   — from selectEmojiPanel(result)
 * ─────────────────────────────────────────────────────────────
 */

import {
  getDominantEmotionLabel,
  getEmojiLoveIntensity,
} from "../engine/emojiAnalyzer.js";

export default function EmojiEmotions({ data }) {
  if (!data) return null;

  const { senders, totalEmojiCount, combinedSpectrum, perPerson } = data;
  const [a, b] = senders;

  return (
    <div className="emoji-card">

      {/* Header */}
      <div className="chart-title">Emoji Emotions</div>
      <div className="chart-sub">
        {totalEmojiCount.toLocaleString()} total emojis analyzed
        &nbsp;·&nbsp;
        {combinedSpectrum.positive}% positive,
        {" "}{combinedSpectrum.negative}% negative,
        {" "}{combinedSpectrum.neutral}% neutral
      </div>

      {/* Per-person blocks */}
      <div className="emoji-persons">
        {[a, b].map(sender => {
          const person = perPerson[sender];
          if (!person) return null;

          return (
            <div key={sender} className="emoji-person-block">

              {/* Person name + dominant emotion */}
              <div className="emoji-person-header">
                <div className="emoji-person-name">{sender}</div>
                <div className="emoji-dominant">
                  {getDominantEmotionLabel(person.dominantEmotion)}
                  &nbsp;·&nbsp;
                  {getEmojiLoveIntensity(person.loveScore, person.totalCount)}
                </div>
              </div>

              {/* Top 5 emojis */}
              <div className="emoji-row">
                {(person.top5 || []).map(e => (
                  <div key={e.emoji} className="emoji-chip">
                    <span className="emoji-glyph">{e.emoji}</span>
                    <span className="emoji-count">{e.count}</span>
                  </div>
                ))}
                {person.totalCount === 0 && (
                  <span className="emoji-empty">No emojis found</span>
                )}
              </div>

              {/* Spectrum bars */}
              <div className="spectrum-bars">
                <SpectrumBar
                  label="Positive"
                  value={person.spectrum.positive}
                  colorClass="fill-positive"
                />
                <SpectrumBar
                  label="Negative"
                  value={person.spectrum.negative}
                  colorClass="fill-negative"
                />
                <SpectrumBar
                  label="Neutral"
                  value={person.spectrum.neutral}
                  colorClass="fill-neutral"
                />
              </div>

              {/* Emotional shift warning */}
              {person.emotionalShift && (
                <div className="shift-warning">
                  <i className="ti ti-trending-down" />
                  {person.emotionalShift.description}
                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
}

function SpectrumBar({ label, value, colorClass }) {
  return (
    <div className="emotion-bar-row">
      <div className="emotion-label">{label}</div>
      <div className="emotion-track">
        <div className={`emotion-fill ${colorClass}`} style={{ width: `${value}%` }} />
      </div>
      <div className="emotion-pct">{value}%</div>
    </div>
  );
}
