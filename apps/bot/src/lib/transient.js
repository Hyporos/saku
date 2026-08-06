// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Shared by the chat model chain and the OCR model chain: does this error mean "try the next model"
// or is it a real bug? Quota, server overload, and hung requests are worth falling through for;
// anything else should surface.
//
// Matching on message text matters as much as status: the Gemini SDK retries internally and then
// rethrows through p-retry, which drops the status code and leaves only "Retryable HTTP Error:
// Too Many Requests".
const TRANSIENT_STATUS = [429, 500, 502, 503, 504];
const TRANSIENT_TEXT =
  /\b(429|500|502|503|504)\b|too many requests|retryable http|quota|rate limit|resource has been exhausted|resource_exhausted|high demand|overloaded|unavailable|internal error|timed? ?out|aborted|fetch failed|socket hang up|econnreset|enotfound|etimedout/i;

function isTransient(err) {
  const status = Number(err?.status ?? err?.response?.status ?? err?.error?.code ?? err?.cause?.status);
  if (TRANSIENT_STATUS.includes(status)) return true;
  return TRANSIENT_TEXT.test(`${err?.message ?? ""} ${err?.cause?.message ?? ""}`);
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = { isTransient };
