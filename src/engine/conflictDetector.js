/**
 * dilbar — engine/conflictDetector.js
 * ─────────────────────────────────────────────────────────────
 * Detects conflict events in a WhatsApp conversation using
 * three independent signals:
 *
 *   Signal 1 — Negative language spike
 *              Harsh words / phrases in EN + Hinglish
 *
 *   Signal 2 — Silence gap
 *              Unusually long pause between messages
 *              compared to the couple's OWN normal rhythm
 *
 *   Signal 3 — Cold reply pattern
 *              Sudden drop to one-word/cold responses
 *              after normal conversation flow
 *
 * A "conflict event" is declared when at least 2 of the 3
 * signals fire within the same 24-hour window.
 * This prevents false positives from a single signal alone.
 *
 * Also detects:
 *   - Recurring mistakes (phrases that appear before every fight)
 *   - Actionable fix suggestions for each recurring phrase
 *   - Per-person conflict stats
 *   - Monthly conflict timeline for the mood graph
 * ─────────────────────────────────────────────────────────────
 */

import { getMessagesBy } from "./parser.js";


// ─── CONFLICT PHRASE DICTIONARY ───────────────────────────────
/**
 * Severity levels:
 *   1 = mild tension       ("whatever", "fine")
 *   2 = clear frustration  ("leave me alone", "bakwas")
 *   3 = serious conflict   ("hate you", "it's over", "chup kar")
 *
 * Severity-1 phrases alone never trigger a conflict event —
 * they must combine with silence or cold replies to count.
 */
const CONFLICT_PHRASES = [

  // ── Dismissive / shutdown (EN) ───────────────────────────
  { phrase: "whatever",             lang: "en", severity: 1 },
  { phrase: "forget it",            lang: "en", severity: 2 },
  { phrase: "forget everything",    lang: "en", severity: 2 },
  { phrase: "never mind",           lang: "en", severity: 1 },
  { phrase: "leave me alone",       lang: "en", severity: 2 },
  { phrase: "leave me",             lang: "en", severity: 2 },
  { phrase: "just stop",            lang: "en", severity: 2 },
  { phrase: "stop it",              lang: "en", severity: 2 },
  { phrase: "i'm done",             lang: "en", severity: 3 },
  { phrase: "im done",              lang: "en", severity: 3 },
  { phrase: "done with this",       lang: "en", severity: 3 },
  { phrase: "done with you",        lang: "en", severity: 3 },
  { phrase: "i give up",            lang: "en", severity: 3 },
  { phrase: "don't talk to me",     lang: "en", severity: 3 },
  { phrase: "dont talk to me",      lang: "en", severity: 3 },
  { phrase: "not talking to you",   lang: "en", severity: 3 },

  // ── Hurtful / aggressive (EN) ────────────────────────────
  { phrase: "shut up",              lang: "en", severity: 3 },
  { phrase: "shut it",              lang: "en", severity: 3 },
  { phrase: "i hate this",          lang: "en", severity: 2 },
  { phrase: "hate you",             lang: "en", severity: 3 },
  { phrase: "i hate you",           lang: "en", severity: 3 },
  { phrase: "you never",            lang: "en", severity: 2 },
  { phrase: "you always",           lang: "en", severity: 1 },
  { phrase: "you don't care",       lang: "en", severity: 2 },
  { phrase: "you dont care",        lang: "en", severity: 2 },
  { phrase: "you don't understand", lang: "en", severity: 2 },
  { phrase: "nobody cares",         lang: "en", severity: 2 },
  { phrase: "you're selfish",       lang: "en", severity: 3 },
  { phrase: "tired of you",         lang: "en", severity: 3 },
  { phrase: "sick of this",         lang: "en", severity: 2 },
  { phrase: "fed up",               lang: "en", severity: 2 },

  // ── Breakup signals (EN) ─────────────────────────────────
  { phrase: "we're done",           lang: "en", severity: 3 },
  { phrase: "were done",            lang: "en", severity: 3 },
  { phrase: "it's over",            lang: "en", severity: 3 },
  { phrase: "its over",             lang: "en", severity: 3 },
  { phrase: "break up",             lang: "en", severity: 3 },
  { phrase: "breaking up",          lang: "en", severity: 3 },
  { phrase: "goodbye forever",      lang: "en", severity: 3 },
  { phrase: "bye forever",          lang: "en", severity: 3 },
  { phrase: "don't contact me",     lang: "en", severity: 3 },

  // ── Dismissive / shutdown (Hinglish) ─────────────────────
  { phrase: "chup kar",             lang: "hi", severity: 3 },
  { phrase: "chup raho",            lang: "hi", severity: 2 },
  { phrase: "bakwas",               lang: "hi", severity: 2 },
  { phrase: "bakwas mat kar",       lang: "hi", severity: 2 },
  { phrase: "mat baat kar",         lang: "hi", severity: 3 },
  { phrase: "baat mat karo",        lang: "hi", severity: 3 },
  { phrase: "door raho",            lang: "hi", severity: 3 },
  { phrase: "mujhe akela chodo",    lang: "hi", severity: 3 },
  { phrase: "akela rehne do",       lang: "hi", severity: 2 },
  { phrase: "bore ho gaya",         lang: "hi", severity: 1 },
  { phrase: "bore ho gayi",         lang: "hi", severity: 1 },

  // ── Frustration / blame (Hinglish) ───────────────────────
  { phrase: "pagal ho",             lang: "hi", severity: 2 },
  { phrase: "pagal hai",            lang: "hi", severity: 2 },
  { phrase: "bekar hai",            lang: "hi", severity: 2 },
  { phrase: "faltu",                lang: "hi", severity: 1 },
  { phrase: "pareshaan mat kar",    lang: "hi", severity: 2 },
  { phrase: "satao mat",            lang: "hi", severity: 2 },
  { phrase: "sab teri wajah se",    lang: "hi", severity: 3 },
  { phrase: "teri galti hai",       lang: "hi", severity: 2 },
  { phrase: "tumhari galti",        lang: "hi", severity: 2 },
  { phrase: "tu samjhta nahi",      lang: "hi", severity: 2 },
  { phrase: "tu samajhti nahi",     lang: "hi", severity: 2 },

  // ── Breakup / serious (Hinglish) ─────────────────────────
  { phrase: "tod deta hoon",        lang: "hi", severity: 3 },
  { phrase: "tod deti hoon",        lang: "hi", severity: 3 },
  { phrase: "chhod diya",           lang: "hi", severity: 3 },
  { phrase: "chhod do",             lang: "hi", severity: 3 },
  { phrase: "khatam kar",           lang: "hi", severity: 3 },
];


// ─── COLD REPLY WORDS ─────────────────────────────────────────
/**
 * Single-word cold responses that signal emotional withdrawal.
 * Only meaningful when they appear in a cluster of 3+ messages.
 */
const COLD_REPLIES = new Set([
  "ok", "okay", "k", "fine", "hmm", "hm",
  "oh", "right", "sure", "whatever",
  "haan", "ha", "theek hai", "theek",
  "accha", "acha", "haan theek",
]);


// ─── CONSTANTS ────────────────────────────────────────────────

const SILENCE_THRESHOLD_HOURS    = 3;      // minimum hours to flag as suspicious
const COLD_REPLY_STREAK_THRESHOLD = 3;     // consecutive cold replies = signal
const CONFLICT_WINDOW_MS         = 24 * 60 * 60 * 1000;  // 24 hours


// ─── MAIN FUNCTION ────────────────────────────────────────────

/**
 * detectConflicts(messages, senders)
 *
 * @param {Message[]} messages   — from parser.parse()
 * @param {string[]}  senders    — [senderA, senderB]
 *
 * @returns {ConflictResult}
 *
 * ConflictResult shape:
 * {
 *   conflictCount:      number,
 *   events:             ConflictEvent[],
 *   lastConflict:       ConflictEvent | null,
 *   longestSilence:     SilenceGap | null,
 *   avgRecoveryTime:    number,             — hours
 *   triggerWords:       TriggerWord[],      — top repeated phrases
 *   recurringMistakes:  object,             — per sender, repeated patterns
 *   conflictTimeline:   MonthPoint[],       — for chart
 *   perPerson: {
 *     [sender]: {
 *       conflictWordsUsed: number,
 *       topTrigger:        string | null,
 *       coldReplyCount:    number,
 *     }
 *   }
 * }
 *
 * ConflictEvent shape:
 * {
 *   date:           Date,
 *   dateStr:        string,       — "12 Apr 2025"
 *   signals:        string[],     — which signal types fired
 *   severity:       number,       — 1 | 2 | 3
 *   triggerWords:   string[],     — phrases that fired in this event
 *   silenceHours:   number,       — 0 if no silence signal
 *   recoveryHours:  number,       — hours until warm chat resumed
 *   initiator:      string,       — who sent conflict word first
 * }
 */
export function detectConflicts(messages, senders) {
  const [senderA, senderB] = senders;

  // Step 1 — Compute this couple's normal reply baseline
  const baselineMs = computeBaselineReplySpeed(messages);

  // Step 2 — Find all raw signals
  const negSignals    = findNegativeLanguage(messages);
  const silSignals    = findSilenceGaps(messages, baselineMs);
  const coldSignals   = findColdReplyPatterns(messages, senders);

  // Step 3 — Merge signals into conflict events
  const events = mergeIntoEvents(negSignals, silSignals, coldSignals, messages);

  // Step 4 — Per-person stats
  const perPerson = {
    [senderA]: buildPersonConflictStats(messages, senderA),
    [senderB]: buildPersonConflictStats(messages, senderB),
  };

  // Step 5 — Trigger words ranked by frequency
  const triggerWords = findTriggerWords(negSignals);

  // Step 6 — Recurring mistakes with fix suggestions
  const recurringMistakes = findRecurringMistakes(negSignals, senders);

  // Step 7 — Monthly timeline for chart
  const conflictTimeline = buildConflictTimeline(events);

  // Step 8 — Longest silence and average recovery
  const longestSilence = silSignals.length > 0
    ? silSignals.reduce((max, s) => s.hours > max.hours ? s : max)
    : null;

  const avgRecoveryTime = events.length > 0
    ? Math.round(events.reduce((s, e) => s + e.recoveryHours, 0) / events.length)
    : 0;

  return {
    conflictCount: events.length,
    events,
    lastConflict:  events.length > 0 ? events[events.length - 1] : null,
    longestSilence,
    avgRecoveryTime,
    triggerWords,
    recurringMistakes,
    conflictTimeline,
    perPerson,
  };
}


// ─── SIGNAL 1: NEGATIVE LANGUAGE ─────────────────────────────

function findNegativeLanguage(messages) {
  const signals = [];

  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;
    const text = msg.text.toLowerCase();

    const matched = [];
    let maxSeverity = 0;

    for (const { phrase, severity } of CONFLICT_PHRASES) {
      if (text.includes(phrase)) {
        matched.push({ phrase, severity });
        maxSeverity = Math.max(maxSeverity, severity);
      }
    }

    if (matched.length > 0) {
      signals.push({
        type:      "negative_language",
        timestamp: msg.timestamp,
        date:      msg.date,
        sender:    msg.sender,
        severity:  maxSeverity,
        phrases:   matched,
      });
    }
  }

  return signals;
}


// ─── SIGNAL 2: SILENCE GAPS ──────────────────────────────────

/**
 * computeBaselineReplySpeed()
 * Finds the median gap between messages — the couple's personal
 * "normal" rhythm. This makes silence detection relative to them,
 * not to some universal standard.
 *
 * A couple who normally replies in 5 minutes has a very different
 * "suspicious silence" than one who replies every few hours.
 */
function computeBaselineReplySpeed(messages) {
  const gaps = [];

  for (let i = 1; i < messages.length; i++) {
    const gap = messages[i].timestamp - messages[i - 1].timestamp;
    // Only consider gaps under 4 hours as "normal" reply time
    if (gap > 0 && gap < 4 * 60 * 60 * 1000) gaps.push(gap);
  }

  if (gaps.length === 0) return 30 * 60 * 1000; // fallback: 30 min

  // Median is more reliable than average here
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 !== 0
    ? gaps[mid]
    : (gaps[mid - 1] + gaps[mid]) / 2;
}

function findSilenceGaps(messages, baselineMs) {
  const signals = [];

  // Threshold = whichever is larger:
  // the absolute minimum (3 hours) OR 10x their normal speed
  const threshold = Math.max(
    SILENCE_THRESHOLD_HOURS * 60 * 60 * 1000,
    baselineMs * 10
  );

  for (let i = 1; i < messages.length; i++) {
    const gap = messages[i].timestamp - messages[i - 1].timestamp;

    if (gap >= threshold) {
      const hours = parseFloat((gap / (60 * 60 * 1000)).toFixed(1));
      signals.push({
        type:      "silence_gap",
        timestamp: messages[i - 1].timestamp,
        date:      messages[i - 1].date,
        severity:  hours >= 12 ? 3 : hours >= 6 ? 2 : 1,
        hours,
        beforeMsg: messages[i - 1],
        afterMsg:  messages[i],
      });
    }
  }

  return signals;
}


// ─── SIGNAL 3: COLD REPLY PATTERNS ───────────────────────────

function findColdReplyPatterns(messages, senders) {
  const signals = [];

  for (const sender of senders) {
    const senderMsgs = messages.filter(m => m.sender === sender);
    let streak = 0;
    let streakStart = null;

    for (const msg of senderMsgs) {
      if (msg.isMedia) { streak = 0; streakStart = null; continue; }

      const text    = msg.text.trim().toLowerCase();
      const isCold  = COLD_REPLIES.has(text) ||
                      (msg.wordCount <= 2 && text.length <= 8);

      if (isCold) {
        streak++;
        if (!streakStart) streakStart = msg;

        if (streak >= COLD_REPLY_STREAK_THRESHOLD) {
          signals.push({
            type:      "cold_replies",
            timestamp: streakStart.timestamp,
            date:      streakStart.date,
            sender,
            severity:  2,
            streakLen: streak,
          });
          // Reset to avoid counting the same streak twice
          streak = 0;
          streakStart = null;
        }
      } else {
        streak = 0;
        streakStart = null;
      }
    }
  }

  return signals;
}


// ─── MERGE INTO CONFLICT EVENTS ──────────────────────────────

/**
 * mergeIntoEvents()
 * Combines all signals that fall within 24 hours of each other
 * into a single conflict event.
 *
 * A group becomes a conflict event if:
 *   - It has 2+ different signal types, OR
 *   - It contains at least one severity-3 signal
 *
 * This dual requirement prevents a single "ok" or one "whatever"
 * from triggering a false conflict event.
 */
function mergeIntoEvents(negSignals, silSignals, coldSignals, messages) {
  const all = [...negSignals, ...silSignals, ...coldSignals]
    .sort((a, b) => a.timestamp - b.timestamp);

  if (all.length === 0) return [];

  const events = [];
  let group = [all[0]];
  let windowStart = all[0].timestamp;

  for (let i = 1; i < all.length; i++) {
    if (all[i].timestamp - windowStart <= CONFLICT_WINDOW_MS) {
      group.push(all[i]);
    } else {
      const event = buildEvent(group, messages);
      if (event) events.push(event);
      group = [all[i]];
      windowStart = all[i].timestamp;
    }
  }

  const last = buildEvent(group, messages);
  if (last) events.push(last);

  return events.sort((a, b) => a.date - b.date);
}

function buildEvent(group, messages) {
  const types   = new Set(group.map(s => s.type));
  const maxSev  = Math.max(...group.map(s => s.severity));
  const hasSev3 = group.some(s => s.severity >= 3);

  // Require 2+ signal types OR one severity-3 signal
  if (types.size < 2 && !hasSev3) return null;

  const first = group[0];

  const triggerWords = group
    .filter(s => s.type === "negative_language")
    .flatMap(s => s.phrases.map(p => p.phrase));

  const initiator = group.find(s => s.sender)?.sender || "Unknown";

  const silenceSignal = group.find(s => s.type === "silence_gap");
  const silenceHours  = silenceSignal ? silenceSignal.hours : 0;

  const lastTs       = Math.max(...group.map(s => s.timestamp));
  const recoveryHours = computeRecovery(lastTs, messages);

  return {
    date:         first.date,
    dateStr:      formatDate(first.date),
    signals:      [...types],
    severity:     maxSev,
    triggerWords: [...new Set(triggerWords)],
    silenceHours,
    recoveryHours,
    initiator,
  };
}

function computeRecovery(fromTimestamp, messages) {
  // First warm message (5+ words) after the conflict timestamp
  const warm = messages
    .filter(m => m.timestamp > fromTimestamp && m.wordCount >= 5 && !m.isMedia)
    [0];
  if (!warm) return 0;
  return parseFloat(
    ((warm.timestamp - fromTimestamp) / (60 * 60 * 1000)).toFixed(1)
  );
}


// ─── TRIGGER WORDS ───────────────────────────────────────────

function findTriggerWords(negSignals) {
  const counts = {};
  for (const s of negSignals) {
    for (const { phrase } of s.phrases) {
      counts[phrase] = (counts[phrase] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));
}


// ─── RECURRING MISTAKES ──────────────────────────────────────

/**
 * findRecurringMistakes()
 * Finds phrases that a person uses repeatedly before conflicts.
 * Each mistake comes with a concrete, specific fix suggestion.
 * These power the "Actionable Tips" section of the dashboard.
 */
function findRecurringMistakes(negSignals, senders) {
  const result = {};

  for (const sender of senders) {
    const senderSignals = negSignals.filter(s => s.sender === sender);
    const phraseCounts  = {};

    for (const s of senderSignals) {
      for (const { phrase } of s.phrases) {
        phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
      }
    }

    // Only flag as "recurring" if it appears 2+ times
    const mistakes = Object.entries(phraseCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([phrase, count]) => ({
        phrase,
        count,
        sender,
        suggestion: generateFixSuggestion(phrase),
      }));

    if (mistakes.length > 0) result[sender] = mistakes;
  }

  return result;
}

/**
 * generateFixSuggestion(phrase)
 * Returns a specific, actionable alternative for common trigger phrases.
 * This is what makes the tip cards feel personal and genuinely useful
 * rather than generic relationship advice.
 */
function generateFixSuggestion(phrase) {
  const map = {
    "whatever":
      "Try 'I need a moment to think' — it keeps the door open instead of shutting down.",
    "forget it":
      "'Let's come back to this when I'm calmer' lands softer than closing the topic.",
    "shut up":
      "Replace with 'I need quiet right now' — same need, far less damage.",
    "leave me alone":
      "Try 'Give me an hour, I'll come back to you' — it's honest without being final.",
    "i'm done":
      "'I'm overwhelmed right now' is more accurate and doesn't sound permanent.",
    "done with you":
      "'I need space right now' says the same thing without the finality.",
    "you never":
      "Replace 'you never' with 'I feel like' — it removes the accusation entirely.",
    "you always":
      "Try 'I've noticed sometimes…' — it's the same observation without the blame.",
    "i hate you":
      "In a fight this is rarely true. 'I'm really hurt right now' is more honest.",
    "it's over":
      "Only say this if you mean it. If not — 'I need a break from this conversation.'",
    "chup kar":
      "'Mujhe thodi der chahiye' communicates the same need without the sting.",
    "bakwas":
      "'Main is topic pe abhi baat nahi kar sakta/sakti' is firm without being dismissive.",
    "mat baat kar":
      "'Mujhe kuch waqt do' keeps them in your life while asking for space.",
    "pagal hai":
      "This dismisses their feelings entirely. Try 'Main is baat se agree nahi karta/karti.'",
    "teri galti hai":
      "Replace blame with feeling — 'Jab aisa hota hai, mujhe bura lagta hai.'",
    "sab teri wajah se":
      "Blame always escalates. 'Main is situation se bahut frustrated hoon' is more honest.",
    "chhod do":
      "'Mujhe thoda space chahiye abhi' says what you actually need.",
  };

  return map[phrase] ||
    `When the urge to say "${phrase}" hits, pause for 60 seconds. Write it, don't send it.`;
}


// ─── PER PERSON STATS ────────────────────────────────────────

function buildPersonConflictStats(messages, sender) {
  const senderMsgs   = messages.filter(m => m.sender === sender);
  const phraseCounts = {};
  let conflictWords  = 0;
  let coldReplyCount = 0;

  for (const msg of senderMsgs) {
    if (msg.isMedia || !msg.text) continue;
    const text = msg.text.toLowerCase();

    for (const { phrase } of CONFLICT_PHRASES) {
      if (text.includes(phrase)) {
        conflictWords++;
        phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
      }
    }

    const t = msg.text.trim().toLowerCase();
    if (COLD_REPLIES.has(t) || (msg.wordCount <= 2 && t.length <= 8)) {
      coldReplyCount++;
    }
  }

  const topTrigger = Object.entries(phraseCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return { conflictWordsUsed: conflictWords, topTrigger, coldReplyCount };
}


// ─── CONFLICT TIMELINE ───────────────────────────────────────

function buildConflictTimeline(events) {
  const counts = {};

  for (const event of events) {
    const y = event.date.getFullYear();
    const m = String(event.date.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, conflicts]) => ({
      month,
      label: formatMonthLabel(month),
      conflicts,
    }));
}


// ─── HELPERS ─────────────────────────────────────────────────

function formatDate(date) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}


// ─── UTILITY EXPORTS ─────────────────────────────────────────

/**
 * getConflictFrequencyLabel(conflictCount, totalMonths)
 * Turns a raw number into a human-readable frequency label.
 * Used in the Bad Side panel header.
 *
 * @param {number} conflictCount
 * @param {number} totalMonths
 * @returns {string}
 */
export function getConflictFrequencyLabel(conflictCount, totalMonths) {
  if (totalMonths === 0) return "Unknown";
  const rate = conflictCount / totalMonths;
  if (rate >= 4)   return "Very Frequent";
  if (rate >= 2)   return "Frequent";
  if (rate >= 1)   return "Occasional";
  if (rate >= 0.5) return "Rare";
  return "Very Rare";
}

/**
 * getSeverityLabel(severity)
 * @param {number} severity  1 | 2 | 3
 * @returns {string}
 */
export function getSeverityLabel(severity) {
  if (severity >= 3) return "Serious";
  if (severity >= 2) return "Moderate";
  return "Mild";
}
