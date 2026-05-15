/**
 * dilbar — hooks/useAnalysis.js
 * ─────────────────────────────────────────────────────────────
 * The central orchestrator of the entire app.
 *
 * Takes a raw WhatsApp .txt file from the upload zone,
 * runs all 7 engine modules in the correct order,
 * manages step-by-step loading state for the progress bar,
 * and returns one unified result object to the dashboard.
 *
 * Used like this in Dashboard.jsx:
 *
 *   const { result, status, progress, error, analyze } = useAnalysis();
 *
 *   // Trigger analysis when file is uploaded
 *   <UploadZone onFile={analyze} />
 *
 *   // Show progress
 *   <ProgressBar steps={progress.steps} percent={progress.percent} />
 *
 *   // Render report when done
 *   {status === "done" && <ReportDashboard result={result} />}
 *
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef } from "react";
import { parse }                from "../engine/parser.js";
import { detectLove }           from "../engine/loveDetector.js";
import { detectConflicts }      from "../engine/conflictDetector.js";
import { analyzeEmojis }        from "../engine/emojiAnalyzer.js";
import { calculateBondScore }   from "../engine/bondScorer.js";
import { detectLoveLanguage }   from "../engine/loveLanguage.js";
import { anonymize }            from "../engine/anonymizer.js";


// ─── ANALYSIS STEPS ──────────────────────────────────────────
/**
 * Each step has a label shown in the progress bar,
 * a weight that determines how much of the total % it takes,
 * and an id used to track which step is currently active.
 */
const STEPS = [
  { id: "reading",   label: "Reading file",         weight: 10 },
  { id: "parsing",   label: "Parsing messages",     weight: 15 },
  { id: "love",      label: "Scanning for love",    weight: 15 },
  { id: "conflict",  label: "Detecting conflicts",  weight: 15 },
  { id: "emoji",     label: "Reading emoji emotions", weight: 15 },
  { id: "bond",      label: "Calculating bond score", weight: 15 },
  { id: "language",  label: "Detecting love language", weight: 10 },
  { id: "done",      label: "Building your report", weight: 5  },
];


// ─── INITIAL STATE ───────────────────────────────────────────
const INITIAL_PROGRESS = {
  percent:     0,
  currentStep: null,
  steps:       STEPS.map(s => ({ ...s, status: "pending" })),
};

const INITIAL_STATE = {
  status:   "idle",     // idle | analyzing | done | error
  result:   null,
  progress: INITIAL_PROGRESS,
  error:    null,
};


// ─── HOOK ────────────────────────────────────────────────────

/**
 * useAnalysis()
 *
 * @returns {object}
 * {
 *   status:   "idle" | "analyzing" | "done" | "error",
 *   result:   AnalysisResult | null,
 *   progress: ProgressState,
 *   error:    string | null,
 *   analyze:  (file: File) => void,
 *   reset:    () => void,
 * }
 *
 * AnalysisResult shape:
 * {
 *   parseResult:       ParseResult,
 *   loveResult:        LoveResult,
 *   conflictResult:    ConflictResult,
 *   emojiResult:       EmojiResult,
 *   bondResult:        BondResult,
 *   loveLanguageResult: LoveLanguageResult,
 *   anonymizedStats:   AnonymizedStats,
 *   senders:           string[],
 *   fileName:          string,
 *   analyzedAt:        Date,
 * }
 */
export function useAnalysis() {
  const [state, setState] = useState(INITIAL_STATE);

  // Ref to allow cancellation if user uploads a new file mid-analysis
  const cancelRef = useRef(false);

  // ── Reset ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    cancelRef.current = true; // cancel any in-progress analysis
    setState(INITIAL_STATE);
    // Allow new analysis after a tick
    setTimeout(() => { cancelRef.current = false; }, 50);
  }, []);

  // ── Step updater ──────────────────────────────────────────
  /**
   * markStep(id, status)
   * Updates a specific step's status and recalculates
   * the overall progress percentage.
   */
  const markStep = useCallback((id, status) => {
    setState(prev => {
      const updatedSteps = prev.progress.steps.map(s =>
        s.id === id ? { ...s, status } : s
      );

      // Calculate percent: sum weights of completed steps
      const completedWeight = updatedSteps
        .filter(s => s.status === "done")
        .reduce((sum, s) => sum + s.weight, 0);

      const totalWeight = STEPS.reduce((sum, s) => sum + s.weight, 0);
      const percent = Math.round((completedWeight / totalWeight) * 100);

      return {
        ...prev,
        progress: {
          ...prev.progress,
          percent,
          currentStep: id,
          steps: updatedSteps,
        },
      };
    });
  }, []);

  // ── Main analysis function ────────────────────────────────
  /**
   * analyze(file)
   * Entry point — called when user uploads a file.
   * Reads the file, runs all engines, builds the result.
   *
   * Uses setTimeout between steps to yield to the browser
   * so the UI progress bar actually updates between heavy operations.
   */
  const analyze = useCallback(async (file) => {
    if (!file) return;

    cancelRef.current = false;

    // Reset to fresh analyzing state
    setState({
      status:   "analyzing",
      result:   null,
      error:    null,
      progress: {
        ...INITIAL_PROGRESS,
        steps: STEPS.map(s => ({ ...s, status: "pending" })),
      },
    });

    try {

      // ── STEP 1: Read file ──────────────────────────────────
      markStep("reading", "active");
      await tick();
      if (cancelRef.current) return;

      const rawText = await readFileAsText(file);

      if (!rawText || rawText.trim().length === 0) {
        throw new Error("The file appears to be empty. Please check and try again.");
      }

      markStep("reading", "done");
      await tick();


      // ── STEP 2: Parse ──────────────────────────────────────
      markStep("parsing", "active");
      await tick();
      if (cancelRef.current) return;

      const parseResult = parse(rawText);

      // Validate parse result
      if (parseResult.messages.length === 0) {
        throw new Error(
          "Could not read any messages from this file. " +
          "Please make sure it is a WhatsApp chat export (.txt format)."
        );
      }

      if (parseResult.senders.length < 2) {
        throw new Error(
          "Could not detect two senders in this chat. " +
          "dilbar works with 1-on-1 conversations only."
        );
      }

      // Surface any non-fatal parser warnings
      if (parseResult.errors.length > 0) {
        console.warn("[dilbar parser]", parseResult.errors);
      }

      const { messages, senders, dateRange } = parseResult;
      markStep("parsing", "done");
      await tick();


      // ── STEP 3: Love detection ────────────────────────────
      markStep("love", "active");
      await tick();
      if (cancelRef.current) return;

      const loveResult = detectLove(messages, senders);

      markStep("love", "done");
      await tick();


      // ── STEP 4: Conflict detection ────────────────────────
      markStep("conflict", "active");
      await tick();
      if (cancelRef.current) return;

      const conflictResult = detectConflicts(messages, senders);

      markStep("conflict", "done");
      await tick();


      // ── STEP 5: Emoji analysis ────────────────────────────
      markStep("emoji", "active");
      await tick();
      if (cancelRef.current) return;

      const emojiResult = analyzeEmojis(messages, senders);

      markStep("emoji", "done");
      await tick();


      // ── STEP 6: Bond score ────────────────────────────────
      markStep("bond", "active");
      await tick();
      if (cancelRef.current) return;

      const bondResult = calculateBondScore(messages, senders, dateRange);

      markStep("bond", "done");
      await tick();


      // ── STEP 7: Love language ─────────────────────────────
      markStep("language", "active");
      await tick();
      if (cancelRef.current) return;

      const loveLanguageResult = detectLoveLanguage(messages, senders);

      markStep("language", "done");
      await tick();


      // ── STEP 8: Anonymize + assemble final result ─────────
      markStep("done", "active");
      await tick();
      if (cancelRef.current) return;

      const anonymizedStats = anonymize(
        {
          parseResult,
          bondResult,
          loveResult,
          conflictResult,
          emojiResult,
          loveLanguageResult,
        },
        senders
      );

      const finalResult = {
        parseResult,
        loveResult,
        conflictResult,
        emojiResult,
        bondResult,
        loveLanguageResult,
        anonymizedStats,
        senders,
        fileName:    file.name,
        analyzedAt:  new Date(),
      };

      markStep("done", "done");
      await tick();

      // ── Set final state ───────────────────────────────────
      setState(prev => ({
        ...prev,
        status: "done",
        result: finalResult,
        progress: {
          ...prev.progress,
          percent: 100,
        },
      }));

    } catch (err) {
      if (cancelRef.current) return; // Silently ignore cancelled runs

      console.error("[dilbar analysis error]", err);

      setState(prev => ({
        ...prev,
        status: "error",
        error:  err.message || "Something went wrong. Please try again.",
        progress: {
          ...prev.progress,
          steps: prev.progress.steps.map(s =>
            s.status === "active" ? { ...s, status: "error" } : s
          ),
        },
      }));
    }
  }, [markStep]);

  return {
    status:   state.status,
    result:   state.result,
    progress: state.progress,
    error:    state.error,
    analyze,
    reset,
  };
}


// ─── FILE READER ─────────────────────────────────────────────

/**
 * readFileAsText(file)
 * Wraps the browser FileReader API in a Promise.
 * Reads the entire .txt file as a UTF-8 string.
 * The file never leaves the browser.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error("Failed to read the file."));

    reader.readAsText(file, "utf-8");
  });
}


// ─── TICK ────────────────────────────────────────────────────

/**
 * tick()
 * Yields execution back to the browser for one frame.
 * This allows React to re-render the progress bar between
 * each heavy synchronous engine operation.
 *
 * Without this, the browser would freeze and show no progress
 * until all engines finish simultaneously.
 *
 * @returns {Promise<void>}
 */
function tick() {
  return new Promise(resolve => setTimeout(resolve, 30));
}


// ─── SELECTOR HELPERS ────────────────────────────────────────
/**
 * These are convenience functions for components that need
 * to pull specific slices out of the result object.
 * Import and use them in any component to avoid prop drilling.
 */

/**
 * selectGoodSide(result)
 * Extracts everything needed for the Good Side panel.
 */
export function selectGoodSide(result) {
  if (!result) return null;
  const { loveResult, bondResult, emojiResult,
          loveLanguageResult, senders } = result;
  const [a, b] = senders;

  return {
    senders,
    totalLoveCount:  loveResult.totalLoveCount,
    loveRatio:       loveResult.loveRatio,
    dominantLover:   loveResult.dominantLover,
    peakMonth:       loveResult.peakMonth,
    loveTimeline:    loveResult.loveTimeline,
    perPersonLove: {
      [a]: loveResult.perPerson[a],
      [b]: loveResult.perPerson[b],
    },
    bondScore:       bondResult.score,
    bondLabel:       bondResult.label,
    balanceScore:    bondResult.balanceScore,
    perPersonStats:  bondResult.perPerson,
    emojiLoveScores: {
      [a]: emojiResult.perPerson[a]?.loveScore,
      [b]: emojiResult.perPerson[b]?.loveScore,
    },
    loveLanguage:    loveLanguageResult,
  };
}

/**
 * selectBadSide(result)
 * Extracts everything needed for the Bad Side panel.
 */
export function selectBadSide(result) {
  if (!result) return null;
  const { conflictResult, emojiResult, bondResult, senders } = result;
  const [a, b] = senders;

  return {
    senders,
    conflictCount:      conflictResult.conflictCount,
    lastConflict:       conflictResult.lastConflict,
    longestSilence:     conflictResult.longestSilence,
    avgRecoveryTime:    conflictResult.avgRecoveryTime,
    triggerWords:       conflictResult.triggerWords,
    recurringMistakes:  conflictResult.recurringMistakes,
    conflictTimeline:   conflictResult.conflictTimeline,
    perPersonConflict:  conflictResult.perPerson,
    negativeEmojiPct: {
      [a]: emojiResult.perPerson[a]?.spectrum?.negative,
      [b]: emojiResult.perPerson[b]?.spectrum?.negative,
    },
    dominantSender:     bondResult.dominantSender,
    balanceScore:       bondResult.balanceScore,
  };
}

/**
 * selectCharts(result)
 * Extracts everything needed for MoodGraph and Heatmap.
 */
export function selectCharts(result) {
  if (!result) return null;
  const { loveResult, conflictResult,
          emojiResult, bondResult, parseResult } = result;

  return {
    loveTimeline:      loveResult.loveTimeline,
    conflictTimeline:  conflictResult.conflictTimeline,
    emojiTimeline:     emojiResult.emojiTimeline,
    monthlyBondScores: bondResult.monthlyScores,
    dateRange:         parseResult.dateRange,
    totalMessages:     parseResult.totalMessages,
    mediaCount:        parseResult.mediaCount,
  };
}

/**
 * selectEmojiPanel(result)
 * Extracts everything needed for the EmojiEmotions component.
 */
export function selectEmojiPanel(result) {
  if (!result) return null;
  const { emojiResult, senders } = result;
  const [a, b] = senders;

  return {
    senders,
    totalEmojiCount:  emojiResult.totalEmojiCount,
    combinedSpectrum: emojiResult.combinedSpectrum,
    mostLovingMonth:  emojiResult.mostLovingMonth,
    perPerson: {
      [a]: emojiResult.perPerson[a],
      [b]: emojiResult.perPerson[b],
    },
  };
}
