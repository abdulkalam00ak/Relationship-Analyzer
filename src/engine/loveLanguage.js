/**
 * dilbar — engine/loveLanguage.js
 * ─────────────────────────────────────────────────────────────
 * Detects which love language each person expresses most through
 * their messages, based on Dr. Gary Chapman's 5 Love Languages
 * adapted for text-based communication in EN + Hinglish.
 *
 * The 4 detectable love languages in text form:
 *
 *   1. Words of Affirmation
 *      Compliments, praise, "I love you", encouragement,
 *      verbal reassurance. The most visible in text.
 *
 *   2. Quality Time (signals)
 *      "I miss you", "let's talk", "call me", "I wish you
 *      were here", "video call", planning time together.
 *
 *   3. Humor & Playfulness
 *      Jokes, teasing, laughter, sarcasm used affectionately,
 *      playful banter. Detected via phrase patterns.
 *
 *   4. Reassurance & Support
 *      "I'm here", "don't worry", "you've got this",
 *      "I'm proud of you", emotional support phrases.
 *      People who give reassurance express love through safety.
 *
 * Note: Physical touch and acts of service are not detectable
 * in text — they are intentionally omitted.
 * ─────────────────────────────────────────────────────────────
 */

import { getMessagesBy } from "./parser.js";


// ─── PHRASE DICTIONARIES ──────────────────────────────────────

const WORDS_OF_AFFIRMATION = [
  // English
  "i love you", "love you", "ily", "luv you",
  "you're amazing", "you are amazing", "you're beautiful",
  "you're perfect", "you're incredible", "you're the best",
  "so proud of you", "proud of you", "you did great",
  "you mean everything", "you mean the world",
  "i appreciate you", "grateful for you", "thank you for being",
  "you complete me", "lucky to have you", "so lucky",
  "you're so kind", "you're so sweet", "you're so cute",
  "i believe in you", "you can do it", "you're doing great",
  "made for each other", "you're my everything",
  "you look amazing", "you're gorgeous", "you're handsome",
  // Hinglish
  "bahut pyaar", "bahut achhe ho", "bahut cute ho",
  "tu bahut sundar hai", "tu bahut khubsoorat hai",
  "mujhe tumse pyaar", "tujhse pyaar", "tujhpe garv hai",
  "bahut khush hoon tujhse", "mera sab kuch hai tu",
  "tu meri duniya", "tu meri jaan", "tu mera dil",
  "tum bahut ache ho", "kitna pyara hai", "kitni pyari hai",
  "tumse bahut pyaar", "dil se shukria",
];

const QUALITY_TIME = [
  // English
  "miss you", "miss u", "missing you", "wish you were here",
  "i wish you were here", "come online", "let's talk",
  "call me", "video call", "facetime", "let's meet",
  "want to see you", "can't wait to see you",
  "when will i see you", "see you soon", "meet me",
  "let's spend time", "talk to me", "are you free",
  "have time for me", "i need to talk to you",
  "been thinking about you", "thought about you",
  "all i think about", "can't stop thinking about you",
  "i was waiting for you", "where were you",
  // Hinglish
  "yaad aata hai", "yaad aati hai", "bahut yaad",
  "baat karo mujhse", "baat karo na", "online aao",
  "kab miloge", "kab milogi", "milne aao", "mil lo",
  "tujhe dekhna hai", "tumse milna hai",
  "call karo", "video call karte hain",
  "intezaar kar raha tha", "intezaar kar rahi thi",
  "kab aoge", "kab aogi",
  "soch raha tha tere baare mein",
  "thodi der baat karte hain",
];

const HUMOR_PLAYFULNESS = [
  // English
  "haha", "hahaha", "hahahaha", "lol", "lmao", "lmfao", "rofl",
  "dying", "i'm dead", "im dead", "i'm dying", "im dying",
  "stop it", "you're funny", "you crack me up",
  "that's hilarious", "so funny", "literally dying",
  "can't stop laughing", "you're ridiculous",
  "you're such a", "you idiot", "you dummy",
  "shut up no", "oh my god stop", "omg stop",
  "you're crazy", "you're insane", "no way",
  "i can't with you", "you kill me",
  // Hinglish
  "haha yaar", "hehe", "ahahaha",
  "kya baat hai", "kya ho tum", "teri toh",
  "pagal ho gaye", "kitne funny ho",
  "hansi aa gayi", "haste haste", "bilkul pagal",
  "tujhe kya ho gaya", "seedha karo apne aap ko",
  "kya bakwaas hai yaar",
];

const REASSURANCE_SUPPORT = [
  // English
  "i'm here", "im here", "i'm always here",
  "i'm not going anywhere", "i've got you", "i got you",
  "you're not alone", "don't worry", "everything will be okay",
  "it'll be okay", "it's going to be fine",
  "you'll be okay", "you'll be fine",
  "i support you", "i'm with you", "im with you",
  "i'm proud of you", "im proud of you", "proud of you",
  "you can do this", "you've got this", "you got this",
  "i believe in you", "i'll always be there",
  "i'm not leaving", "i won't leave", "never leave you",
  "you matter to me", "i care about you",
  "talk to me", "tell me everything", "i'm listening",
  "how are you feeling", "are you okay", "you okay",
  "i'm here for you", "im here for you",
  // Hinglish
  "main hoon na", "main hoon yahan",
  "teri chinta mat kar", "sab theek ho jayega",
  "main tere saath hoon", "tujhe kuch nahi hoga",
  "akela nahi hai tu", "teri baat sunuunga",
  "bata mujhe kya hua", "mujhe bata sab",
  "tujhpe garv hai", "tu kar sakta hai", "tu kar sakti hai",
  "himmat rakho", "bas karte raho", "tu strong hai",
  "don't worry yaar", "sab sahi ho jayega",
];


// ─── MAIN FUNCTION ────────────────────────────────────────────

/**
 * detectLoveLanguage(messages, senders)
 *
 * @param {Message[]} messages   — from parser.parse()
 * @param {string[]}  senders    — [senderA, senderB]
 *
 * @returns {LoveLanguageResult}
 *
 * LoveLanguageResult shape:
 * {
 *   perPerson: {
 *     [sender]: {
 *       primary:     string,       — dominant love language key
 *       primaryName: string,       — display name
 *       scores: {
 *         wordsOfAffirmation: number,  — 0–100
 *         qualityTime:        number,
 *         humor:              number,
 *         reassurance:        number,
 *       },
 *       breakdown:   LanguageScore[], — sorted highest first
 *       description: string,
 *     }
 *   },
 *   compatibility: {
 *     score:       number,    — 0–100
 *     label:       string,
 *     description: string,
 *   }
 * }
 */
export function detectLoveLanguage(messages, senders) {
  const [senderA, senderB] = senders;

  const msgsA = getMessagesBy(messages, senderA);
  const msgsB = getMessagesBy(messages, senderB);

  const resultA = analyzePersonLanguage(msgsA);
  const resultB = analyzePersonLanguage(msgsB);

  const compatibility = scoreCompatibility(resultA.scores, resultB.scores);

  return {
    perPerson: {
      [senderA]: resultA,
      [senderB]: resultB,
    },
    compatibility,
  };
}


// ─── PER-PERSON ANALYSIS ─────────────────────────────────────

function analyzePersonLanguage(messages) {
  const textMessages = messages.filter(m => !m.isMedia && m.text);
  if (textMessages.length === 0) return emptyPersonResult();

  const raw = {
    wordsOfAffirmation: 0,
    qualityTime:        0,
    humor:              0,
    reassurance:        0,
  };

  for (const msg of textMessages) {
    const text = msg.text.toLowerCase();
    raw.wordsOfAffirmation += countMatches(text, WORDS_OF_AFFIRMATION);
    raw.qualityTime        += countMatches(text, QUALITY_TIME);
    raw.humor              += countMatches(text, HUMOR_PLAYFULNESS);
    raw.reassurance        += countMatches(text, REASSURANCE_SUPPORT);
  }

  // Normalize: matches per 100 messages, capped at 100
  const total     = textMessages.length;
  const normalize = (n) => Math.min(100, Math.round((n / total) * 100));

  const scores = {
    wordsOfAffirmation: normalize(raw.wordsOfAffirmation),
    qualityTime:        normalize(raw.qualityTime),
    humor:              normalize(raw.humor),
    reassurance:        normalize(raw.reassurance),
  };

  const breakdown = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([key, score]) => ({
      key,
      name:  getLoveLangName(key),
      score,
      label: getLoveLangLabel(score),
    }));

  const primary = breakdown[0].key;

  return {
    primary,
    primaryName: getLoveLangName(primary),
    scores,
    breakdown,
    description: getLoveLangDescription(primary),
  };
}


// ─── COMPATIBILITY ───────────────────────────────────────────

/**
 * scoreCompatibility()
 * Measures how aligned the two people's love languages are.
 *
 * When both people's primary language is the same, they express
 * and receive love in the same way — very little gets lost.
 *
 * When they are completely different, one person may be expressing
 * love constantly in a form the other doesn't naturally recognize —
 * the classic silent disconnect that neither person can name.
 */
function scoreCompatibility(scoresA, scoresB) {
  const keys = Object.keys(scoresA);

  // Similarity per language = 100 - absolute difference
  const similarities = keys.map(key =>
    100 - Math.abs((scoresA[key] || 0) - (scoresB[key] || 0))
  );

  const avg = Math.round(
    similarities.reduce((s, v) => s + v, 0) / similarities.length
  );

  return {
    score:       avg,
    label:       getCompatibilityLabel(avg),
    description: getCompatibilityDescription(avg),
  };
}


// ─── HELPERS ─────────────────────────────────────────────────

function countMatches(text, phrases) {
  let count = 0;
  for (const phrase of phrases) {
    if (text.includes(phrase)) count++;
  }
  return count;
}

function emptyPersonResult() {
  return {
    primary:     "wordsOfAffirmation",
    primaryName: "Words of Affirmation",
    scores:      { wordsOfAffirmation: 0, qualityTime: 0, humor: 0, reassurance: 0 },
    breakdown:   [],
    description: "Not enough messages to detect a love language.",
  };
}

function getLoveLangName(key) {
  const map = {
    wordsOfAffirmation: "Words of Affirmation",
    qualityTime:        "Quality Time",
    humor:              "Humor & Playfulness",
    reassurance:        "Reassurance & Support",
  };
  return map[key] || key;
}

function getLoveLangLabel(score) {
  if (score >= 60) return "Very Strong";
  if (score >= 35) return "Strong";
  if (score >= 15) return "Moderate";
  if (score >= 5)  return "Mild";
  return "Minimal";
}

function getLoveLangDescription(primary) {
  const map = {
    wordsOfAffirmation:
      "Expresses love primarily through words — compliments, affirmations, and verbal declarations are their natural language of love.",
    qualityTime:
      "Shows love by wanting presence — planning time together, saying 'I miss you', and long conversations are their love currency.",
    humor:
      "Expresses love through laughter and playfulness — constant jokes and teasing is their deepest form of genuine affection.",
    reassurance:
      "Shows love by being a safe space — 'I'm here', 'don't worry', 'you've got this' are their most sincere expressions of care.",
  };
  return map[primary] || "A unique blend of love languages that doesn't fit neatly into one category.";
}

function getCompatibilityLabel(score) {
  if (score >= 80) return "Highly Compatible";
  if (score >= 65) return "Well Matched";
  if (score >= 50) return "Complementary";
  if (score >= 35) return "Some Mismatch";
  return "Different Languages";
}

function getCompatibilityDescription(score) {
  if (score >= 80)
    return "Both people express and receive love in very similar ways — almost nothing gets lost in translation.";
  if (score >= 65)
    return "Good alignment overall — they largely understand each other's emotional language with minor gaps.";
  if (score >= 50)
    return "Their styles complement each other but require some conscious effort to bridge the differences.";
  if (score >= 35)
    return "Noticeable mismatch — one person may be expressing love in ways the other doesn't naturally recognize.";
  return "Significant language gap — they may both love deeply but express it in ways the other doesn't fully receive.";
}


// ─── UTILITY EXPORT ──────────────────────────────────────────

/**
 * getLoveLanguageSummary(resultA, nameA, resultB, nameB)
 * One-line summary shown in the Love Language card header.
 *
 * @returns {string}
 * e.g. "Priya speaks Words of Affirmation · Arjun speaks Humor"
 */
export function getLoveLanguageSummary(resultA, nameA, resultB, nameB) {
  return `${nameA} speaks ${resultA.primaryName} · ${nameB} speaks ${resultB.primaryName}`;
}
