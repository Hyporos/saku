const { GoogleGenerativeAI } = require("@google/generative-ai");
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
// nobody finds out until they check their own graph. That's also why the chain is three capable models
// and no lite tier: if all of them are down, an error the bee can retry beats a bad read nobody
// questions. Scanning happens right after Thursday reset, when getting it right matters most.

// 3.5-flash leads because it reads a guild list as accurately as 3.6-flash in about half the time,
// and a scan is a burst of images where that difference is felt. 3.6-flash sits right behind it.
const MODEL_CHAIN = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash"];
const PRIMARY_ATTEMPTS = 3; // only the primary is worth waiting on; below it, one try each
const RETRY_DELAY_MS = 1500;
const COOLDOWN_MS = 60 * 1000; // a per-minute limit clears on its own, so don't bench for long
const BUSY_MESSAGE = "Error - Every image model is busy or down right now. Give it a minute and run the scan again.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cooldowns = new Map();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

/**
 * Reads an image with the first model that answers.
 *
 * @param {Object} options
 * @param {string} options.prompt - The extraction instructions.
 * @param {string} options.data - Base64 image data.
 * @param {string} [options.mimeType] - Image mime type, defaults to image/png.
 * @param {number} [options.temperature] - Sampling temperature, omit for the model default.
 * @returns {Promise<string>} The model's raw text response.
 */
async function readImage({ prompt, data, mimeType = "image/png", temperature }) {
  const ready = MODEL_CHAIN.filter((m) => Date.now() > (cooldowns.get(m) ?? 0));
  const chain = ready.length ? ready : MODEL_CHAIN; // all benched, so try anyway

  let lastError = null;
  for (const [index, modelId] of chain.entries()) {
    const attempts = index === 0 ? PRIMARY_ATTEMPTS : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelId, ...(temperature === undefined ? {} : { generationConfig: { temperature } }) });
        const result = await model.generateContent([{ inlineData: { data, mimeType } }, prompt]);
        const text = (await result.response).text();
        // A vision model can burn its whole budget on thinking and answer with nothing. That's worth
        // another go rather than failing the scan, so it takes the retry path with the rate limits.
        if (!text?.trim()) {
          const empty = new Error("Empty response from the image model");
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

module.exports = { readImage, CULVERT_SCAN_PROMPT };
