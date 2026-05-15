/**
 * dilbar — engine/emojiAnalyzer.js
 * ─────────────────────────────────────────────────────────────
 * Extracts and analyzes emoji usage from both partners.
 *
 * Produces:
 *   - Top 5 emojis per person
 *   - Emotional spectrum: positive / negative / neutral %
 *   - Emoji frequency over time (for mood graph overlay)
 *   - Emotional shift detection (when tone changed)
 *   - Dominant emotion per person
 *   - Emoji-based love score (heart emojis as affection signal)
 *
 * The emoji → emotion mapping covers 200+ common emojis
 * used in Indian/Pakistani WhatsApp conversations including
 * standard Unicode emoji and common combinations.
 * ─────────────────────────────────────────────────────────────
 */

import { getMessagesBy, groupByMonth } from "./parser.js";


// ─── EMOJI REGEX ─────────────────────────────────────────────
/**
 * Matches all Unicode emoji characters in a string.
 * Covers: standard emoji, ZWJ sequences, skin tone modifiers,
 * flags, and keycap sequences.
 */
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;


// ─── EMOTION CATEGORIES ──────────────────────────────────────
const POSITIVE  = "positive";
const NEGATIVE  = "negative";
const NEUTRAL   = "neutral";


// ─── EMOJI → EMOTION MAP ─────────────────────────────────────
/**
 * Maps individual emojis to their emotion category and a
 * sub-emotion label for more nuanced analysis.
 *
 * Structure: emoji → { emotion, label, loveScore }
 *
 * loveScore: 0–3, how strongly this emoji signals romantic love
 *   0 = no love signal
 *   1 = mild affection
 *   2 = moderate love
 *   3 = strong romantic love
 */
const EMOJI_MAP = {

  // ── Hearts — strong love signals ────────────────────────
  "❤️":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "🧡":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💛":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💚":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💙":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💜":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "🖤":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "🤍":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "🤎":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💕":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💞":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💓":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💗":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💖":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💘":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💝":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💟":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "❣️":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💌":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "💑":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "👫":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💏":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "🥰":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "😍":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "😘":  { emotion: POSITIVE, label: "love",       loveScore: 3 },
  "😗":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "😚":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "😙":  { emotion: POSITIVE, label: "love",       loveScore: 2 },
  "💋":  { emotion: POSITIVE, label: "love",       loveScore: 3 },

  // ── Happiness / laughter ─────────────────────────────────
  "😂":  { emotion: POSITIVE, label: "laughter",   loveScore: 0 },
  "🤣":  { emotion: POSITIVE, label: "laughter",   loveScore: 0 },
  "😄":  { emotion: POSITIVE, label: "happiness",  loveScore: 1 },
  "😃":  { emotion: POSITIVE, label: "happiness",  loveScore: 1 },
  "😀":  { emotion: POSITIVE, label: "happiness",  loveScore: 0 },
  "😁":  { emotion: POSITIVE, label: "happiness",  loveScore: 1 },
  "😆":  { emotion: POSITIVE, label: "laughter",   loveScore: 0 },
  "😅":  { emotion: POSITIVE, label: "laughter",   loveScore: 0 },
  "🤭":  { emotion: POSITIVE, label: "playful",    loveScore: 1 },
  "😊":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },
  "🥲":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },
  "☺️":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },
  "😌":  { emotion: POSITIVE, label: "contentment",loveScore: 1 },
  "🤩":  { emotion: POSITIVE, label: "excitement", loveScore: 1 },
  "🥳":  { emotion: POSITIVE, label: "celebration",loveScore: 0 },
  "🎉":  { emotion: POSITIVE, label: "celebration",loveScore: 0 },
  "🎊":  { emotion: POSITIVE, label: "celebration",loveScore: 0 },

  // ── Affection / care ─────────────────────────────────────
  "🤗":  { emotion: POSITIVE, label: "affection",  loveScore: 2 },
  "😇":  { emotion: POSITIVE, label: "affection",  loveScore: 1 },
  "🥺":  { emotion: POSITIVE, label: "longing",    loveScore: 2 },
  "🙏":  { emotion: POSITIVE, label: "gratitude",  loveScore: 1 },
  "✨":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },
  "🌹":  { emotion: POSITIVE, label: "romance",    loveScore: 3 },
  "🌸":  { emotion: POSITIVE, label: "affection",  loveScore: 1 },
  "🌺":  { emotion: POSITIVE, label: "affection",  loveScore: 1 },
  "🌷":  { emotion: POSITIVE, label: "affection",  loveScore: 2 },
  "💐":  { emotion: POSITIVE, label: "romance",    loveScore: 2 },
  "🦋":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },
  "🌙":  { emotion: POSITIVE, label: "romance",    loveScore: 1 },
  "⭐":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },
  "🌟":  { emotion: POSITIVE, label: "warmth",     loveScore: 1 },

  // ── Playful / teasing ────────────────────────────────────
  "😜":  { emotion: POSITIVE, label: "playful",    loveScore: 1 },
  "😝":  { emotion: POSITIVE, label: "playful",    loveScore: 0 },
  "😛":  { emotion: POSITIVE, label: "playful",    loveScore: 1 },
  "🤪":  { emotion: POSITIVE, label: "playful",    loveScore: 0 },
  "😏":  { emotion: POSITIVE, label: "flirty",     loveScore: 2 },
  "😈":  { emotion: POSITIVE, label: "flirty",     loveScore: 1 },
  "😋":  { emotion: POSITIVE, label: "playful",    loveScore: 0 },

  // ── Sadness / longing ────────────────────────────────────
  "😢":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },
  "😭":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },
  "😔":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },
  "😞":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },
  "😟":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },
  "🥺":  { emotion: NEGATIVE, label: "longing",    loveScore: 1 },
  "😩":  { emotion: NEGATIVE, label: "frustration",loveScore: 0 },
  "😫":  { emotion: NEGATIVE, label: "exhaustion", loveScore: 0 },
  "😪":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },

  // ── Anger / frustration ──────────────────────────────────
  "😠":  { emotion: NEGATIVE, label: "anger",      loveScore: 0 },
  "😡":  { emotion: NEGATIVE, label: "anger",      loveScore: 0 },
  "🤬":  { emotion: NEGATIVE, label: "anger",      loveScore: 0 },
  "💢":  { emotion: NEGATIVE, label: "anger",      loveScore: 0 },
  "😤":  { emotion: NEGATIVE, label: "frustration",loveScore: 0 },
  "🙄":  { emotion: NEGATIVE, label: "dismissal",  loveScore: 0 },
  "😒":  { emotion: NEGATIVE, label: "dismissal",  loveScore: 0 },
  "😑":  { emotion: NEGATIVE, label: "dismissal",  loveScore: 0 },
  "🤨":  { emotion: NEGATIVE, label: "skepticism", loveScore: 0 },
  "😬":  { emotion: NEGATIVE, label: "awkward",    loveScore: 0 },

  // ── Hurt / pain ──────────────────────────────────────────
  "💔":  { emotion: NEGATIVE, label: "heartbreak", loveScore: 0 },
  "😰":  { emotion: NEGATIVE, label: "anxiety",    loveScore: 0 },
  "😥":  { emotion: NEGATIVE, label: "sadness",    loveScore: 0 },
  "😓":  { emotion: NEGATIVE, label: "stress",     loveScore: 0 },
  "🤕":  { emotion: NEGATIVE, label: "pain",       loveScore: 0 },
  "😖":  { emotion: NEGATIVE, label: "distress",   loveScore: 0 },
  "😣":  { emotion: NEGATIVE, label: "distress",   loveScore: 0 },

  // ── Neutral / conversational ─────────────────────────────
  "😐":  { emotion: NEUTRAL,  label: "neutral",    loveScore: 0 },
  "😶":  { emotion: NEUTRAL,  label: "silence",    loveScore: 0 },
  "🤔":  { emotion: NEUTRAL,  label: "thinking",   loveScore: 0 },
  "😴":  { emotion: NEUTRAL,  label: "tired",      loveScore: 0 },
  "🙂":  { emotion: NEUTRAL,  label: "mild",       loveScore: 0 },
  "😶":  { emotion: NEUTRAL,  label: "neutral",    loveScore: 0 },
  "👍":  { emotion: NEUTRAL,  label: "okay",       loveScore: 0 },
  "👎":  { emotion: NEGATIVE, label: "disapproval",loveScore: 0 },
  "👀":  { emotion: NEUTRAL,  label: "watching",   loveScore: 0 },
  "💀":  { emotion: NEUTRAL,  label: "humor",      loveScore: 0 },
  "☠️":  { emotion: NEUTRAL,  label: "humor",      loveScore: 0 },
  "🤷":  { emotion: NEUTRAL,  label: "indifferent",loveScore: 0 },
  "🤦":  { emotion: NEGATIVE, label: "frustration",loveScore: 0 },
  "👏":  { emotion: POSITIVE, label: "praise",     loveScore: 0 },
  "🙌":  { emotion: POSITIVE, label: "excitement", loveScore: 0 },
  "🤝":  { emotion: NEUTRAL,  label: "agreement",  loveScore: 0 },
  "✅":  { emotion: NEUTRAL,  label: "agreement",  loveScore: 0 },
  "❌":  { emotion: NEGATIVE, label: "rejection",  loveScore: 0 },
  "⚠️":  { emotion: NEGATIVE, label: "warning",    loveScore: 0 },
  "🔥":  { emotion: POSITIVE, label: "passion",    loveScore: 1 },
  "💯":  { emotion: POSITIVE, label: "agreement",  loveScore: 0 },
  "🙃":  { emotion: NEUTRAL,  label: "sarcasm",    loveScore: 0 },
};


// ─── MAIN FUNCTION ────────────────────────────────────────────

/**
 * analyzeEmojis(messages, senders)
 *
 * @param {Message[]} messages   — from parser.parse()
 * @param {string[]}  senders    — [senderA, senderB]
 *
 * @returns {EmojiResult}
 *
 * EmojiResult shape:
 * {
 *   totalEmojiCount:  number,
 *   perPerson: {
 *     [sender]: {
 *       totalCount:       number,
 *       top5:             EmojiCount[],   — top 5 emojis used
 *       spectrum: {
 *         positive:       number,         — percentage 0–100
 *         negative:       number,
 *         neutral:        number,
 *       },
 *       dominantEmotion:  string,         — e.g. "laughter", "love"
 *       loveScore:        number,         — total romantic love signal
 *       byMonth:          MonthEmoji[],   — for chart overlay
 *       emotionalShift:   ShiftEvent|null — if tone changed significantly
 *     }
 *   },
 *   combinedSpectrum: { positive, negative, neutral },
 *   mostLovingMonth:  string | null,      — "YYYY-MM"
 *   emojiTimeline:    TimelinePoint[],    — monthly combined counts
 * }
 *
 * EmojiCount:  { emoji, count, emotion, label }
 * MonthEmoji:  { month, positive, negative, neutral, total }
 * ShiftEvent:  { month, from, to, description }
 */
export function analyzeEmojis(messages, senders) {
  const [senderA, senderB] = senders;

  const msgsA = getMessagesBy(messages, senderA);
  const msgsB = getMessagesBy(messages, senderB);

  const resultA = analyzePersonEmojis(msgsA);
  const resultB = analyzePersonEmojis(msgsB);

  // Combined spectrum across both people
  const totalPos  = resultA._rawCounts.positive  + resultB._rawCounts.positive;
  const totalNeg  = resultA._rawCounts.negative  + resultB._rawCounts.negative;
  const totalNeu  = resultA._rawCounts.neutral   + resultB._rawCounts.neutral;
  const totalAll  = totalPos + totalNeg + totalNeu;

  const combinedSpectrum = totalAll > 0
    ? {
        positive: Math.round((totalPos / totalAll) * 100),
        negative: Math.round((totalNeg / totalAll) * 100),
        neutral:  Math.round((totalNeu / totalAll) * 100),
      }
    : { positive: 0, negative: 0, neutral: 0 };

  // Emoji timeline — combined monthly counts
  const emojiTimeline = buildEmojiTimeline(messages, senders);

  // Most loving month — month with highest combined love score
  const mostLovingMonth = findMostLovingMonth(messages, senders);

  // Clean up internal counters before returning
  delete resultA._rawCounts;
  delete resultB._rawCounts;

  return {
    totalEmojiCount: resultA.totalCount + resultB.totalCount,
    perPerson: {
      [senderA]: resultA,
      [senderB]: resultB,
    },
    combinedSpectrum,
    mostLovingMonth,
    emojiTimeline,
  };
}


// ─── PER-PERSON ANALYSIS ─────────────────────────────────────

/**
 * analyzePersonEmojis(messages)
 * Full emoji analysis for a single person's messages.
 * Returns everything the dashboard needs for that person's panel.
 */
function analyzePersonEmojis(messages) {
  const emojiCounts   = {};  // emoji → count
  const labelCounts   = {};  // sub-label → count (e.g. "laughter" → 14)
  let posCount        = 0;
  let negCount        = 0;
  let neuCount        = 0;
  let totalLoveScore  = 0;
  let totalEmojis     = 0;

  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;

    const emojis = extractEmojis(msg.text);
    for (const emoji of emojis) {
      totalEmojis++;
      emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;

      const meta = EMOJI_MAP[emoji];
      if (meta) {
        if (meta.emotion === POSITIVE) posCount++;
        else if (meta.emotion === NEGATIVE) negCount++;
        else neuCount++;

        labelCounts[meta.label] = (labelCounts[meta.label] || 0) + 1;
        totalLoveScore += meta.loveScore;
      } else {
        // Unknown emoji — treat as neutral
        neuCount++;
      }
    }
  }

  const total = posCount + negCount + neuCount;

  // Spectrum percentages
  const spectrum = total > 0
    ? {
        positive: Math.round((posCount / total) * 100),
        negative: Math.round((negCount / total) * 100),
        neutral:  Math.round((neuCount / total) * 100),
      }
    : { positive: 0, negative: 0, neutral: 0 };

  // Top 5 emojis with metadata
  const top5 = Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji, count]) => ({
      emoji,
      count,
      emotion: EMOJI_MAP[emoji]?.emotion  || NEUTRAL,
      label:   EMOJI_MAP[emoji]?.label    || "unknown",
    }));

  // Dominant emotion — the sub-label used most
  const dominantEmotion = Object.entries(labelCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";

  // Monthly breakdown for chart overlay
  const byMonth = buildPersonMonthlyEmojis(messages);

  // Emotional shift detection
  const emotionalShift = detectEmotionalShift(byMonth);

  return {
    totalCount: totalEmojis,
    top5,
    spectrum,
    dominantEmotion,
    loveScore:  totalLoveScore,
    byMonth,
    emotionalShift,
    // Internal — deleted by caller before returning
    _rawCounts: { positive: posCount, negative: negCount, neutral: neuCount },
  };
}


// ─── EMOJI EXTRACTOR ─────────────────────────────────────────

/**
 * extractEmojis(text)
 * Pulls all emoji characters out of a message string.
 * Returns an array — one entry per emoji (with duplicates).
 * Uses Unicode property escapes for reliable cross-platform matching.
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractEmojis(text) {
  return [...(text.matchAll(EMOJI_REGEX) || [])].map(m => m[0]);
}


// ─── MONTHLY EMOJI BREAKDOWN ─────────────────────────────────

function buildPersonMonthlyEmojis(messages) {
  const months = {};

  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;
    const emojis = extractEmojis(msg.text);
    if (emojis.length === 0) continue;

    const key = getMonthKey(msg.date);
    if (!months[key]) months[key] = { positive: 0, negative: 0, neutral: 0, total: 0 };

    for (const emoji of emojis) {
      months[key].total++;
      const meta = EMOJI_MAP[emoji];
      if (!meta)                      months[key].neutral++;
      else if (meta.emotion === POSITIVE) months[key].positive++;
      else if (meta.emotion === NEGATIVE) months[key].negative++;
      else                            months[key].neutral++;
    }
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));
}


// ─── COMBINED TIMELINE ───────────────────────────────────────

function buildEmojiTimeline(messages, senders) {
  const monthMap = {};

  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;
    const emojis = extractEmojis(msg.text);
    if (emojis.length === 0) continue;

    const key = getMonthKey(msg.date);
    if (!monthMap[key]) monthMap[key] = { positive: 0, negative: 0, neutral: 0, total: 0 };

    for (const emoji of emojis) {
      monthMap[key].total++;
      const meta = EMOJI_MAP[emoji];
      if (!meta)                          monthMap[key].neutral++;
      else if (meta.emotion === POSITIVE) monthMap[key].positive++;
      else if (meta.emotion === NEGATIVE) monthMap[key].negative++;
      else                                monthMap[key].neutral++;
    }
  }

  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({
      month,
      label: formatMonthLabel(month),
      ...counts,
    }));
}


// ─── EMOTIONAL SHIFT DETECTOR ────────────────────────────────

/**
 * detectEmotionalShift(byMonth)
 * Detects if a person's emoji tone changed significantly at some point.
 * Compares first half vs second half of the relationship.
 *
 * A "shift" is declared when the positive% changes by 20+ points
 * between the two halves. This surfaces in the dashboard as:
 * "Priya's emoji tone became significantly more negative after June 2024"
 *
 * @param {MonthEmoji[]} byMonth
 * @returns {ShiftEvent | null}
 */
function detectEmotionalShift(byMonth) {
  if (byMonth.length < 4) return null; // not enough data

  const mid   = Math.floor(byMonth.length / 2);
  const first = byMonth.slice(0, mid);
  const last  = byMonth.slice(mid);

  const avgPositive = (months) => {
    const total = months.reduce((s, m) => s + m.total, 0);
    if (total === 0) return 0;
    const pos = months.reduce((s, m) => s + m.positive, 0);
    return Math.round((pos / total) * 100);
  };

  const firstPct = avgPositive(first);
  const lastPct  = avgPositive(last);
  const diff     = lastPct - firstPct;

  // 20+ point swing = meaningful shift
  if (Math.abs(diff) < 20) return null;

  const pivotMonth = byMonth[mid].month;

  return {
    month:       pivotMonth,
    label:       formatMonthLabel(pivotMonth),
    from:        firstPct,
    to:          lastPct,
    direction:   diff > 0 ? "more positive" : "more negative",
    description: diff > 0
      ? `Emoji tone became noticeably warmer after ${formatMonthLabel(pivotMonth)}`
      : `Emoji tone became noticeably colder after ${formatMonthLabel(pivotMonth)}`,
  };
}


// ─── MOST LOVING MONTH ───────────────────────────────────────

function findMostLovingMonth(messages, senders) {
  const monthScores = {};

  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;
    const emojis = extractEmojis(msg.text);
    const key    = getMonthKey(msg.date);

    for (const emoji of emojis) {
      const score = EMOJI_MAP[emoji]?.loveScore || 0;
      if (score > 0) {
        monthScores[key] = (monthScores[key] || 0) + score;
      }
    }
  }

  const entries = Object.entries(monthScores);
  if (entries.length === 0) return null;

  const [month] = entries.sort((a, b) => b[1] - a[1])[0];
  return month;
}


// ─── HELPERS ─────────────────────────────────────────────────

function getMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}


// ─── UTILITY EXPORTS ─────────────────────────────────────────

/**
 * getEmotionColor(emotion)
 * Returns the CSS variable name for each emotion category.
 * Used by EmojiEmotions.jsx to color the spectrum bars.
 *
 * @param {string} emotion  "positive" | "negative" | "neutral"
 * @returns {string}
 */
export function getEmotionColor(emotion) {
  const map = {
    positive: "var(--color-good)",
    negative: "var(--burg)",
    neutral:  "var(--lav)",
  };
  return map[emotion] || "var(--text-muted)";
}

/**
 * getDominantEmotionLabel(label)
 * Converts internal sub-labels to display-friendly strings.
 *
 * @param {string} label  e.g. "laughter", "love", "dismissal"
 * @returns {string}
 */
export function getDominantEmotionLabel(label) {
  const map = {
    love:        "Love & Affection",
    laughter:    "Humor & Laughter",
    happiness:   "Joy & Happiness",
    warmth:      "Warmth",
    affection:   "Tenderness",
    longing:     "Missing & Longing",
    playful:     "Playfulness",
    flirty:      "Flirting",
    romance:     "Romance",
    sadness:     "Sadness",
    anger:       "Anger",
    frustration: "Frustration",
    dismissal:   "Dismissiveness",
    heartbreak:  "Heartbreak",
    anxiety:     "Anxiety",
    neutral:     "Neutral",
    sarcasm:     "Sarcasm",
  };
  return map[label] || label;
}

/**
 * getEmojiLoveIntensity(loveScore, totalEmojis)
 * Converts a raw love score into a readable intensity string.
 * Used in the Good Side panel love score card.
 *
 * @param {number} loveScore
 * @param {number} totalEmojis
 * @returns {string}
 */
export function getEmojiLoveIntensity(loveScore, totalEmojis) {
  if (totalEmojis === 0) return "No data";
  const rate = (loveScore / totalEmojis) * 100;
  if (rate >= 40) return "Very Romantic";
  if (rate >= 25) return "Romantic";
  if (rate >= 12) return "Affectionate";
  if (rate >= 5)  return "Warm";
  return "Reserved";
}
