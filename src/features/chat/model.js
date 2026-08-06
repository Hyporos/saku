const { GoogleGenAI } = require("@google/genai");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Which models to try, in what order, with what thinking settings, and the client that calls them.
// Split out so the cost ledger can price a request without importing the turn loop that runs it.

// Tried in order, dropping to the next whenever one is rate limited or down. With billing on the key
// there is no daily cap to ration, so this is an outage chain now rather than a budget one, and the
// order is purely about which model should answer when they're all available. SAKU_CHAT_MODEL jumps
// the queue for a session, and the full flash models the scanner uses are valid choices there if
// adherence ever justifies the bill: quota is shared per project rather than reserved, so nothing is
// off limits, but they cost about five times what a flash-lite request does on input.
const MODEL_CHAIN = [
  ...new Set(
    [
      process.env.SAKU_CHAT_MODEL,
      // 3.1 leads on measured cost, not preference: 3.5-flash-lite returns zero cached tokens on
      // every request (Flash-Lite isn't in Google's implicit-caching table at all), while 3.1 caches
      // ~75% of a turn at the same price and the same latency. That's the whole input bill halved.
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash-lite",
    ].filter(Boolean)
  ),
];
// Every round re-sends the entire prompt, so a turn's cost is roughly (rounds + 1) x the prompt, and
// five rounds meant one indecisive turn could cost six. Three is where measurement landed: at two, a
// compound question ("how much would Etel need, and what class is the top scorer") answered the first
// half and gave up on the second, because it spent both rounds on the arithmetic. Most turns use none
// or one, so the cap only prices the tail. The last round also carries an answer-now instruction, so
// a model that would have asked for another doesn't cost a separate closeout request on top.
const MAX_TOOL_ROUNDS = 3;
const MAX_HISTORY = 30; // rolling window of stored turns (~15 exchanges); older turns fold into a summary
// Generous ceilings, because brevity is the prompt's job. A tight token cap doesn't produce short
// replies, it produces replies that stop mid-word: thinking tokens count against maxOutputTokens, so
// a thinking model can spend the whole budget before it writes anything visible.
const MAX_OUTPUT_TOKENS = 1800;

// A capped timeout with few retries matters more than squeezing out a slow success: when the API is
// busy, failing fast lets the model chain move on instead of leaving someone staring at nothing.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_CHAT_API_KEY || process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30000, retryOptions: { attempts: 2 } },
});

// Thinking on defaults costs seconds per reply, which is far too slow for chat. The two families take
// different knobs (3.x wants thinkingLevel, 2.5 wants thinkingBudget and rejects thinkingLevel with a
// 400), and any model that refuses its knob gets remembered here and retried without one.
//
// Thinking bills at the OUTPUT rate, and measured on real turns it was 91% of billed output: ~1350
// thinking tokens to produce ~130 visible ones, including on "hey whats up". "low" is not the floor,
// "minimal" is, so that's the default. SAKU_THINKING_LEVEL raises it back if answers get shallow.
const THINKING_UNSUPPORTED = new Set();
const THINKING_LEVEL = process.env.SAKU_THINKING_LEVEL || "minimal";

function thinkingFor(modelId, level = THINKING_LEVEL) {
  if (THINKING_UNSUPPORTED.has(modelId)) return undefined;
  if (/^gemini-3/.test(modelId)) return { thinkingLevel: level };
  if (/^gemini-2\.5/.test(modelId)) return { thinkingBudget: 0 };
  return undefined;
}

const isThinkingRejected = (err) => Number(err?.status) === 400 && /thinking/i.test(err?.message ?? "");

// A minute, because on billing the only thing a 429 can mean is a per-minute burst, and benching the
// best model for longer hands the rest of the conversation to a weaker one for no reason.
const MODEL_COOLDOWN_MS = 60 * 1000;

module.exports = {
  MODEL_CHAIN,
  MAX_TOOL_ROUNDS,
  MAX_HISTORY,
  MAX_OUTPUT_TOKENS,
  MODEL_COOLDOWN_MS,
  ai,
  THINKING_UNSUPPORTED,
  THINKING_LEVEL,
  thinkingFor,
  isThinkingRejected,
};
