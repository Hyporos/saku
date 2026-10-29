const usageSchema = require("../../schemas/usageSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
const { MODEL_CHAIN } = require("./model.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// What every turn costs and what the day has spent so far. Nothing here knows how a turn is built,
// only how to price one, which is why it can sit apart from the loop that calls it.

// The chat key is on billing, so there is no daily ceiling to ration and nothing to run out of.
// Counting stays: it is the only record of what a day actually cost.

// USD per 1,000,000 tokens, from Anthropic's model pricing on 2026-10-29. Correct them there, not
// from memory. `cached` is the cache-read rate; cache writes (5-minute TTL) bill at 1.25x `in`.
// Thinking bills at the output rate and is already inside output_tokens. claude-opus-5 is here
// because it is where a refusal fallback can land, and Gemini because an empty balance lands there.
// A model missing here is priced at the dearest chain rate rather than guessed low, and gets flagged
// so the table can be filled in.
const PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cached: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cached: 0.2 },
  "claude-opus-5": { in: 5, out: 25, cached: 0.5 },
  // Prompts over 100K tokens bill at 0.5 / 2.5; a chat request never gets near that.
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cached: 0.01 },
  // The out-of-credits fallback, from https://ai.google.dev/gemini-api/docs/pricing (checked 2026-08-02).
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5, cached: 0.025 },
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5, cached: 0.03 },
};
const CACHE_WRITE_MULTIPLIER = 1.25;

const quotaDay = () => dayjs().tz("America/Los_Angeles").format("YYYY-MM-DD");
// Model ids contain dots, and a dot in a Mongo field path means "nest me", so flatten them first.
const usageKey = (model) => model.replace(/\./g, "_");

let usage = null;

async function loadUsage() {
  const day = quotaDay();
  if (usage?.day === day) return usage;
  const doc = await usageSchema.findById(day).lean().catch(() => null);
  usage = { day, requests: { ...(doc?.requests ?? {}) }, tokens: { ...(doc?.tokens ?? {}) } };
  return usage;
}

const spentOn = (model) => usage.requests[usageKey(model)] ?? 0;

const saveUsage = (update) => usageSchema.updateOne({ _id: usage.day }, { ...update, $set: { ...update.$set, updatedAt: new Date() } }, { upsert: true }).catch((err) => console.error("Error - Saku usage write failed:", err?.message));

function countRequest(model) {
  if (!usage) return;
  const key = usageKey(model);
  usage.requests[key] = (usage.requests[key] ?? 0) + 1;
  saveUsage({ $inc: { [`requests.${key}`]: 1 } }); // fire and forget, a counter isn't worth the latency
}

// The API reports a prompt in three disjoint parts: input_tokens (fresh), cache_read_input_tokens and
// cache_creation_input_tokens. prompt is their sum, so the 💳 card and getUsage read the whole prompt.
function tokensOf(meta) {
  const cached = meta.cache_read_input_tokens ?? 0;
  const written = meta.cache_creation_input_tokens ?? 0;
  return { prompt: (meta.input_tokens ?? 0) + cached + written, output: meta.output_tokens ?? 0, cached, written };
}

// Called with the usage off every response, chat turns and summaries alike.
// Per-turn accounting, kept alongside the daily totals so a single reply can account for itself when
// someone asks. The sink is passed in rather than held in a module variable because turns interleave:
// two people talking at once would otherwise bill each other's tokens.
function countTurn(sink, model, meta) {
  if (!sink || !meta) return;
  const add = { requests: 1, ...tokensOf(meta) };
  // Kept per model as well as in total. A turn that escalated ran on two models at very different
  // rates, and the totals alone can't say which one the money went to.
  const per = (sink.byModel[model] ??= { requests: 0, prompt: 0, output: 0, cached: 0, written: 0 });
  for (const [field, value] of Object.entries(add)) {
    sink[field] += value;
    per[field] += value;
  }
}

// Priced per model rather than per turn, so an escalated turn is billed at each model's own rate.
function modelCost(model, t) {
  const price = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const written = t.written ?? 0;
  const fresh = Math.max(0, t.prompt - t.cached - written);
  return (fresh * price.in + written * price.in * CACHE_WRITE_MULTIPLIER + t.cached * price.cached + t.output * price.out) / 1_000_000;
}

const turnCost = (turn) => Object.entries(turn.byModel).reduce((sum, [model, t]) => sum + modelCost(model, t), 0);

function countTokens(model, meta) {
  if (!usage || !meta) return;
  const key = usageKey(model);
  const add = tokensOf(meta);
  const current = (usage.tokens[key] ??= { prompt: 0, output: 0, cached: 0, written: 0 });
  const inc = {};
  // All four go in every time, zeros included. A cached count of 0 is the single most useful number
  // here, and skipping it would leave the field absent and indistinguishable from never measured.
  for (const [field, value] of Object.entries(add)) {
    current[field] = (current[field] ?? 0) + value;
    inc[`tokens.${key}.${field}`] = value;
  }
  saveUsage({ $inc: inc });
}

// Sums the day's tokens against PRICES. Returns the models it couldn't price so a missing entry shows
// up as a gap to fix instead of quietly understating the bill.
function estimatedCost() {
  let usd = 0;
  const unpriced = [];
  for (const [key, t] of Object.entries(usage?.tokens ?? {})) {
    const model = MODEL_CHAIN.find((m) => usageKey(m) === key) ?? key.replace(/_/g, ".");
    if (!PRICES[model]) {
      unpriced.push(model);
      continue;
    }
    usd += modelCost(model, { prompt: t.prompt ?? 0, cached: t.cached ?? 0, written: t.written ?? 0, output: t.output ?? 0 });
  }
  return { usd: Math.round(usd * 10000) / 10000, unpriced };
}

module.exports = {
  usageKey,
  usage,
  loadUsage,
  spentOn,
  countRequest,
  countTurn,
  modelCost,
  turnCost,
  countTokens,
  estimatedCost,
};
