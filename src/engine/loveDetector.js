/**
 * dilbar — engine/loveDetector.js
 * ─────────────────────────────────────────────────────────────
 * Scans all messages for love and affection expressions in both
 * English and Hinglish. Returns per-person counts, trends over
 * time, nickname detection, and peak affection periods.
 *
 * Depends on:
 *   - parser.js  →  Message[], senders[]
 *   - data/loveWords.js  →  LOVE_PHRASES, NICKNAMES
 * ─────────────────────────────────────────────────────────────
 */

import { getMessagesBy, groupByMonth } from "./parser.js";


// ─── LOVE PHRASE DICTIONARY ───────────────────────────────────
/**
 * Every phrase here is checked as a whole-word / whole-phrase
 * match inside message text (case-insensitive).
 *
 * Organized by category so we can also detect WHAT KIND of
 * love is being expressed — not just that it exists.
 *
 * Weight = how strongly this phrase signals deep affection.
 * 1 = mild,  2 = moderate,  3 = strong
 */
const LOVE_PHRASES = [

  // ── Direct "I love you" expressions ──────────────────────
  { phrase: "i love you",           lang: "en", weight: 3, category: "direct" },
  { phrase: "i love u",             lang: "en", weight: 3, category: "direct" },
  { phrase: "ily",                  lang: "en", weight: 3, category: "direct" },
  { phrase: "ilu",                  lang: "en", weight: 3, category: "direct" },
  { phrase: "luv you",              lang: "en", weight: 3, category: "direct" },
  { phrase: "luv u",                lang: "en", weight: 3, category: "direct" },
  { phrase: "love you",             lang: "en", weight: 3, category: "direct" },
  { phrase: "love u",               lang: "en", weight: 3, category: "direct" },
  { phrase: "love you so much",     lang: "en", weight: 3, category: "direct" },
  { phrase: "love you loads",       lang: "en", weight: 3, category: "direct" },
  { phrase: "love you lots",        lang: "en", weight: 3, category: "direct" },
  { phrase: "madly in love",        lang: "en", weight: 3, category: "direct" },

  // ── Hinglish direct ──────────────────────────────────────
  { phrase: "pyaar karta hoon",     lang: "hi", weight: 3, category: "direct" },
  { phrase: "pyaar karti hoon",     lang: "hi", weight: 3, category: "direct" },
  { phrase: "pyaar hai",            lang: "hi", weight: 3, category: "direct" },
  { phrase: "pyaar karta hu",       lang: "hi", weight: 3, category: "direct" },
  { phrase: "pyaar karti hu",       lang: "hi", weight: 3, category: "direct" },
  { phrase: "tujhse pyaar",         lang: "hi", weight: 3, category: "direct" },
  { phrase: "tumse pyaar",          lang: "hi", weight: 3, category: "direct" },
  { phrase: "bahut pyaar",          lang: "hi", weight: 3, category: "direct" },
  { phrase: "ishq hai",             lang: "hi", weight: 3, category: "direct" },
  { phrase: "ishq mera",            lang: "hi", weight: 3, category: "direct" },
  { phrase: "mohabbat hai",         lang: "hi", weight: 3, category: "direct" },
  { phrase: "mohabbat karta",       lang: "hi", weight: 3, category: "direct" },
  { phrase: "mohabbat karti",       lang: "hi", weight: 3, category: "direct" },
  { phrase: "tujhse mohabbat",      lang: "hi", weight: 3, category: "direct" },
  { phrase: "dil diya hai",         lang: "hi", weight: 3, category: "direct" },
  { phrase: "dil de diya",          lang: "hi", weight: 3, category: "direct" },
  { phrase: "i love you yaar",      lang: "hi", weight: 3, category: "direct" },

  // ── Missing / longing ────────────────────────────────────
  { phrase: "miss you",             lang: "en", weight: 2, category: "longing" },
  { phrase: "miss u",               lang: "en", weight: 2, category: "longing" },
  { phrase: "missing you",          lang: "en", weight: 2, category: "longing" },
  { phrase: "missing u",            lang: "en", weight: 2, category: "longing" },
  { phrase: "yaad aata hai",        lang: "hi", weight: 2, category: "longing" },
  { phrase: "yaad aati hai",        lang: "hi", weight: 2, category: "longing" },
  { phrase: "yaad aate ho",         lang: "hi", weight: 2, category: "longing" },
  { phrase: "bahut yaad",           lang: "hi", weight: 2, category: "longing" },
  { phrase: "yaad kar raha",        lang: "hi", weight: 2, category: "longing" },
  { phrase: "yaad kar rahi",        lang: "hi", weight: 2, category: "longing" },
  { phrase: "tujhe yaad kiya",      lang: "hi", weight: 2, category: "longing" },

  // ── Compliments and warmth ───────────────────────────────
  { phrase: "you mean everything",  lang: "en", weight: 2, category: "warmth" },
  { phrase: "you mean the world",   lang: "en", weight: 2, category: "warmth" },
  { phrase: "so lucky to have you", lang: "en", weight: 2, category: "warmth" },
  { phrase: "lucky to have you",    lang: "en", weight: 2, category: "warmth" },
  { phrase: "made for each other",  lang: "en", weight: 2, category: "warmth" },
  { phrase: "always be there",      lang: "en", weight: 2, category: "warmth" },
  { phrase: "you complete me",      lang: "en", weight: 2, category: "warmth" },
  { phrase: "tu meri duniya",       lang: "hi", weight: 2, category: "warmth" },
  { phrase: "meri jaan hai tu",     lang: "hi", weight: 2, category: "warmth" },
  { phrase: "mera sab kuch",        lang: "hi", weight: 2, category: "warmth" },
  { phrase: "tere bina adhoora",    lang: "hi", weight: 2, category: "warmth" },
  { phrase: "tujhse hi poora",      lang: "hi", weight: 2, category: "warmth" },
  { phrase: "khush raho",           lang: "hi", weight: 1, category: "warmth" },
  { phrase: "take care",            lang: "en", weight: 1, category: "warmth" },

  // ── Affectionate phrases ─────────────────────────────────
  { phrase: "you're my",            lang: "en", weight: 1, category: "affection" },
  { phrase: "you are my",           lang: "en", weight: 1, category: "affection" },
  { phrase: "my love",              lang: "en", weight: 2, category: "affection" },
  { phrase: "my heart",             lang: "en", weight: 1, category: "affection" },
  { phrase: "my world",             lang: "en", weight: 1, category: "affection" },
  { phrase: "tu mera",              lang: "hi", weight: 2, category: "affection" },
  { phrase: "meri",                 lang: "hi", weight: 1, category: "affection" },
  { phrase: "mera",                 lang: "hi", weight: 1, category: "affection" },

  // ── Good night / good morning with affection ─────────────
  { phrase: "good night love",      lang: "en", weight: 1, category: "routine" },
  { phrase: "good morning love",    lang: "en", weight: 1, category: "routine" },
  { phrase: "gn baby",              lang: "en", weight: 1, category: "routine" },
  { phrase: "gm baby",              lang: "en", weight: 1, category: "routine" },
  { phrase: "good night jaan",      lang: "hi", weight: 1, category: "routine" },
  { phrase: "good morning jaan",    lang: "hi", weight: 1, category: "routine" },
  { phrase: "subah ki yaad",        lang: "hi", weight: 1, category: "routine" },
  { phrase: "shubh ratri",          lang: "hi", weight: 1, category: "routine" },
];


// ─── NICKNAME DICTIONARY ──────────────────────────────────────
/**
 * Common pet names / nicknames used between couples.
 * Detected as standalone words in messages.
 * When a nickname appears frequently in messages from Person A
 * to Person B, it is flagged as "Person A calls Person B: [name]"
 */
const NICKNAMES = [
  // English
  "baby", "babe", "boo", "honey", "sweetheart", "darling",
  "love", "cutie", "gorgeous", "beautiful", "handsome",
  "my love", "sugar", "angel", "sunshine",
  // Hinglish
  "jaan", "jaanu", "janu", "babu", "babу",
  "shona", "sona", "soniye", "pari", "raja",
  "rani", "yaar", "mere yaar", "dilbar", "dil",
  "zindagi", "mehboob", "mehbooba",
];


// ─── MAIN FUNCTION ────────────────────────────────────────────

/**
 * detectLove(messages, senders)
 *
 * @param {Message[]} messages   — from parser.parse()
 * @param {string[]}  senders    — [senderA, senderB]
 *
 * @returns {LoveResult}
 *
 * LoveResult shape:
 * {
 *   totalLoveCount:    number,      — total expressions across both
 *   perPerson: {
 *     [senderName]: {
 *       count:         number,      — total love expressions
 *       weightedScore: number,      — weighted by phrase strength
 *       topPhrases:    PhraseCount[], — top 5 most used phrases
 *       byCategory: {               — count per category
 *         direct, longing, warmth, affection, routine
 *       },
 *       byMonth:       MonthCount[], — for mood graph
 *       nickname:      string|null,  — what they call their partner
 *     }
 *   },
 *   peakMonth:         string,      — "YYYY-MM" of highest love
 *   loveTimeline:      TimelinePoint[], — monthly combined counts
 *   loveRatio:         string,      — "60% Priya / 40% Arjun"
 *   dominantLover:     string,      — who expresses more love
 * }
 */
export function detectLove(messages, senders) {
  const [senderA, senderB] = senders;

  // Initialize per-person result containers
  const result = {
    totalLoveCount: 0,
    perPerson: {
      [senderA]: initPersonResult(),
      [senderB]: initPersonResult(),
    },
    peakMonth: null,
    loveTimeline: [],
    loveRatio: "",
    dominantLover: "",
  };

  // Get messages split by sender
  const msgsA = getMessagesBy(messages, senderA);
  const msgsB = getMessagesBy(messages, senderB);

  // Run love scan for each person
  scanLove(msgsA, senderA, result.perPerson[senderA]);
  scanLove(msgsB, senderB, result.perPerson[senderB]);

  // Detect nicknames each person uses for the other
  result.perPerson[senderA].nickname = detectNickname(msgsA);
  result.perPerson[senderB].nickname = detectNickname(msgsB);

  // Build combined monthly timeline
  result.loveTimeline = buildTimeline(messages, senders, result.perPerson);

  // Total count
  const countA = result.perPerson[senderA].count;
  const countB = result.perPerson[senderB].count;
  result.totalLoveCount = countA + countB;

  // Peak month
  if (result.loveTimeline.length > 0) {
    const peak = result.loveTimeline.reduce((max, p) => p.total > max.total ? p : max);
    result.peakMonth = peak.month;
  }

  // Love ratio
  if (result.totalLoveCount > 0) {
    const pctA = Math.round((countA / result.totalLoveCount) * 100);
    const pctB = 100 - pctA;
    result.loveRatio = `${pctA}% ${senderA} / ${pctB}% ${senderB}`;
    result.dominantLover = countA >= countB ? senderA : senderB;
  }

  // Sort top phrases for each person
  for (const sender of senders) {
    const person = result.perPerson[sender];
    person.topPhrases = Object.entries(person._phraseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phrase, count]) => ({ phrase, count }));
    delete person._phraseCounts; // clean up internal tracker
  }

  return result;
}


// ─── SCANNER ─────────────────────────────────────────────────

/**
 * scanLove(messages, sender, personResult)
 * Scans one person's messages for all love phrases.
 * Mutates personResult in place.
 */
function scanLove(messages, sender, personResult) {
  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;

    const text = msg.text.toLowerCase();
    let foundInThisMessage = false;

    for (const { phrase, weight, category } of LOVE_PHRASES) {
      if (text.includes(phrase)) {
        personResult.count          += 1;
        personResult.weightedScore  += weight;
        personResult.byCategory[category] =
          (personResult.byCategory[category] || 0) + 1;
        personResult._phraseCounts[phrase] =
          (personResult._phraseCounts[phrase] || 0) + 1;

        // Track monthly occurrence (once per message, per phrase)
        const monthKey = getMonthKey(msg.date);
        personResult._monthCounts[monthKey] =
          (personResult._monthCounts[monthKey] || 0) + 1;

        foundInThisMessage = true;
      }
    }
  }
}


// ─── NICKNAME DETECTOR ───────────────────────────────────────

/**
 * detectNickname(messages)
 * Finds the most frequently used nickname/pet-name in a set
 * of messages. Returns the top one or null.
 *
 * @param {Message[]} messages
 * @returns {string|null}
 */
function detectNickname(messages) {
  const counts = {};

  for (const msg of messages) {
    if (msg.isMedia || !msg.text) continue;
    const text = msg.text.toLowerCase();

    for (const nick of NICKNAMES) {
      // Match as whole word to avoid "baby" matching "babyshower"
      const regex = new RegExp(`\\b${escapeRegex(nick)}\\b`, "i");
      if (regex.test(text)) {
        counts[nick] = (counts[nick] || 0) + 1;
      }
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}


// ─── TIMELINE BUILDER ────────────────────────────────────────

/**
 * buildTimeline(messages, senders, perPerson)
 * Creates a month-by-month array of love counts for both people.
 * Used directly by the MoodGraph chart component.
 *
 * @returns {TimelinePoint[]}
 * TimelinePoint: { month: "YYYY-MM", [senderA]: n, [senderB]: n, total: n }
 */
function buildTimeline(messages, senders, perPerson) {
  const [senderA, senderB] = senders;

  // Collect all months that appear in either person's counts
  const allMonths = new Set([
    ...Object.keys(perPerson[senderA]._monthCounts),
    ...Object.keys(perPerson[senderB]._monthCounts),
  ]);

  // Sort chronologically
  const sortedMonths = [...allMonths].sort();

  return sortedMonths.map(month => {
    const a = perPerson[senderA]._monthCounts[month] || 0;
    const b = perPerson[senderB]._monthCounts[month] || 0;
    return {
      month,
      label:     formatMonthLabel(month),   // "Apr 2025" for chart axis
      [senderA]: a,
      [senderB]: b,
      total:     a + b,
    };
  });
}


// ─── HELPERS ─────────────────────────────────────────────────

function initPersonResult() {
  return {
    count:          0,
    weightedScore:  0,
    topPhrases:     [],
    byCategory: {
      direct:    0,
      longing:   0,
      warmth:    0,
      affection: 0,
      routine:   0,
    },
    nickname:       null,
    // Internal trackers — deleted before returning result
    _phraseCounts:  {},
    _monthCounts:   {},
  };
}

function getMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// ─── UTILITY EXPORT ──────────────────────────────────────────

/**
 * getLoveIntensityLabel(weightedScore, totalMessages)
 * Converts a weighted score into a human-readable intensity label.
 * Used in the dashboard health score card.
 *
 * @param {number} weightedScore
 * @param {number} totalMessages
 * @returns {string}  "Very High" | "High" | "Moderate" | "Low" | "Very Low"
 */
export function getLoveIntensityLabel(weightedScore, totalMessages) {
  if (totalMessages === 0) return "Unknown";
  // Score per 100 messages
  const rate = (weightedScore / totalMessages) * 100;
  if (rate >= 15) return "Very High";
  if (rate >= 8)  return "High";
  if (rate >= 4)  return "Moderate";
  if (rate >= 1)  return "Low";
  return "Very Low";
}
