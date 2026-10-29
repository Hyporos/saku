const { GoogleGenAI, FunctionCallingConfigMode } = require("@google/genai");
const { isTransient } = require("../../lib/transient.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// The out-of-credits fallback. It takes the exact request body built for Claude and answers with a
// Claude-shaped message, so the turn loop never knows which provider served it.

// The chat chain from before the move to Claude. 3.1 leads because it caches most of a turn at the
// same price as 3.5, which returns no cached tokens at all.
const GEMINI_CHAIN = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
// Thinking bills at the output rate, and "minimal" kept it from being most of the bill.
const THINKING = { thinkingLevel: "minimal" };

let ai = null;
const client = () => (ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 30000, retryOptions: { attempts: 2 } } }));

// Gemini 3 rejects a replayed function call without the thought signature it was issued with, and the
// signature has no slot in a Claude tool_use block, so it waits here under the id handed out for it.
// A call it never issued (a turn that started on Claude) gets the documented skip value instead.
const SIGNATURES = new Map();
const SIGNATURES_MAX = 500;
const SKIP_SIGNATURE = "skip_thought_signature_validator";
let nextId = 0;

const systemText = (system) => (Array.isArray(system) ? system.map((b) => b.text).join("\n\n") : (system ?? ""));

function toolResultResponse(block) {
  const raw = Array.isArray(block.content) ? block.content.filter((b) => b.type === "text").map((b) => b.text).join("") : String(block.content ?? "");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }
  const response = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { result: parsed };
  return block.is_error && !response.error ? { error: response } : response;
}

// Claude messages → Gemini contents. Thinking, fallback markers and anything else Gemini has no use
// for are dropped; a tool_result is matched to its call by the name on the preceding tool_use.
function toContents(messages) {
  const names = new Map();
  const contents = [];
  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const blocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    const parts = [];
    for (const block of blocks) {
      if (block.type === "text" && block.text) parts.push({ text: block.text });
      else if (block.type === "image" && block.source?.type === "base64") parts.push({ inlineData: { mimeType: block.source.media_type, data: block.source.data } });
      else if (block.type === "tool_use") {
        names.set(block.id, block.name);
        parts.push({ functionCall: { name: block.name, args: block.input ?? {} }, thoughtSignature: SIGNATURES.get(block.id) ?? SKIP_SIGNATURE });
      } else if (block.type === "tool_result") {
        parts.push({ functionResponse: { name: names.get(block.tool_use_id) ?? "unknown", response: toolResultResponse(block) } });
      }
    }
    if (!parts.length) continue;
    const prev = contents[contents.length - 1];
    if (prev?.role === role) prev.parts.push(...parts);
    else contents.push({ role, parts });
  }
  return contents;
}

// Gemini response → Claude message.
function toMessage(result, model) {
  const candidate = result.candidates?.[0];
  const content = [];
  for (const part of candidate?.content?.parts ?? []) {
    if (part.thought) continue;
    if (part.functionCall) {
      const id = `toolu_gem_${++nextId}`;
      if (part.thoughtSignature) {
        SIGNATURES.set(id, part.thoughtSignature);
        while (SIGNATURES.size > SIGNATURES_MAX) SIGNATURES.delete(SIGNATURES.keys().next().value);
      }
      content.push({ type: "tool_use", id, name: part.functionCall.name, input: part.functionCall.args ?? {} });
    } else if (part.text) {
      const last = content[content.length - 1];
      if (last?.type === "text") last.text += part.text;
      else content.push({ type: "text", text: part.text });
    }
  }
  const finish = String(candidate?.finishReason ?? "");
  const blocked = Boolean(result.promptFeedback?.blockReason) || /SAFETY|BLOCKLIST|PROHIBITED|SPII/.test(finish);
  const stop_reason = content.some((b) => b.type === "tool_use") ? "tool_use" : blocked ? "refusal" : finish === "MAX_TOKENS" ? "max_tokens" : "end_turn";
  const meta = result.usageMetadata ?? {};
  const cached = meta.cachedContentTokenCount ?? 0;
  return {
    type: "message",
    role: "assistant",
    model,
    content: stop_reason === "refusal" ? [] : content,
    stop_reason,
    stop_details: null,
    usage: {
      input_tokens: Math.max(0, (meta.promptTokenCount ?? 0) - cached),
      output_tokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: 0,
    },
  };
}

function toRequest(body, model) {
  const tools = body.tools?.length ? [{ functionDeclarations: body.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.input_schema })) }] : undefined;
  return {
    model,
    contents: toContents(body.messages),
    config: {
      systemInstruction: systemText(body.system) || undefined,
      ...(tools ? { tools } : {}),
      ...(tools && body.tool_choice?.type === "none" ? { toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } } } : {}),
      maxOutputTokens: body.max_tokens,
      thinkingConfig: THINKING,
    },
  };
}

// Walks the Gemini chain on rate limits and outages; anything else is a real error and surfaces.
async function geminiMessage(body) {
  let lastError = null;
  for (const model of GEMINI_CHAIN) {
    try {
      return toMessage(await client().models.generateContent(toRequest(body, model)), model);
    } catch (err) {
      if (!isTransient(err)) throw err;
      lastError = err;
      console.warn(`Saku chat: ${model} unavailable on the Gemini fallback (${(err?.message ?? "").replace(/\s+/g, " ").slice(0, 60)})`);
    }
  }
  throw lastError;
}

module.exports = { geminiMessage, toRequest, toMessage };
