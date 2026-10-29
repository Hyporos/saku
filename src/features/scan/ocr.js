const Anthropic = require("@anthropic-ai/sdk");
const { isTransient } = require("../../lib/transient.js");
require("dotenv").config();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Shared screenshot reader for /scan, /culvertping and the webapp scan route.
//
// These used to call one model with no retry, so a single rate limit failed the whole command. The
// chain and the benching stay for a real outage, but with billing on the key the problem changed
// shape: a 429 is a per-minute burst that clears in seconds, not a spent daily cap. So the primary is
// retried before anything descends, because descending is a quality downgrade on the one operation
// where being wrong is invisible. A misread name writes a wrong score or quietly drops a member, and
// nobody finds out until they check their own graph. That's also why the chain is two capable models
// and no cheap tier: if all of them are down, an error the bee can retry beats a bad read nobody
// questions. Scanning happens right after Thursday reset, when getting it right matters most.

// Opus leads because accuracy is the whole job here; Sonnet is the outage fallback, not a cost tier.
const MODEL_CHAIN = ["claude-opus-5-5", "claude-sonnet-5-5"];
// Thinking can't be switched off, so effort sets how long a read takes. Medium is the API default and
// errs towards accuracy; a scan is a burst of images, so drop it to low if scans feel slow.
const EFFORT = "medium";
const MAX_TOKENS = 8000; // thinking counts against it, and a truncated list silently drops members
const PRIMARY_ATTEMPTS = 3; // only the primary is worth waiting on; below it, one try each
const RETRY_DELAY_MS = 1500;
const COOLDOWN_MS = 60 * 1000; // a per-minute limit clears on its own, so don't bench for long
const BUSY_MESSAGE = "Error - Every image model is busy or down right now. Give it a minute and run the scan again.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cooldowns = new Map();
// The retry loop below owns retries, so the SDK's own are off. The key comes from ANTHROPIC_API_KEY.
const client = new Anthropic({ timeout: 60000, maxRetries: 0 });

// The prompt lives with the reader because /scan and the webapp scan route must parse a screenshot
// the same way. They each had their own byte-identical copy, so a tuning fix (a new ellipsis rule, a
// column quirk) would have landed in one and silently not the other, and that divergence shows up as
// wrong scores nobody thinks to question.
const CULVERT_SCAN_PROMPT = `Analyze this MapleStory guild culvert participation screenshot.

Perform a precise horizontal scan of each row to link the 'Character Name' (Leftmost Column) with the 'Culvert Score' (Rightmost Column).

Rules:
- Spatial Mapping: Treat the first text string as 'CharacterName' and the final integer in the row as 'Score'.
- Ignore Context: Skip all middle columns (Class, Level, World, Guild).
- Data Integrity: If a score is missing or obscured, default to 0.
- Character Encoding: Preserve all special characters and symbols (ö, á, etc.) exactly as rendered.
- Formatting: Return ONLY 'CharacterName Score' (space-separated), one per line. No headers, no intro text.
- Ellipsis Truncation: If a character name contains an ellipsis (..), treat the ellipsis as the end of the name.
- Strict Column Separation: Do not include any text that follows an ellipsis (e.g., if you see heatherhah..Dawn, the name is just heatherhah).
- Integer Only Scores: Output the culvert score as a raw integer with no commas or symbols (e.g., 216993 instead of 216,993).

Example output:
PlayerName1 63100
PlayerName2 62918
PlayerName3 0`;

// /culvertping reads the same screenshot for names alone, so its prompt lives beside the one above
// rather than inline in the command — the two share the ellipsis and column rules, and those are
// exactly the rules that get tuned.
const CULVERTPING_PROMPT = `Analyze this MapleStory guild list screenshot for the 'culvertping' utility.

Your goal is to extract character names with 100% accuracy, specifically handling truncated names and column overlaps.

Rules:
- Truncation Logic: If a character name contains an ellipsis (..), stop the extraction immediately at the first dot. Do not include the dots or any text following them (e.g., 'heatherhah..Dawn' becomes 'heatherhah').
- Column Isolation: Extract ONLY the first vertical column. Strictly ignore the Class (Adele, Night Walker, etc.), Level, and Score columns.
- Encoding: Preserve all special characters (ö, á, etc.) exactly as they appear.
- Formatting: Return ONLY the character names, one per line. No headers, introductory text, or blank lines.

Example output:
PlayerName1
PlayerName2
PlayerName3`;

/**
 * Fetch a Discord attachment and return it as base64, ready for readImage.
 *
 * @param {Object} attachment - The attachment from interaction.options.getAttachment.
 * @returns {Promise<{data: string, mimeType: string}>}
 */
async function fetchAttachment(attachment) {
  // proxyURL first: it is the CDN copy, and it keeps working when the original URL's signature has
  // aged out from under a slow interaction.
  const response = await fetch(attachment.proxyURL || attachment.url);
  if (!response.ok) throw new Error("Image fetch failed");
  return {
    data: Buffer.from(await response.arrayBuffer()).toString("base64"),
    mimeType: attachment.contentType || "image/png",
  };
}

/**
 * Reads an image with the first model that answers.
 *
 * @param {Object} options
 * @param {string} options.prompt - The extraction instructions.
 * @param {string} options.data - Base64 image data.
 * @param {string} [options.mimeType] - Image mime type, defaults to image/png.
 * @returns {Promise<string>} The model's raw text response.
 */
async function readImage({ prompt, data, mimeType = "image/png" }) {
  const ready = MODEL_CHAIN.filter((m) => Date.now() > (cooldowns.get(m) ?? 0));
  const chain = ready.length ? ready : MODEL_CHAIN; // all benched, so try anyway

  let lastError = null;
  for (const [index, modelId] of chain.entries()) {
    const attempts = index === 0 ? PRIMARY_ATTEMPTS : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await client.beta.messages.create({
          model: modelId,
          max_tokens: MAX_TOKENS,
          output_config: { effort: EFFORT },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mimeType, data } },
                { type: "text", text: prompt },
              ],
            },
          ],
        });
        // A cut-off list would silently drop the members past the cut, and a decline or an answer
        // that spent its whole budget thinking has nothing to parse. All three are worth another go
        // rather than failing the scan, so they take the retry path with the rate limits.
        const text = result.stop_reason === "refusal" ? "" : result.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        if (!text.trim() || result.stop_reason === "max_tokens") {
          const empty = new Error(`Unusable response from the image model (${result.stop_reason})`);
          empty.retryable = true;
          throw empty;
        }
        cooldowns.delete(modelId);
        return text;
      } catch (err) {
        lastError = err;
        if (!err?.retryable && !isTransient(err)) throw err;
        if (attempt < attempts) {
          console.warn(`Saku OCR: ${modelId} busy, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt} of ${attempts})`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        cooldowns.set(modelId, Date.now() + COOLDOWN_MS);
        console.warn(`Error - OCR model ${modelId} unavailable, trying the next one (${(err?.message ?? "").replace(/\s+/g, " ").slice(0, 60)})`);
      }
    }
  }

  const busy = new Error(BUSY_MESSAGE);
  busy.quotaExhausted = true; // the flag /scan, /culvertping and the scan route check to show this text as-is
  busy.cause = lastError;
  throw busy;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = { readImage, fetchAttachment, CULVERT_SCAN_PROMPT, CULVERTPING_PROMPT };
