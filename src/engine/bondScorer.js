/**
 * dilbar — engine/bondScorer.js
 * ─────────────────────────────────────────────────────────────
 * Calculates a 0–100 bond strength score from three measurable
 * factors in the conversation:
 *
 *   Factor 1 — Responsiveness  (weight: 35%)
 *              How quickly each person replies on average.
 *              Faster consistent replies = higher score.
 *
 *   Factor 2 — Consistency     (weight: 35%)
 *              How regularly they chat across the full period.
 *              Steady daily presence beats intense-then-silent.
 *
 *   Factor 3 — Depth           (weight: 30%)
 *              Average message length and conversation thread
 *              length. Deep conversations = stronger bond.
 *
 * Each factor is scored 0–100 independently, then combined
 * using the weights above into one final bond score.
 *
 * Also produces:
 *   - Per-person contribution to each factor
 *   - Factor breakdown for the score card tooltip
 *   - Month-by-month bond score for trend graph
 *   - Bond strength label and description
 * ─────────────────────────────────────────────────────────────
 */

import { getMessagesBy, groupByMonth, groupByDay } from "./parser.js";


// ─── SCORING WEIGHTS ─────────────────────────────────────────
const WEIGHT_RESPONSIVENESS = 0.35;
const WEIGHT_CONSISTENCY    = 0.35;
const WEIGHT_DEPTH          = 0.30;


// ─── THRESHOLDS ──────────────────────────────────────────────

// Responsiveness — reply time thresholds in minutes
const REPLY_EXCELLENT  = 5;    // under 5 min  → 100
const REPLY_GOOD       = 15;   // under 15 min → ~80
const REPLY_AVERAGE    = 60;   // under 1 hr   → ~60
const REPLY_SLOW       = 240;  // under 4 hrs  → ~30
// over 4 hours average → low score

// Consistency — active days per month thresholds
const ACTIVE_DAYS_EXCELLENT = 25;  // 25+ days/month → 100
const ACTIVE_DAYS_GOOD      = 18;  // 18–24 days     → ~80
const ACTIVE_DAYS_AVERAGE   = 10;  // 10–17 days     → ~55
// under 10 days/month → low score

// Depth — average words per message thresholds
const DEPTH_EXCELLENT = 20;   // 20+ words avg → 100
const DEPTH_GOOD      = 10;   // 10–19 words   → ~75
const DEPTH_AVERAGE   = 5;    // 5–9 words     → ~50
// under 5 words avg → low score


// ─── MAIN FUNCTION ────────────────────────────────────────────

/**
 * calculateBondScore(messages, senders, dateRange)
 *
 * @param {Message[]} messages    — from parser.parse()
 * @param {string[]}  senders     — [senderA, senderB]
 * @param {object}    dateRange   — { start: Date, end: Date }
 *
 * @returns {BondResult}
 *
 * BondResult shape:
 * {
 *   score:           number,       — 0–100 overall bond score
 *   label:           string,       — "Strong", "Healthy", etc.
 *   description:     string,       — one sentence about the bond
 *   factors: {
 *     responsiveness: FactorScore,
 *     consistency:    FactorScore,
 *     depth:          FactorScore,
 *   },
 *   perPerson: {
 *     [sender]: {
 *       avgReplyMinutes:  number,
 *       initiationRate:   number,  — % of conversations started
 *       avgMessageLength: number,  — words per message
 *       activeDaysRate:   number,  — % of days with messages
 *     }
 *   },
 *   monthlyScores:   MonthScore[], — for trend graph
 *   balanceScore:    number,       — 0–100, how equal the effort is
 *   dominantSender:  string,       — who contributes more to the bond
 * }
 *
 * FactorScore shape:
 * {
 *   score:      number,    — 0–100 for this factor
 *   raw:        number,    — raw measurement (minutes, days, words)
 *   label:      string,    — "Excellent" | "Good" | "Average" | "Needs work"
 *   weight:     number,    — this factor's weight in final score
 *   contribution: number,  — weighted contribution to final score
 * }
 */
export function calculateBondScore(messages, senders, dateRange) {
  const [senderA, senderB] = senders;

  if (!messages || messages.length === 0) {
    return emptyResult(senders);
  }

  // ── Factor 1: Responsiveness ──────────────────────────────
  const responsivenessData = scoreResponsiveness(messages, senders);

  // ── Factor 2: Consistency ─────────────────────────────────
  const consistencyData = scoreConsistency(messages, dateRange);

  // ── Factor 3: Depth ───────────────────────────────────────
  const depthData = scoreDepth(messages, senders);

  // ── Weighted final score ──────────────────────────────────
  const finalScore = Math.round(
    responsivenessData.score * WEIGHT_RESPONSIVENESS +
    consistencyData.score    * WEIGHT_CONSISTENCY    +
    depthData.score          * WEIGHT_DEPTH
  );

  // ── Per-person stats ──────────────────────────────────────
  const perPerson = {
    [senderA]: buildPersonStats(messages, senderA, senderB),
    [senderB]: buildPersonStats(messages, senderB, senderA),
  };

  // ── Balance score — how equal is the effort ───────────────
  const countA = messages.filter(m => m.sender === senderA).length;
  const countB = messages.filter(m => m.sender === senderB).length;
  const total  = countA + countB;
  const ratioA = total > 0 ? countA / total : 0.5;
  // 0.5 = perfectly equal, 0 or 1 = one person carries everything
  // Score: 100 when equal, drops as imbalance grows
  const balanceScore = Math.round(100 - Math.abs(ratioA - 0.5) * 200);

  const dominantSender = countA >= countB ? senderA : senderB;

  // ── Monthly bond scores ───────────────────────────────────
  const monthlyScores = buildMonthlyScores(messages, senders, dateRange);

  return {
    score:       Math.min(100, Math.max(0, finalScore)),
    label:       getBondLabel(finalScore),
    description: getBondDescription(finalScore, senders),
    factors: {
      responsiveness: {
        ...responsivenessData,
        weight:       WEIGHT_RESPONSIVENESS,
        contribution: Math.round(responsivenessData.score * WEIGHT_RESPONSIVENESS),
      },
      consistency: {
        ...consistencyData,
        weight:       WEIGHT_CONSISTENCY,
        contribution: Math.round(consistencyData.score * WEIGHT_CONSISTENCY),
      },
      depth: {
        ...depthData,
        weight:       WEIGHT_DEPTH,
        contribution: Math.round(depthData.score * WEIGHT_DEPTH),
      },
    },
    perPerson,
    monthlyScores,
    balanceScore,
    dominantSender,
  };
}


// ─── FACTOR 1: RESPONSIVENESS ────────────────────────────────

/**
 * scoreResponsiveness()
 * Measures how quickly messages get replies on average.
 * Only counts reply gaps under 4 hours — overnight gaps and
 * long silences are excluded so they don't unfairly drag the score.
 *
 * Uses the median rather than average to resist outliers
 * (one 8-hour gap shouldn't define a couple's responsiveness).
 */
function scoreResponsiveness(messages, senders) {
  const replyGaps = []; // in minutes

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];

    // Only count cross-sender replies (A → B or B → A)
    if (prev.sender === curr.sender) continue;

    const gapMinutes = (curr.timestamp - prev.timestamp) / (1000 * 60);

    // Exclude overnight gaps and very long silences
    if (gapMinutes > 0 && gapMinutes <= 240) {
      replyGaps.push(gapMinutes);
    }
  }

  if (replyGaps.length === 0) {
    return { score: 50, raw: 0, label: "Unknown" };
  }

  // Median reply time
  replyGaps.sort((a, b) => a - b);
  const mid = Math.floor(replyGaps.length / 2);
  const medianMinutes = replyGaps.length % 2 !== 0
    ? replyGaps[mid]
    : (replyGaps[mid - 1] + replyGaps[mid]) / 2;

  // Convert to 0–100 score using a smooth decay curve
  let score;
  if      (medianMinutes <= REPLY_EXCELLENT) score = 100;
  else if (medianMinutes <= REPLY_GOOD)      score = 90 - ((medianMinutes - REPLY_EXCELLENT) / (REPLY_GOOD - REPLY_EXCELLENT)) * 15;
  else if (medianMinutes <= REPLY_AVERAGE)   score = 75 - ((medianMinutes - REPLY_GOOD) / (REPLY_AVERAGE - REPLY_GOOD)) * 20;
  else if (medianMinutes <= REPLY_SLOW)      score = 55 - ((medianMinutes - REPLY_AVERAGE) / (REPLY_SLOW - REPLY_AVERAGE)) * 30;
  else                                        score = Math.max(5, 25 - (medianMinutes - REPLY_SLOW) / 60 * 5);

  return {
    score: Math.round(score),
    raw:   Math.round(medianMinutes),
    label: getFactorLabel(Math.round(score)),
  };
}


// ─── FACTOR 2: CONSISTENCY ───────────────────────────────────

/**
 * scoreConsistency()
 * Measures how regularly the couple chats across the full period.
 *
 * Method: count active days per month, find the average,
 * then score based on how many days per month they typically talk.
 *
 * A couple who chats every single day scores close to 100.
 * A couple who has intense bursts but then disappears for weeks
 * scores much lower — because consistency is what builds a bond.
 */
function scoreConsistency(messages, dateRange) {
  if (!dateRange) return { score: 50, raw: 0, label: "Unknown" };

  const byDay     = groupByDay(messages);
  const activeDays = Object.keys(byDay).length;

  // Total months in the relationship
  const startMs   = dateRange.start.getTime();
  const endMs     = dateRange.end.getTime();
  const months    = Math.max(1, Math.round((endMs - startMs) / (30 * 24 * 60 * 60 * 1000)));

  const avgActiveDaysPerMonth = activeDays / months;

  let score;
  if      (avgActiveDaysPerMonth >= ACTIVE_DAYS_EXCELLENT) score = 100;
  else if (avgActiveDaysPerMonth >= ACTIVE_DAYS_GOOD)
    score = 80 + ((avgActiveDaysPerMonth - ACTIVE_DAYS_GOOD) / (ACTIVE_DAYS_EXCELLENT - ACTIVE_DAYS_GOOD)) * 20;
  else if (avgActiveDaysPerMonth >= ACTIVE_DAYS_AVERAGE)
    score = 50 + ((avgActiveDaysPerMonth - ACTIVE_DAYS_AVERAGE) / (ACTIVE_DAYS_GOOD - ACTIVE_DAYS_AVERAGE)) * 30;
  else
    score = Math.max(5, (avgActiveDaysPerMonth / ACTIVE_DAYS_AVERAGE) * 50);

  return {
    score: Math.round(score),
    raw:   parseFloat(avgActiveDaysPerMonth.toFixed(1)),
    label: getFactorLabel(Math.round(score)),
  };
}


// ─── FACTOR 3: DEPTH ─────────────────────────────────────────

/**
 * scoreDepth()
 * Measures the quality of conversation — not just that they talk,
 * but that they say something meaningful when they do.
 *
 * Two sub-metrics averaged together:
 *   A) Average words per message (excludes media, single-emoji msgs)
 *   B) Average conversation thread length (back-and-forth exchanges)
 *
 * A "conversation" starts when there's a gap > 1 hour since the
 * last message. Thread length = messages in that conversation.
 */
function scoreDepth(messages, senders) {
  // Sub-metric A: average words per message
  const textMessages = messages.filter(
    m => !m.isMedia && m.text && m.wordCount >= 2
  );

  const avgWords = textMessages.length > 0
    ? textMessages.reduce((s, m) => s + m.wordCount, 0) / textMessages.length
    : 0;

  let wordScore;
  if      (avgWords >= DEPTH_EXCELLENT) wordScore = 100;
  else if (avgWords >= DEPTH_GOOD)
    wordScore = 70 + ((avgWords - DEPTH_GOOD) / (DEPTH_EXCELLENT - DEPTH_GOOD)) * 30;
  else if (avgWords >= DEPTH_AVERAGE)
    wordScore = 40 + ((avgWords - DEPTH_AVERAGE) / (DEPTH_GOOD - DEPTH_AVERAGE)) * 30;
  else
    wordScore = Math.max(5, (avgWords / DEPTH_AVERAGE) * 40);

  // Sub-metric B: average conversation thread length
  const threads         = groupIntoConversations(messages);
  const avgThreadLength = threads.length > 0
    ? threads.reduce((s, t) => s + t.length, 0) / threads.length
    : 0;

  // Thread score: 10+ exchanges per conversation = 100
  const threadScore = Math.min(100, Math.round((avgThreadLength / 10) * 100));

  // Combined depth score
  const score = Math.round((wordScore + threadScore) / 2);

  return {
    score: Math.min(100, score),
    raw:   parseFloat(avgWords.toFixed(1)),
    label: getFactorLabel(score),
  };
}

/**
 * groupIntoConversations()
 * Splits the message array into conversation sessions.
 * A new conversation begins after a 1-hour gap in messages.
 * Returns an array of arrays (each inner array = one conversation).
 */
function groupIntoConversations(messages) {
  if (messages.length === 0) return [];

  const GAP = 60 * 60 * 1000; // 1 hour in ms
  const conversations = [];
  let current = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const gap = messages[i].timestamp - messages[i - 1].timestamp;
    if (gap > GAP) {
      conversations.push(current);
      current = [messages[i]];
    } else {
      current.push(messages[i]);
    }
  }

  if (current.length > 0) conversations.push(current);
  return conversations;
}


// ─── PER-PERSON STATS ────────────────────────────────────────

/**
 * buildPersonStats()
 * Computes individual contribution stats for each person.
 * These appear in the bond score breakdown card.
 */
function buildPersonStats(messages, sender, otherSender) {
  const senderMsgs = messages.filter(m => m.sender === sender);
  const total      = messages.length;

  // Average message length
  const textMsgs   = senderMsgs.filter(m => !m.isMedia && m.wordCount > 0);
  const avgLength  = textMsgs.length > 0
    ? parseFloat((textMsgs.reduce((s, m) => s + m.wordCount, 0) / textMsgs.length).toFixed(1))
    : 0;

  // Initiation rate — how often this person starts a new conversation
  const conversations = groupIntoConversations(messages);
  const initiated = conversations.filter(c => c[0].sender === sender).length;
  const initiationRate = conversations.length > 0
    ? Math.round((initiated / conversations.length) * 100)
    : 50;

  // Active days rate
  const byDay = groupByDay(senderMsgs);
  const activeDays = Object.keys(byDay).length;

  // Average reply time to the other person (minutes)
  const replyGaps = [];
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].sender === sender && messages[i - 1].sender === otherSender) {
      const gap = (messages[i].timestamp - messages[i - 1].timestamp) / (1000 * 60);
      if (gap > 0 && gap <= 240) replyGaps.push(gap);
    }
  }

  const avgReplyMinutes = replyGaps.length > 0
    ? Math.round(replyGaps.reduce((s, g) => s + g, 0) / replyGaps.length)
    : 0;

  return {
    messageCount:     senderMsgs.length,
    messageShare:     total > 0 ? Math.round((senderMsgs.length / total) * 100) : 0,
    avgMessageLength: avgLength,
    initiationRate,
    activeDays,
    avgReplyMinutes,
  };
}


// ─── MONTHLY BOND SCORES ─────────────────────────────────────

/**
 * buildMonthlyScores()
 * Calculates the bond score for each month independently.
 * This powers the "Bond Trend" line on the mood graph.
 * Shows whether the relationship is getting stronger or weaker.
 */
function buildMonthlyScores(messages, senders, dateRange) {
  const byMonth = groupByMonth(messages);
  const months  = Object.keys(byMonth).sort();

  if (months.length < 2) return [];

  return months.map(month => {
    const monthMsgs = byMonth[month];

    // Mini date range for this month
    const timestamps = monthMsgs.map(m => m.timestamp);
    const miniRange  = {
      start: new Date(Math.min(...timestamps)),
      end:   new Date(Math.max(...timestamps)),
    };

    // Calculate each factor for this month only
    const resp = scoreResponsiveness(monthMsgs, senders);
    const cons = scoreConsistency(monthMsgs, miniRange);
    const dep  = scoreDepth(monthMsgs, senders);

    const score = Math.round(
      resp.score * WEIGHT_RESPONSIVENESS +
      cons.score * WEIGHT_CONSISTENCY    +
      dep.score  * WEIGHT_DEPTH
    );

    return {
      month,
      label: formatMonthLabel(month),
      score: Math.min(100, Math.max(0, score)),
    };
  });
}


// ─── LABEL GENERATORS ────────────────────────────────────────

/**
 * getBondLabel(score)
 * Maps a 0–100 score to a human-readable strength label.
 * Displayed prominently under the score number on the dashboard.
 */
export function getBondLabel(score) {
  if (score >= 85) return "Exceptional";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Healthy";
  if (score >= 40) return "Developing";
  if (score >= 25) return "Strained";
  return "Needs Attention";
}

/**
 * getBondDescription(score, senders)
 * One-sentence description of what the score means.
 * Used as the subtitle under the bond score card.
 */
function getBondDescription(score, senders) {
  const [a, b] = senders;
  if (score >= 85)
    return `${a} and ${b} show an exceptional level of care, presence, and depth in their conversations.`;
  if (score >= 70)
    return `A strong, consistent bond — both people show up reliably and communicate with genuine depth.`;
  if (score >= 55)
    return `A healthy relationship with room to grow — consistent presence but depth could be deeper.`;
  if (score >= 40)
    return `The bond is developing but uneven — one person may be carrying more of the effort.`;
  if (score >= 25)
    return `The connection shows signs of strain — gaps in communication and effort are visible.`;
  return `The conversation patterns suggest the bond needs active attention and more consistent effort.`;
}

function getFactorLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  return "Needs work";
}


// ─── HELPERS ─────────────────────────────────────────────────

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function emptyResult(senders) {
  const [a, b] = senders;
  return {
    score: 0, label: "No data", description: "Not enough messages to calculate.",
    factors: {
      responsiveness: { score: 0, raw: 0, label: "Unknown", weight: WEIGHT_RESPONSIVENESS, contribution: 0 },
      consistency:    { score: 0, raw: 0, label: "Unknown", weight: WEIGHT_CONSISTENCY,    contribution: 0 },
      depth:          { score: 0, raw: 0, label: "Unknown", weight: WEIGHT_DEPTH,          contribution: 0 },
    },
    perPerson:     { [a]: {}, [b]: {} },
    monthlyScores: [],
    balanceScore:  0,
    dominantSender: a,
  };
}


// ─── UTILITY EXPORT ──────────────────────────────────────────

/**
 * getBalanceLabel(balanceScore)
 * Describes how balanced the effort is between the two people.
 *
 * @param {number} balanceScore  0–100
 * @returns {string}
 */
export function getBalanceLabel(balanceScore) {
  if (balanceScore >= 85) return "Very Balanced";
  if (balanceScore >= 65) return "Mostly Balanced";
  if (balanceScore >= 45) return "Slightly Uneven";
  if (balanceScore >= 25) return "Uneven";
  return "One-Sided";
}
