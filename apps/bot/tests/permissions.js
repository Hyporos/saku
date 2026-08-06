const fs = require("node:fs");
const path = require("node:path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Access used to live in hardcoded name lists inside interactionCreate.js, where nothing failed when
// they drifted from reality. It now comes off each command module, and this checks that every command
// still declares what it is meant to and that the gate resolves it the same way the event does.

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const commands = new Map();
for (const folder of fs.readdirSync(path.join(__dirname, "../src/commands"))) {
  const dir = path.join(__dirname, "../src/commands", folder);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const mod = require(path.join(dir, file));
    if (mod.data && mod.execute) commands.set(mod.data.name, mod);
  }
}

// The same resolution interactionCreate performs.
const tierOf = (command, subcommand = null) =>
  (subcommand && command.tiers?.[subcommand]) || command.tier || "public";

const allowed = (command, { bee = false, friend = false, owner = false } = {}, subcommand = null) => {
  if (command.culvert && friend) return false;
  const tier = tierOf(command, subcommand);
  if (tier === "owner" && !owner) return false;
  if (tier === "bee" && !bee && !owner) return false;
  return true;
};

// ⎯⎯ Every tier is a value the gate understands ⎯⎯ //
const VALID = ["public", "bee", "owner"];
for (const [name, command] of commands) {
  if (command.tier && !VALID.includes(command.tier)) check(`${name} has a valid tier`, false, command.tier);
  for (const [sub, tier] of Object.entries(command.tiers ?? {})) {
    if (!VALID.includes(tier)) check(`${name} ${sub} has a valid tier`, false, tier);
  }
}
check("every declared tier is public/bee/owner", failures === 0);

// ⎯⎯ Bee commands ⎯⎯ //
for (const name of ["character", "exception", "scan", "culvertping", "finalize", "wos", "export", "say", "guildprofile", "weekly"]) {
  const command = commands.get(name);
  check(`/${name} is bee`, command && tierOf(command) === "bee", command ? tierOf(command) : "MISSING");
}

// ⎯⎯ Owner ⎯⎯ //
check("/reload is owner", tierOf(commands.get("reload")) === "owner");
check("...and a bee cannot use it", !allowed(commands.get("reload"), { bee: true }));
check("...but the owner can", allowed(commands.get("reload"), { owner: true }));

// ⎯⎯ The subcommand case the old gate could never reach ⎯⎯ //
const event = commands.get("event");
check("/event is public overall", tierOf(event) === "public");
check("/event subtract is bee", tierOf(event, "subtract") === "bee");
check("...a member is refused subtract", !allowed(event, {}, "subtract"));
check("...a bee is allowed subtract", allowed(event, { bee: true }, "subtract"));
check("...but a member can still use /event add", allowed(event, {}, "add"));

// ⎯⎯ Culvert vs friends ⎯⎯ //
const gpq = commands.get("gpq");
check("/gpq is a culvert command", Boolean(gpq.culvert));
check("...refused to friends", !allowed(gpq, { friend: true }));
check("...allowed to members", allowed(gpq, {}));
check("/roll is not culvert, so friends keep it", allowed(commands.get("roll"), { friend: true }));

// ⎯⎯ A bee command refuses a plain member ⎯⎯ //
check("a member cannot use /character", !allowed(commands.get("character"), {}));
check("a bee can", allowed(commands.get("character"), { bee: true }));
check("the owner can", allowed(commands.get("character"), { owner: true }));

// ⎯⎯ Description tags agree with the gate ⎯⎯ //
for (const [name, command] of commands) {
  const description = command.data.toJSON().description;
  const tagged = /\[(BEE|OWNER)\]/.test(description);
  const restricted = tierOf(command) !== "public";
  if (tagged !== restricted) {
    check(`/${name}: description tag matches its tier`, false, `tagged=${tagged} tier=${tierOf(command)}`);
  }
}
check("every [BEE]/[OWNER] tag matches the enforced tier", true);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
