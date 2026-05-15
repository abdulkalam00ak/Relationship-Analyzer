/**
 * dilbar — engine/parser.js
 * ─────────────────────────────────────────────────────────────
 * Converts a raw WhatsApp .txt export into a clean array of
 * structured message objects that every other engine module uses.
 *
 * Handles:
 *  - Android format:  [12/04/2025, 10:32:05 AM] Sender: Message
 *  - iPhone format:   [12.04.25, 10:32:05] Sender: Message
 *  - 24hr format:     [12/04/2025, 22:32] Sender: Message
 *  - Multi-line messages (a message split across several lines)
 *  - Media omitted lines
 *  - System messages (no sender — ignored cleanly)
 *  - Encrypted message notices (ignored)
 * ─────────────────────────────────────────────────────────────
 */


// ─── REGEX PATTERNS ───────────────────────────────────────────

/**
 * Matches the START of a new WhatsApp message line.
 *
 * Captures:
 *   Group 1 → full date string   e.g. "12/04/2025" or "12.04.25"
 *   Group 2 → full time string   e.g. "10:32:05 AM" or "22:32"
 *   Group 3 → sender name        e.g. "Priya" or "+91 98765 43210"
 *   Group 4 → message text       e.g. "I love you jaan"
 *
 * The bracket format [date, time] is universal across Android/iPhone.
 * The separator after ] can be " - " (some exports) or just " ".
 */
const MESSAGE_REGEX = /^\[?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm]\.?)?)\]?\s*(?:-\s)?([^:]+?):\s([\s\S]*)/;

/**
 * Matches system/event lines to skip — things like:
 * "Messages and calls are end-to-end encrypted."
 * "Arjun created group 'Us'"
 * "You deleted this message"
 */
const SYSTEM_LINE_REGEX = /Messages and calls are end-to-end encrypted|end-to-end encrypted|created group|added|removed|left|changed|deleted this message|null|You deleted/i;

/**
 * Detects media omitted placeholder lines.
 * These are counted separately — not treated as text messages.
 */
const MEDIA_REGEX = /<Media omitted>|image omitted|video omitted|audio omitted|sticker omitted|GIF omitted|document omitted/i;


// ─── DATE NORMALIZER ──────────────────────────────────────────

/**
 * Takes the raw date string from the regex and returns a proper
 * JavaScript Date object.
 *
 * Handles separators: / . -
 * Handles 2-digit and 4-digit years.
 * Assumes DD/MM/YYYY order (standard in India/Pakistan).
 *
 * @param {string} dateStr  e.g. "12/04/2025" or "12.04.25"
 * @param {string} timeStr  e.g. "10:32:05 AM" or "22:32"
 * @returns {Date}
 */
function parseDate(dateStr, timeStr) {
  // Normalize separators to /
  const cleanDate = dateStr.replace(/[.\-]/g, "/");
  const parts = cleanDate.split("/");

  let day   = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  let year  = parseInt(parts[2], 10);

  // Handle 2-digit year — assume 2000s
  if (year < 100) year += 2000;

  // Parse time — handle both 12hr (AM/PM) and 24hr
  const cleanTime = timeStr.trim();
  let hours = 0, minutes = 0, seconds = 0;

  const timeMatch = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([AP]M))?/i);
  if (timeMatch) {
    hours   = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const meridiem = timeMatch[4];

    if (meridiem) {
      if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, seconds);
}


// ─── MAIN PARSER ──────────────────────────────────────────────

/**
 * parse()
 *
 * Takes the full raw text of a WhatsApp .txt export and returns
 * a clean array of message objects plus basic metadata.
 *
 * @param {string} rawText  — contents of the uploaded .txt file
 * @returns {ParseResult}
 *
 * ParseResult shape:
 * {
 *   messages: Message[],       — all valid messages, sorted by date
 *   senders:  string[],        — exactly 2 sender names detected
 *   totalMessages: number,
 *   dateRange: { start: Date, end: Date },
 *   mediaCount: number,        — total media files shared
 *   errors: string[]           — any non-fatal warnings
 * }
 *
 * Message shape:
 * {
 *   date:      Date,           — JavaScript Date object
 *   dateStr:   string,         — "12/04/2025" original string
 *   timeStr:   string,         — "10:32 AM" original string
 *   sender:    string,         — "Priya" or "Arjun"
 *   text:      string,         — full message text (multi-line joined)
 *   isMedia:   boolean,        — true if <Media omitted>
 *   timestamp: number,         — Date.getTime() for fast comparisons
 *   wordCount: number,         — number of words in message
 *   charCount: number,         — number of characters
 * }
 */
export function parse(rawText) {
  const errors = [];

  // Guard — empty or invalid input
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return {
      messages: [],
      senders: [],
      totalMessages: 0,
      dateRange: null,
      mediaCount: 0,
      errors: ["File appears to be empty or unreadable."],
    };
  }

  // Split into lines — handle both \n and \r\n (Windows line endings)
  const lines = rawText.split(/\r?\n/);

  const messages = [];
  let currentMessage = null;
  let mediaCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip completely empty lines
    if (!line.trim()) continue;

    // Skip system/event lines
    if (SYSTEM_LINE_REGEX.test(line)) continue;

    // Try to match the start of a new message
    const match = line.match(MESSAGE_REGEX);

    if (match) {
      // ── New message found ──

      // Before starting a new message, save the previous one
      if (currentMessage) {
        finalizeMessage(currentMessage);
        messages.push(currentMessage);
      }

      const [, dateStr, timeStr, sender, text] = match;
      const isMedia = MEDIA_REGEX.test(text);
      if (isMedia) mediaCount++;

      currentMessage = {
        date:      parseDate(dateStr, timeStr),
        dateStr:   dateStr.trim(),
        timeStr:   timeStr.trim(),
        sender:    sender.trim(),
        text:      isMedia ? "" : text.trim(),
        isMedia,
        timestamp: 0,   // filled by finalizeMessage
        wordCount: 0,   // filled by finalizeMessage
        charCount: 0,   // filled by finalizeMessage
      };

    } else {
      // ── Continuation line (multi-line message) ──
      // Append to the current message's text
      if (currentMessage && !currentMessage.isMedia) {
        currentMessage.text += "\n" + line.trim();
      }
    }
  }

  // Don't forget the very last message
  if (currentMessage) {
    finalizeMessage(currentMessage);
    messages.push(currentMessage);
  }

  // ── Validation ──
  if (messages.length === 0) {
    errors.push("No messages could be parsed. Please check the file format.");
    return { messages: [], senders: [], totalMessages: 0, dateRange: null, mediaCount: 0, errors };
  }

  // ── Detect the two senders ──
  const senderCounts = {};
  for (const msg of messages) {
    senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
  }

  // Sort by message count descending — the two most frequent are the partners
  const senders = Object.entries(senderCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // Warn if more than 2 senders found (group chat uploaded by mistake)
  if (senders.length > 2) {
    errors.push(
      `${senders.length} different senders found. dilbar works best with a 1-on-1 chat. ` +
      `Using the top 2: "${senders[0]}" and "${senders[1]}".`
    );
  }

  // Keep only the top 2 senders, filter out others
  const topTwo = new Set(senders.slice(0, 2));
  const filteredMessages = messages.filter(m => topTwo.has(m.sender));

  // ── Date range ──
  const timestamps = filteredMessages.map(m => m.timestamp);
  const dateRange = {
    start: new Date(Math.min(...timestamps)),
    end:   new Date(Math.max(...timestamps)),
  };

  return {
    messages:      filteredMessages,
    senders:       senders.slice(0, 2),
    totalMessages: filteredMessages.length,
    dateRange,
    mediaCount,
    errors,
  };
}


// ─── HELPER ───────────────────────────────────────────────────

/**
 * Fills in the computed fields of a message object in place.
 * Called once per message just before it is pushed to the array.
 */
function finalizeMessage(msg) {
  msg.timestamp = msg.date.getTime();
  msg.wordCount = msg.text
    ? msg.text.trim().split(/\s+/).filter(w => w.length > 0).length
    : 0;
  msg.charCount = msg.text ? msg.text.length : 0;
}


// ─── UTILITY EXPORTS ──────────────────────────────────────────

/**
 * getMessagesBy(messages, senderName)
 * Quick filter to get all messages from one specific sender.
 *
 * @param {Message[]} messages
 * @param {string}    sender
 * @returns {Message[]}
 */
export function getMessagesBy(messages, sender) {
  return messages.filter(m => m.sender === sender);
}

/**
 * getMessagesByDateRange(messages, startDate, endDate)
 * Filter messages to a specific date window.
 *
 * @param {Message[]} messages
 * @param {Date}      start
 * @param {Date}      end
 * @returns {Message[]}
 */
export function getMessagesByDateRange(messages, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return messages.filter(m => m.timestamp >= s && m.timestamp <= e);
}

/**
 * groupByMonth(messages)
 * Groups messages into a map keyed by "YYYY-MM" for charting.
 *
 * @param {Message[]} messages
 * @returns {Object}  e.g. { "2025-04": Message[], "2025-03": Message[] }
 */
export function groupByMonth(messages) {
  return messages.reduce((acc, msg) => {
    const year  = msg.date.getFullYear();
    const month = String(msg.date.getMonth() + 1).padStart(2, "0");
    const key   = `${year}-${month}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});
}

/**
 * groupByDay(messages)
 * Groups messages into a map keyed by "YYYY-MM-DD" for the heatmap.
 *
 * @param {Message[]} messages
 * @returns {Object}  e.g. { "2025-04-12": Message[] }
 */
export function groupByDay(messages) {
  return messages.reduce((acc, msg) => {
    const year  = msg.date.getFullYear();
    const month = String(msg.date.getMonth() + 1).padStart(2, "0");
    const day   = String(msg.date.getDate()).padStart(2, "0");
    const key   = `${year}-${month}-${day}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});
}
