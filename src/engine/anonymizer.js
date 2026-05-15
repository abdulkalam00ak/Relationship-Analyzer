/**
 * dilbar — engine/anonymizer.js
 * ─────────────────────────────────────────────────────────────
 * Strips all personally identifiable information from the
 * analysis result before it is sent to Gemini API.
 *
 * This is the privacy gatekeeper of the entire app.
 *
 * What gets anonymized:
 *   - Both sender names → "Person A" and "Person B"
 *   - Any phone numbers that appear in sender names
 *   - Trigger words and phrase lists (kept as-is, no names)
 *
 * What is NEVER sent to any API:
 *   - Actual message text
 *   - Dates (only relative references like "3 years")
 *   - Device or file metadata
 *
 * The output of anonymize() is a clean stats object that
 * geminiClient.js formats into a prompt for the AI narrative.
 * ─────────────────────────────────────────────────────────────
 */


// ─── MAIN FUNCTION ────────────────────────────────────────────

/**
 * anonymize(analysisResult, senders)
 *
 * Takes the full result from useAnalysis.js and returns a
 * safe, anonymized stats object ready for the Gemini API.
 *
 * @param {object}   analysisResult  — combined output of all engines
 * @param {string[]} senders         — [senderA, senderB] real names
 *
 * @returns {AnonymizedStats}
 *
 * AnonymizedStats shape:
 * {
 *   personA: string,          — always "Person A"
 *   personB: string,          — always "Person B"
 *   relationshipMonths: number,
 *   totalMessages: number,
 *   bond: {
 *     score: number,
 *     label: string,
 *     balanceScore: number,
 *     balanceLabel: string,
 *     responsiveness: { score, label, rawMinutes },
 *     consistency:    { score, label, rawDays },
 *     depth:          { score, label, rawWords },
 *   },
 *   love: {
 *     totalCount: number,
 *     personA: { count, weightedScore, topCategory, nickname },
 *     personB: { count, weightedScore, topCategory, nickname },
 *     dominantLover: "Person A" | "Person B",
 *     peakMonth: string,       — relative e.g. "8 months ago"
 *   },
 *   conflict: {
 *     count: number,
 *     frequencyLabel: string,
 *     avgRecoveryHours: number,
 *     longestSilenceHours: number,
 *     topTriggerWord: string | null,
 *     personA: { topTrigger, coldReplyCount },
 *     personB: { topTrigger, coldReplyCount },
 *   },
 *   emoji: {
 *     combinedSpectrum: { positive, negative, neutral },
 *     personA: { dominantEmotion, top3Labels, loveScore },
 *     personB: { dominantEmotion, top3Labels, loveScore },
 *   },
 *   loveLanguage: {
 *     personA: { primaryName, description },
 *     personB: { primaryName, description },
 *     compatibility: { score, label, description },
 *   },
 *   recurringMistakes: {
 *     personA: string[],   — just the fix suggestions, no names
 *     personB: string[],
 *   }
 * }
 */
export function anonymize(analysisResult, senders) {
  const [senderA, senderB] = senders;
  const {
    parseResult,
    bondResult,
    loveResult,
    conflictResult,
    emojiResult,
    loveLanguageResult,
  } = analysisResult;

  // ── Relationship duration ──────────────────────────────────
  const relationshipMonths = parseResult.dateRange
    ? Math.round(
        (parseResult.dateRange.end - parseResult.dateRange.start) /
        (30 * 24 * 60 * 60 * 1000)
      )
    : 0;

  // ── Bond ──────────────────────────────────────────────────
  const bond = {
    score:        bondResult.score,
    label:        bondResult.label,
    balanceScore: bondResult.balanceScore,
    balanceLabel: bondResult.dominantSender === senderA
      ? "Person A sends more"
      : "Person B sends more",
    responsiveness: {
      score:      bondResult.factors.responsiveness.score,
      label:      bondResult.factors.responsiveness.label,
      rawMinutes: bondResult.factors.responsiveness.raw,
    },
    consistency: {
      score:    bondResult.factors.consistency.score,
      label:    bondResult.factors.consistency.label,
      rawDays:  bondResult.factors.consistency.raw,
    },
    depth: {
      score:    bondResult.factors.depth.score,
      label:    bondResult.factors.depth.label,
      rawWords: bondResult.factors.depth.raw,
    },
  };

  // ── Love ──────────────────────────────────────────────────
  const loveA = loveResult.perPerson[senderA];
  const loveB = loveResult.perPerson[senderB];

  const topCategoryA = loveA?.byCategory
    ? Object.entries(loveA.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;
  const topCategoryB = loveB?.byCategory
    ? Object.entries(loveB.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;

  const love = {
    totalCount:    loveResult.totalLoveCount,
    personA: {
      count:        loveA?.count        || 0,
      weightedScore: loveA?.weightedScore || 0,
      topCategory:  topCategoryA,
      nickname:     loveA?.nickname     || null,
    },
    personB: {
      count:        loveB?.count        || 0,
      weightedScore: loveB?.weightedScore || 0,
      topCategory:  topCategoryB,
      nickname:     loveB?.nickname     || null,
    },
    dominantLover: loveResult.dominantLover === senderA
      ? "Person A"
      : "Person B",
    peakMonth: loveResult.peakMonth
      ? getRelativeMonth(loveResult.peakMonth)
      : null,
  };

  // ── Conflict ──────────────────────────────────────────────
  const conflictA = conflictResult.perPerson[senderA];
  const conflictB = conflictResult.perPerson[senderB];

  const conflict = {
    count:               conflictResult.conflictCount,
    frequencyLabel:      getConflictFreqLabel(
                           conflictResult.conflictCount,
                           relationshipMonths
                         ),
    avgRecoveryHours:    conflictResult.avgRecoveryTime,
    longestSilenceHours: conflictResult.longestSilence?.hours || 0,
    topTriggerWord:      conflictResult.triggerWords?.[0]?.word || null,
    personA: {
      topTrigger:    conflictA?.topTrigger    || null,
      coldReplyCount: conflictA?.coldReplyCount || 0,
    },
    personB: {
      topTrigger:    conflictB?.topTrigger    || null,
      coldReplyCount: conflictB?.coldReplyCount || 0,
    },
  };

  // ── Emoji ─────────────────────────────────────────────────
  const emojiA = emojiResult.perPerson[senderA];
  const emojiB = emojiResult.perPerson[senderB];

  const emoji = {
    combinedSpectrum: emojiResult.combinedSpectrum,
    personA: {
      dominantEmotion: emojiA?.dominantEmotion || "neutral",
      top3Labels:      (emojiA?.top5 || []).slice(0, 3).map(e => e.label),
      loveScore:       emojiA?.loveScore || 0,
    },
    personB: {
      dominantEmotion: emojiB?.dominantEmotion || "neutral",
      top3Labels:      (emojiB?.top5 || []).slice(0, 3).map(e => e.label),
      loveScore:       emojiB?.loveScore || 0,
    },
  };

  // ── Love Language ─────────────────────────────────────────
  const llA = loveLanguageResult.perPerson[senderA];
  const llB = loveLanguageResult.perPerson[senderB];

  const loveLanguage = {
    personA: {
      primaryName: llA?.primaryName  || "Unknown",
      description: llA?.description  || "",
    },
    personB: {
      primaryName: llB?.primaryName  || "Unknown",
      description: llB?.description  || "",
    },
    compatibility: loveLanguageResult.compatibility,
  };

  // ── Recurring Mistakes ────────────────────────────────────
  // Send only the fix suggestions — not the phrases themselves
  // to avoid any accidental personal content going to the API
  const mistakesA = conflictResult.recurringMistakes?.[senderA] || [];
  const mistakesB = conflictResult.recurringMistakes?.[senderB] || [];

  const recurringMistakes = {
    personA: mistakesA.map(m => m.suggestion),
    personB: mistakesB.map(m => m.suggestion),
  };

  return {
    personA:            "Person A",
    personB:            "Person B",
    relationshipMonths,
    totalMessages:      parseResult.totalMessages,
    bond,
    love,
    conflict,
    emoji,
    loveLanguage,
    recurringMistakes,
  };
}


// ─── HELPERS ─────────────────────────────────────────────────

/**
 * getRelativeMonth(monthKey)
 * Converts "2024-02" into a relative string like "15 months ago"
 * so the AI narrative sounds natural without exposing exact dates.
 *
 * @param {string} monthKey  "YYYY-MM"
 * @returns {string}
 */
function getRelativeMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const then  = new Date(year, month - 1);
  const now   = new Date();
  const diff  = Math.round(
    (now - then) / (30 * 24 * 60 * 60 * 1000)
  );

  if (diff <= 1)  return "last month";
  if (diff <= 3)  return "a few months ago";
  if (diff <= 6)  return "about 6 months ago";
  if (diff <= 12) return "about a year ago";
  return `about ${Math.round(diff / 12)} years ago`;
}

/**
 * getConflictFreqLabel(count, months)
 * Human-readable conflict frequency for the AI prompt.
 */
function getConflictFreqLabel(count, months) {
  if (months === 0) return "unknown frequency";
  const rate = count / months;
  if (rate >= 4)   return "very frequently (4+ times a month)";
  if (rate >= 2)   return "frequently (2–3 times a month)";
  if (rate >= 1)   return "occasionally (about once a month)";
  if (rate >= 0.5) return "rarely (once every few months)";
  return "very rarely";
}


// ─── PROMPT BUILDER ──────────────────────────────────────────

/**
 * buildGeminiPrompt(stats)
 * Converts the anonymized stats object into a structured prompt
 * for Gemini API. Returns a string ready to send as the user message.
 *
 * Keeping the prompt builder here (next to the anonymizer) ensures
 * nothing personal ever slips into the prompt accidentally.
 *
 * @param {AnonymizedStats} stats
 * @returns {string}
 */
export function buildGeminiPrompt(stats) {
  const {
    relationshipMonths, totalMessages,
    bond, love, conflict, emoji,
    loveLanguage, recurringMistakes,
  } = stats;

  const mistakesAText = recurringMistakes.personA.length > 0
    ? recurringMistakes.personA.join(" | ")
    : "none detected";

  const mistakesBText = recurringMistakes.personB.length > 0
    ? recurringMistakes.personB.join(" | ")
    : "none detected";

  return `
You are dilbar, a warm and honest relationship analyst. Write a single flowing narrative paragraph (150–200 words) about this couple's relationship based on the data below. Be specific, use the actual numbers, be empathetic but honest. Do not use bullet points. Do not use names — refer to them as "Person A" and "Person B". End with one specific, actionable suggestion.

RELATIONSHIP DATA:
- Duration: ${relationshipMonths} months
- Total messages: ${totalMessages.toLocaleString()}
- Bond score: ${bond.score}/100 (${bond.label})
- Reply speed: ${bond.responsiveness.rawMinutes} minutes average (${bond.responsiveness.label})
- Active days/month: ${bond.consistency.rawDays} (${bond.consistency.label})
- Avg message length: ${bond.depth.rawWords} words (${bond.depth.label})
- Conversation balance: ${bond.balanceScore}/100 (${bond.balanceLabel})

LOVE:
- Total love expressions: ${love.totalCount}
- Person A love count: ${love.personA.count} (nickname used: ${love.personA.nickname || "none"})
- Person B love count: ${love.personB.count} (nickname used: ${love.personB.nickname || "none"})
- Who expresses more love: ${love.dominantLover}
- Peak loving period: ${love.peakMonth || "no clear peak"}

CONFLICT:
- Conflict events detected: ${conflict.count} (${conflict.frequencyLabel})
- Average recovery time: ${conflict.avgRecoveryHours} hours
- Longest silence: ${conflict.longestSilenceHours} hours
- Top trigger word: ${conflict.topTriggerWord || "none"}

EMOTIONS (from emoji patterns):
- Combined spectrum: ${emoji.combinedSpectrum.positive}% positive, ${emoji.combinedSpectrum.negative}% negative, ${emoji.combinedSpectrum.neutral}% neutral
- Person A dominant emotion: ${emoji.personA.dominantEmotion}
- Person B dominant emotion: ${emoji.personB.dominantEmotion}

LOVE LANGUAGES:
- Person A: ${loveLanguage.personA.primaryName}
- Person B: ${loveLanguage.personB.primaryName}
- Compatibility: ${loveLanguage.compatibility.label} (${loveLanguage.compatibility.score}/100)

RECURRING PATTERNS:
- Person A recurring issue: ${mistakesAText}
- Person B recurring issue: ${mistakesBText}

Write the narrative now:
`.trim();
}
