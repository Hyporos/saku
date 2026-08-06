const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Every identifier a file uses must be one it declares, imports, or gets from the language.
//
// Splitting a big file is how this breaks: the code moves, the `require` at the top does not follow,
// and nothing complains. `node --check` passes, the module loads, and the failure waits until that one
// line runs — which, if it sits inside a catch, may be never. Splitting routes.js left api/characters.js
// calling axios with no import, inside a try/catch that swallowed the ReferenceError, so renames
// silently stopped picking up a character's real capitalisation. Nothing else in the suite saw it.

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const ROOT = path.join(__dirname, "..");
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "node_modules") walk(full, out); }
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
};

// Anything the runtime supplies. Node globals plus the standard library.
const GLOBALS = new Set([
  "require", "module", "exports", "process", "console", "Buffer", "__dirname", "__filename",
  "globalThis", "structuredClone", "queueMicrotask", "fetch", "Headers", "Request", "Response",
  "FormData", "Blob", "URL", "URLSearchParams", "AbortController", "AbortSignal", "TextEncoder",
  "TextDecoder", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
  "clearImmediate", "Math", "JSON", "Date", "Promise", "Set", "Map", "WeakMap", "WeakSet", "Array",
  "Object", "String", "Number", "Boolean", "RegExp", "Symbol", "BigInt", "Proxy", "Reflect", "Intl",
  "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError",
  "AggregateError", "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURIComponent",
  "decodeURIComponent", "encodeURI", "decodeURI", "Infinity", "NaN", "undefined", "arguments",
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array",
  "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array", "ArrayBuffer",
  "SharedArrayBuffer", "DataView", "Atomics", "escape", "unescape", "performance", "Function", "eval",
]);

// ⎯⎯ Scope tracking ⎯⎯ //

const namesInPattern = (pattern, out = []) => {
  if (!pattern) return out;
  switch (pattern.type) {
    case "Identifier": out.push(pattern.name); break;
    case "ObjectPattern":
      for (const prop of pattern.properties) {
        namesInPattern(prop.type === "RestElement" ? prop.argument : prop.value, out);
      }
      break;
    case "ArrayPattern": for (const el of pattern.elements) namesInPattern(el, out); break;
    case "AssignmentPattern": namesInPattern(pattern.left, out); break;
    case "RestElement": namesInPattern(pattern.argument, out); break;
  }
  return out;
};

const children = (node) => {
  const out = [];
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item.type === "string") out.push(item);
    } else if (value && typeof value.type === "string") out.push(value);
  }
  return out;
};

// Hoisted declarations visible anywhere in a scope: var, function, class, and let/const (which are
// only TDZ-restricted, not invisible — good enough for finding a missing import).
function declaredIn(node, into) {
  for (const child of children(node)) {
    switch (child.type) {
      case "VariableDeclaration":
        for (const d of child.declarations) namesInPattern(d.id, []).forEach((n) => into.add(n));
        declaredIn(child, into);
        break;
      case "FunctionDeclaration":
      case "ClassDeclaration":
        if (child.id) into.add(child.id.name);
        break; // its body is its own scope
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        break; // own scope
      default:
        declaredIn(child, into);
    }
  }
}

function scan(node, scopes, free) {
  const isFunction =
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression";

  let pushed = false;
  if (isFunction) {
    const own = new Set();
    if (node.id) own.add(node.id.name);
    for (const param of node.params) namesInPattern(param, []).forEach((n) => own.add(n));
    declaredIn(node.body, own);
    scopes.push(own);
    pushed = true;
  } else if (node.type === "CatchClause") {
    const own = new Set(namesInPattern(node.param, []));
    declaredIn(node.body, own);
    scopes.push(own);
    pushed = true;
  } else if (node.type === "BlockStatement" || node.type === "ForStatement" ||
             node.type === "ForOfStatement" || node.type === "ForInStatement") {
    const own = new Set();
    declaredIn(node, own);
    scopes.push(own);
    pushed = true;
  }

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
    const value = node[key];
    const kids = Array.isArray(value) ? value : [value];
    for (const child of kids) {
      if (!child || typeof child.type !== "string") continue;

      // Positions where an Identifier is a name, not a reference.
      if (child.type === "Identifier") {
        if (node.type === "MemberExpression" && node.property === child && !node.computed) continue;
        if (node.type === "Property" && node.key === child && !node.computed) continue;
        if (node.type === "MethodDefinition" && node.key === child && !node.computed) continue;
        if (node.type === "VariableDeclarator" && node.id === child) continue;
        if (node.type === "LabeledStatement" || node.type === "BreakStatement" ||
            node.type === "ContinueStatement") continue;
        if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration" ||
             node.type === "FunctionExpression") && node.id === child) continue;
        if (isFunction && node.params.includes(child)) continue;

        if (!scopes.some((s) => s.has(child.name)) && !GLOBALS.has(child.name)) {
          free.set(child.name, child.loc.start.line);
        }
        continue;
      }

      // Binding positions inside a declarator / pattern are handled by declaredIn.
      if (node.type === "VariableDeclarator" && node.id === child) continue;
      if (isFunction && node.params.includes(child)) continue;

      scan(child, scopes, free);
    }
  }

  if (pushed) scopes.pop();
}

for (const file of walk(path.join(ROOT, "src"))) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const src = fs.readFileSync(file, "utf8");

  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: 2024, sourceType: "script", locations: true });
  } catch (err) {
    check(rel, false, `parse error: ${err.message}`);
    continue;
  }

  const top = new Set();
  declaredIn(ast, top);
  const free = new Map();
  scan(ast, [top], free);

  const missing = [...free.entries()].map(([name, line]) => `${name} (L${line})`);
  check(rel, missing.length === 0, missing.length ? missing.join(", ") : "");
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
