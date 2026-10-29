const Anthropic = require("@anthropic-ai/sdk");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Shared by the chat model chain and the OCR model chain: does this error mean "try the next model"
// or is it a real bug? Rate limits, overload (529), server errors and dropped or hung connections are
// worth falling through for; anything else should surface. Status covers Gemini's errors too.
const TRANSIENT_STATUS = [429, 500, 502, 503, 504, 529];

function isTransient(err) {
  if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) return true;
  return TRANSIENT_STATUS.includes(Number(err?.status));
}

// An empty Anthropic balance is not an outage: every Claude model fails the same way until someone
// tops it up, so walking the chain is pointless. Chat and OCR both switch to Gemini instead, and the
// bench is shared so the first one to notice saves the other a doomed request. Without a Gemini key
// nothing is benched and the error surfaces as it always did.
const CREDITS_BENCH_MS = 10 * 60 * 1000;
let creditsOutUntil = 0;

function isOutOfCredits(err) {
  const status = Number(err?.status);
  if (status === 402 || err?.type === "billing_error" || err?.error?.error?.type === "billing_error") return true;
  return status === 400 && /credit balance is too low/i.test(err?.message ?? "");
}

const geminiFallbackReady = () => Boolean(process.env.GEMINI_API_KEY);
const creditsOut = () => geminiFallbackReady() && Date.now() < creditsOutUntil;

function benchCredits() {
  if (!creditsOut()) console.error("Error - Anthropic credits are out, falling back to Gemini");
  creditsOutUntil = Date.now() + CREDITS_BENCH_MS;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = { isTransient, isOutOfCredits, geminiFallbackReady, creditsOut, benchCredits };
