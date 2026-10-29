const Anthropic = require("@anthropic-ai/sdk");
const { isOutOfCredits, geminiFallbackReady, creditsOut, benchCredits } = require("../../lib/transient.js");
const { geminiMessage } = require("./gemini.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Which models to try, in what order, at what effort, and the client that calls them.
// Split out so the cost ledger can price a request without importing the turn loop that runs it.

// Tried in order, dropping to the next whenever one is rate limited or down. This is an outage chain,
// not a budget one: the order is purely about which model should answer when they're all available.
// SAKU_CHAT_MODEL jumps the queue for a session.
const MODEL_CHAIN = [...new Set([process.env.SAKU_CHAT_MODEL, "claude-opus-5-5", "claude-sonnet-5-5"].filter(Boolean))];
// Every round re-sends the entire prompt, so a turn's cost is roughly (rounds + 1) x the prompt, and
// five rounds meant one indecisive turn could cost six. Three is where measurement landed: at two, a
// compound question ("how much would Etel need, and what class is the top scorer") answered the first
// half and gave up on the second, because it spent both rounds on the arithmetic. Most turns use none
// or one, so the cap only prices the tail. The last round is sent with tools switched off and an
// answer-now instruction, so it always ends in a reply rather than another request.
const MAX_TOOL_ROUNDS = 3;
const MAX_HISTORY = 30; // rolling window of stored turns (~15 exchanges); older turns fold into a summary
// Generous ceilings, because brevity is the prompt's job. A tight token cap doesn't produce short
// replies, it produces replies that stop mid-word: thinking counts against max_tokens, and thinking
// can't be switched off on these models, so the budget has to cover it as well as the reply.
const MAX_OUTPUT_TOKENS = 4000;

// A capped timeout with few retries matters more than squeezing out a slow success: when the API is
// busy, failing fast lets the model chain move on instead of leaving someone staring at nothing.
// The key comes from ANTHROPIC_API_KEY.
const client = new Anthropic({ timeout: 45000, maxRetries: 1 });

// Thinking is always on and effort is the only control over how much of it happens. It bills at the
// output rate, so chat runs at "low"; SAKU_THINKING_LEVEL raises it if answers get shallow.
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const EFFORT = EFFORTS.includes(process.env.SAKU_THINKING_LEVEL) ? process.env.SAKU_THINKING_LEVEL : "low";
if (process.env.SAKU_THINKING_LEVEL && EFFORT !== process.env.SAKU_THINKING_LEVEL) {
  console.warn(`Saku chat: SAKU_THINKING_LEVEL "${process.env.SAKU_THINKING_LEVEL}" is not one of ${EFFORTS.join("|")}, using "low"`);
}

// A safety-classifier decline is retried server side on the fallback model Anthropic picks for that
// category, so a false positive costs a slower reply instead of no reply. An empty credit balance
// hands the same body to Gemini instead, which answers in Claude's shape.
async function createMessage(params) {
  const body = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", max_tokens: MAX_OUTPUT_TOKENS, output_config: { effort: EFFORT }, ...params };
  if (creditsOut()) return geminiMessage(body);
  try {
    return await client.beta.messages.create(body);
  } catch (err) {
    if (!isOutOfCredits(err) || !geminiFallbackReady()) throw err;
    benchCredits();
    return geminiMessage(body);
  }
}

const textOf = (response) =>
  response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

// The model that actually produced the reply, which is the one whose rates apply to its tokens: a
// refusal fallback, or Gemini when the credits are out.
const servedBy = (response, modelId) =>
  response.model?.startsWith("gemini-") || (response.usage?.iterations ?? []).some((i) => i.type === "fallback_message") ? response.model : modelId;

// What goes back into the next request as the assistant turn. After a fallback, everything ahead of
// the last switch point except plain text belongs to the model that declined and must not be echoed.
function echoContent(content) {
  const last = content.findLastIndex((b) => b.type === "fallback");
  if (last === -1) return content;
  return [...content.slice(0, last).filter((b) => b.type === "text"), ...content.slice(last + 1)];
}

// Outages move down the chain; a missing model id is a config mistake that gets skipped loudly.
const isMissingModel = (err) => err instanceof Anthropic.NotFoundError;

// A minute, because on billing the only thing a 429 can mean is a per-minute burst, and benching the
// best model for longer hands the rest of the conversation to a weaker one for no reason.
const MODEL_COOLDOWN_MS = 60 * 1000;

module.exports = {
  MODEL_CHAIN,
  MAX_TOOL_ROUNDS,
  MAX_HISTORY,
  MAX_OUTPUT_TOKENS,
  MODEL_COOLDOWN_MS,
  createMessage,
  textOf,
  servedBy,
  echoContent,
  isMissingModel,
};
