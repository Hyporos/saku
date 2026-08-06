const fs = require("node:fs");
const path = require("node:path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// The API was one 1,648 line file split into one file per resource. Nothing about that split may
// change which paths exist, so this walks the mounted router and compares it against the list the
// single file used to serve.

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// Every path the original routes.js registered, taken from it before it was deleted.
const EXPECTED = [
  "GET /getAll",
  "GET /character/:name",
  "GET /user/:id",
  "GET /rankings/:name",
  "GET /admin/action-log",
  "POST /admin/action-log",
  "DELETE /admin/action-log",
  "GET /admin/scheduled-tasks",
  "PATCH /admin/scheduled-tasks/dst",
  "GET /admin/users",
  "PATCH /admin/users/:id",
  "DELETE /admin/users/:id",
  "GET /admin/member/:id",
  "GET /admin/guild-members",
  "POST /admin/characters",
  "PATCH /admin/characters/:userId/:name",
  "POST /admin/characters/transfer",
  "DELETE /admin/characters/batch",
  "DELETE /admin/characters/:userId/:name",
  "GET /admin/archived-characters",
  "GET /admin/scores/:character",
  "POST /admin/scores",
  "PATCH /admin/scores/:character/:date",
  "DELETE /admin/scores/:character/:date",
  "PATCH /admin/scores/by-id/:scoreId",
  "DELETE /admin/scores/by-id/:scoreId",
  "GET /admin/exceptions",
  "POST /admin/exceptions",
  "PATCH /admin/exceptions/:id",
  "DELETE /admin/exceptions/:id",
  "POST /admin/scanner/scan",
  "POST /admin/scanner/log",
  "POST /admin/scanner/finalize",
  "GET /admin/weeks",
  "GET /admin/weeks/:date",
];

// Walk the express router tree and collect "METHOD path" for every registered handler.
function collect(router, found = []) {
  for (const layer of router.stack ?? []) {
    if (layer.route) {
      const routePath = layer.route.path.replace(/\(\\d\{4\}[^)]*\)/g, "");
      for (const method of Object.keys(layer.route.methods)) {
        if (layer.route.methods[method]) found.push(`${method.toUpperCase()} ${routePath}`);
      }
    } else if (layer.handle?.stack) {
      collect(layer.handle, found);
    }
  }
  return found;
}

const api = require("../src/api/index.js");
const found = collect(api);

check("router mounts", found.length > 0, `${found.length} routes`);

const missing = EXPECTED.filter((route) => !found.includes(route));
const extra = found.filter((route) => !EXPECTED.includes(route));

check("every original route still exists", missing.length === 0, missing.length ? missing.join(", ") : "none missing");
check("no unexpected routes appeared", extra.length === 0, extra.length ? extra.join(", ") : "none extra");
check("route count matches", found.length === EXPECTED.length, `${found.length} vs ${EXPECTED.length}`);

// ⎯⎯ Each resource file is self-contained ⎯⎯ //
const dir = path.join(__dirname, "../src/api");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
check("routes.js is gone", !files.includes("routes.js"));

for (const file of files) {
  if (file === "index.js" || file === "shared.js" || file === "scanCache.js") continue;
  const mod = require(path.join(dir, file));
  if (typeof mod !== "function" || !mod.stack) check(`${file} exports a router`, false);
}
check("every resource file exports a router", true, files.length + " files");

// The secret gate is applied once, centrally, not per file.
const src = fs.readFileSync(path.join(dir, "index.js"), "utf8");
check("the API secret gate is mounted in index.js", src.includes("router.use(requireApiSecret)"));
for (const file of files) {
  if (file === "index.js" || file === "shared.js") continue;
  const body = fs.readFileSync(path.join(dir, file), "utf8");
  if (body.includes("router.use(requireApiSecret)")) check(`${file} does not re-apply the gate`, false);
}
check("no resource file re-applies the gate", true);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
