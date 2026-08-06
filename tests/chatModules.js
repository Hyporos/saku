const fs = require("node:fs");
const path = require("node:path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// The chat feature was one 2,781 line file. Splitting it can silently leave a symbol behind in the
// module it moved to without exporting it — `node --check` passes, the module even loads, and it only
// fails when the code path runs. That happened once with MAX_HISTORY, so it is checked here.

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const DIR = path.join(__dirname, "../src/features/chat");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".js"));

const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
const declarationsIn = (src) =>
  [...src.matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);

// Anything a file uses that it neither declares, imports, nor gets from the language.
const GLOBALS = new Set([
  "require", "module", "exports", "process", "console", "Math", "JSON", "Date", "Promise", "Set", "Map",
  "Array", "Object", "String", "Number", "Boolean", "RegExp", "Error", "Buffer", "setTimeout",
  "clearTimeout", "setInterval", "AbortSignal", "__dirname", "__filename", "isNaN", "parseInt",
  "parseFloat", "encodeURIComponent", "decodeURIComponent", "structuredClone", "URL", "TextDecoder",
  "Infinity", "NaN", "undefined", "globalThis", "fetch", "AggregateError", "WeakMap", "Symbol", "Intl",
]);

for (const file of files) {
  const src = read(file);
  const declared = new Set(declarationsIn(src));

  // Names pulled in by require, including destructured ones.
  for (const m of src.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*require\(/g)) {
    for (const part of m[1].split(",")) {
      const name = part.split(":").pop().trim();
      if (name) declared.add(name);
    }
  }
  for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(/g)) declared.add(m[1]);

  // Function parameters and locals would be noise, so only module-level identifiers that look like
  // they were meant to be shared are checked: anything the file exports must exist.
  // Non-greedy to the first close brace, so a single-line `module.exports = { a, b }` is read too.
  const exportBlock = (src.match(/module\.exports\s*=\s*\{([\s\S]*?)\}/) ?? ["", ""])[1];
  const exported = exportBlock
    .split(",")
    .map((s) => s.split(":")[0].trim())
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));

  const missing = exported.filter((name) => !declared.has(name) && !GLOBALS.has(name));
  check(`${file} exports only things it defines`, missing.length === 0, missing.length ? missing.join(", ") : `${exported.length} exports`);
}

// ⎯⎯ The split modules must not import each other in a cycle ⎯⎯ //
const requiresOf = (file) =>
  [...read(file).matchAll(/require\("\.\/([\w.]+)"\)/g)].map((m) => (m[1].endsWith(".js") ? m[1] : `${m[1]}.js`));

const graph = new Map(files.map((f) => [f, requiresOf(f)]));
const cycles = [];
for (const [file, deps] of graph) {
  for (const dep of deps) {
    if ((graph.get(dep) ?? []).includes(file)) cycles.push(`${file} <-> ${dep}`);
  }
}
check("no circular imports between chat modules", cycles.length === 0, cycles.length ? cycles.join(", ") : "none");

// ⎯⎯ The public surface is unchanged ⎯⎯ //
const EXPECTED = [
  "askSaku", "isBee", "canChat", "canMentionAnywhere", "collectImages", "onCooldown", "refreshRosterMeta",
  "refreshServerExtras", "unsupportedNumbers", "unsupportedNames", "repairEmotes", "rememberTurn",
  "recallTurn", "formatTurnUsage", "explainTurn", "MENTION_CHANNEL_ID", "NOT_MEMBER_NOTICE",
  "wrongChannelNotice", "setChatCommandId",
];
const surface = Object.keys(require("../src/features/chat/index.js"));
const lost = EXPECTED.filter((n) => !surface.includes(n));
check("every export the rest of the bot uses still exists", lost.length === 0, lost.length ? lost.join(", ") : `${surface.length} exports`);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
