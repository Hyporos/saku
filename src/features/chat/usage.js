const usageSchema = require("../../schemas/usageSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
const { MODEL_CHAIN } = require("./model.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// What every turn costs and what the day has spent so far. Nothing here knows how a turn is built,
// only how to price one, which is why it can sit apart from the loop that calls it.

// The chat key is on billing, so there is no daily ceiling to ration and nothing to run out of. What
// used to live here was a whole rationing layer for the free tier (per-model daily caps read off the
// AI Studio dashboard, a SAKU_DAILY_LIMITS override, a percentage, 10% milestone announcements, a
// "no more chat until midnight" notice, and benching a model as spent for the rest of the day). All
// of it was already switched off by a GEMINI_PAID flag and none of it had run in months, so it is
// gone rather than maintained. Counting stays: it is the only record of what a day actually cost.

// USD per 1,000,000 tokens, read off https://ai.google.dev/gemini-api/docs/pricing on 2026-07-30.
// Correct them there, not from memory. `cached` is the context-caching input rate, which applies to
// whatever share of the prompt came back as cachedContentTokenCount. Thinking bills at the output
// rate, so it lands in `out` with the visible reply. A model missing here costs nothing in the
// estimate rather than guessing, and gets flagged so the table can be filled in.
const PRICES = {
  "gemini-3.6-flash": { in: 1.5, out: 7.5, cached: 0.15 },
  "gemini-3.5-flash": { in: 1.5, out: 9.0, cached: 0.15 },
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5, cached: 0.03 },
  // 3.1 is NOT priced like 3.5, which is what this row said until it was checked against the pricing
  // page on 2026-08-02. It is cheaper on both sides, and since it answers almost every turn the error
  // ran through everything downstream: getUsage, the 💳 card and the daily total all read about a
  // fifth high, output nearly 70% high.
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5, cached: 0.025 },
  "gemini-3-flash-preview": { in: 0.5, out: 3.0, cached: 0.05 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5, cached: 0.03 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4, cached: 0.01 },
};

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

// Called with the usageMetadata off every response, chat turns and summaries alike. cachedContentTokenCount
// is the slice of promptTokenCount that came back from cache, so it's tracked separately and subtracted
// when pricing rather than double counted.
// Per-turn accounting, kept alongside the daily totals so a single reply can account for itself when
// someone asks. The sink is passed in rather than held in a module variable because turns interleave:
// two people talking at once would otherwise bill each other's tokens.
function countTurn(sink, model, meta) {
  if (!sink || !meta) return;
  const add = {
    requests: 1,
    prompt: meta.promptTokenCount ?? 0,
    output: meta.candidatesTokenCount ?? 0,
    thinking: meta.thoughtsTokenCount ?? 0,
    cached: meta.cachedContentTokenCount ?? 0,
  };
  // Kept per model as well as in total. A turn that escalated ran on two models at very different
  // rates, and the totals alone can't say which one the money went to.
  const per = (sink.byModel[model] ??= { requests: 0, prompt: 0, output: 0, thinking: 0, cached: 0 });
  for (const [field, value] of Object.entries(add)) {
    sink[field] += value;
    per[field] += value;
  }
}

// Priced per model rather than per turn. This used to take the first model's rate and apply it to
// everything, so an escalated turn was billed entirely at the cheap rate and read far too low.
function modelCost(model, t) {
  const price = PRICES[model] ?? PRICES["gemini-3.1-flash-lite"];
  const fresh = Math.max(0, t.prompt - t.cached);
  return (fresh * price.in + t.cached * price.cached + (t.output + t.thinking) * price.out) / 1_000_000;
}

const turnCost = (turn) => Object.entries(turn.byModel).reduce((sum, [model, t]) => sum + modelCost(model, t), 0);

function countTokens(model, meta) {
  if (!usage || !meta) return;
  const key = usageKey(model);
  const add = {
    prompt: meta.promptTokenCount ?? 0,
    output: meta.candidatesTokenCount ?? 0,
    thinking: meta.thoughtsTokenCount ?? 0,
    cached: meta.cachedContentTokenCount ?? 0,
  };
  const current = (usage.tokens[key] ??= { prompt: 0, output: 0, thinking: 0, cached: 0 });
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
    usd += modelCost(model, { prompt: t.prompt ?? 0, cached: t.cached ?? 0, output: t.output ?? 0, thinking: t.thinking ?? 0 });
  }
  return { usd: Math.round(usd * 10000) / 10000, unpriced };
}

// Remember which model just failed, so an outage costs one wasted call instead of one per message.
// A minute, because on billing the only thing a 429 can mean is a per-minute burst, and benching the
// best model for longer hands the rest of the conversation to a weaker one for no reason.

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
