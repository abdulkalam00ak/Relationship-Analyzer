/**
 * dilbar — api/geminiClient.js
 * ─────────────────────────────────────────────────────────────
 * Handles the single optional AI API call in the entire app.
 *
 * This file is only ever called when the user explicitly clicks
 * "Generate AI Narrative" — never automatically.
 *
 * Flow:
 *   1. Receives anonymizedStats from anonymizer.js
 *   2. Builds the prompt via buildGeminiPrompt()
 *   3. Calls Gemini 1.5 Flash (free tier)
 *   4. Returns the narrative string
 *
 * Privacy guarantee:
 *   - Only anonymized numbers are sent (no names, no messages)
 *   - The prompt is built by anonymizer.js which enforces this
 *   - API key is read from env variable, never hardcoded
 * ─────────────────────────────────────────────────────────────
 */

import { buildGeminiPrompt } from "../engine/anonymizer.js";


// ─── CONFIG ──────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_TOKENS = 2048; // Increased to accommodate the model's internal thinking tokens
const TEMPERATURE = 0.75; // Slightly creative but not random


// ─── MAIN FUNCTION ───────────────────────────────────────────

/**
 * generateNarrative(anonymizedStats)
 *
 * Sends anonymized relationship stats to Gemini 1.5 Flash
 * and returns a warm, personalised narrative paragraph.
 *
 * @param {AnonymizedStats} anonymizedStats — from anonymizer.anonymize()
 * @returns {Promise<NarrativeResult>}
 *
 * NarrativeResult shape:
 * {
 *   success:   boolean,
 *   narrative: string | null,
 *   error:     string | null,
 *   tokensUsed: number,
 * }
 */
export async function generateNarrative(anonymizedStats) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Guard — no API key configured
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return {
      success: false,
      narrative: null,
      error: "Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env.local file.",
      tokensUsed: 0,
    };
  }

  // Guard — no stats provided
  if (!anonymizedStats) {
    return {
      success: false,
      narrative: null,
      error: "No analysis data available to generate a narrative.",
      tokensUsed: 0,
    };
  }

  // Build the prompt
  const prompt = buildGeminiPrompt(anonymizedStats);

  // Build the API URL
  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_TOKENS,
          // No topK/topP overrides — defaults work well here
        },
        safetySettings: [
          // Relax safety filters slightly for emotional relationship content
          // so phrases like "I hate you" in context don't get blocked
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_ONLY_HIGH",
          },
        ],
      }),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `HTTP ${response.status}`;

      // Specific handling for common errors
      if (response.status === 400) {
        return error("The request was invalid. Please try again.");
      }
      if (response.status === 403) {
        return error("API key is invalid or has expired. Please check your VITE_GEMINI_API_KEY.");
      }
      if (response.status === 429) {
        return error("You have exceeded the Gemini free tier limit. Please wait a moment and try again.");
      }
      if (response.status >= 500) {
        return error("Gemini API is temporarily unavailable. Please try again in a moment.");
      }

      return error(`API error: ${message}`);
    }

    const data = await response.json();

    // Extract the narrative text from Gemini's response structure
    const narrative = extractNarrative(data);

    if (!narrative) {
      return error("The AI returned an empty response. Please try again.");
    }

    // Count tokens used (Gemini returns this in usageMetadata)
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;

    return {
      success: true,
      narrative: cleanNarrative(narrative),
      error: null,
      tokensUsed,
    };

  } catch (err) {
    // Network error — user is offline or request timed out
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      return error("Could not reach Gemini API. Please check your internet connection.");
    }
    return error(err.message || "An unexpected error occurred.");
  }
}


// ─── HELPERS ─────────────────────────────────────────────────

/**
 * extractNarrative(responseData)
 * Navigates Gemini's nested response structure to extract
 * the actual text content.
 *
 * Gemini response structure:
 * {
 *   candidates: [
 *     {
 *       content: {
 *         parts: [{ text: "..." }]
 *       }
 *     }
 *   ]
 * }
 */
function extractNarrative(data) {
  try {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

/**
 * cleanNarrative(text)
 * Removes any stray formatting the model might have added —
 * we want clean flowing prose, no markdown, no bullet points.
 */
function cleanNarrative(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")   // remove bold markdown
    .replace(/\*(.*?)\*/g, "$1")        // remove italic markdown
    .replace(/^[-•]\s+/gm, "")          // remove bullet points
    .replace(/#{1,6}\s+/g, "")          // remove headers
    .replace(/\n{3,}/g, "\n\n")         // collapse excess newlines
    .trim();
}

/**
 * error(message)
 * Shorthand for returning a failed NarrativeResult.
 */
function error(message) {
  return { success: false, narrative: null, error: message, tokensUsed: 0 };
}


// ─── RATE LIMIT TRACKER ──────────────────────────────────────
/**
 * Simple in-memory rate limit guard.
 * Gemini free tier allows 15 requests/minute.
 * This prevents accidental rapid-fire clicks from burning through quota.
 *
 * Tracks the last call time and enforces a 5-second minimum
 * between calls — enough to prevent spam without feeling slow.
 */
let lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 5000; // 5 seconds

/**
 * canCallAPI()
 * Returns true if enough time has passed since the last call.
 * @returns {{ allowed: boolean, waitSeconds: number }}
 */
export function canCallAPI() {
  const now = Date.now();
  const elapsed = now - lastCallTime;

  if (elapsed >= MIN_CALL_INTERVAL_MS) {
    return { allowed: true, waitSeconds: 0 };
  }

  const wait = Math.ceil((MIN_CALL_INTERVAL_MS - elapsed) / 1000);
  return { allowed: false, waitSeconds: wait };
}

/**
 * Wraps generateNarrative with the rate limit check.
 * This is what components should call — not generateNarrative directly.
 *
 * @param {AnonymizedStats} anonymizedStats
 * @returns {Promise<NarrativeResult>}
 */
export async function generateNarrativeSafe(anonymizedStats) {
  const { allowed, waitSeconds } = canCallAPI();

  if (!allowed) {
    return error(`Please wait ${waitSeconds} more second${waitSeconds > 1 ? "s" : ""} before generating again.`);
  }

  lastCallTime = Date.now();
  return generateNarrative(anonymizedStats);
}
