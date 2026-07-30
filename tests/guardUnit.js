require("dotenv").config();
const { unsupportedNumbers } = require("../src/utility/sakuChat.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Deterministic cases for the fabrication guard. It fires on maybe one live turn in three, so the
// chat-level suite can pass while the guard is broken. These pin the behaviour directly.
//
// Run: node tests/guardUnit.js

// A realistic getGuildComposition payload. Note 16 IS present, as a level count, which is exactly why
// "16 Adeles" used to slip through: the number existed, just nowhere near Adele.
const COMPOSITION = JSON.stringify({
  totalCharacters: 202,
  jobs: [
    { job: "Night Walker", count: 32 },
    { job: "Adele", count: 20 },
    { job: "Buccaneer", count: 12 },
    { job: "Bishop", count: 9 },
  ],
  branches: [{ branch: "Pirate", count: 27 }],
  levels: { counted: 201, median: 293, perLevel: [{ level: 292, count: 45 }, { level: 291, count: 16 }] },
});

const CASES = [
  { name: "correct class count passes", reply: "We have 20 Adeles on the roster.", evidence: COMPOSITION, expect: [] },
  { name: "WRONG class count is caught", reply: "We have 16 Adeles on the roster.", evidence: COMPOSITION, expect: ["16"] },
  { name: "number stolen from another class is caught", reply: "We have 32 Adeles on the roster.", evidence: COMPOSITION, expect: ["32"] },
  { name: "two-word class name passes", reply: "We have 32 Night Walkers in the guild.", evidence: COMPOSITION, expect: [] },
  { name: "branch count passes", reply: "There are 27 Pirates in the guild.", evidence: COMPOSITION, expect: [] },
  { name: "generic noun passes on existence alone", reply: "There are 202 characters on the roster.", evidence: COMPOSITION, expect: [] },
  { name: "generic noun with a level count passes", reply: "45 members sit at level 292.", evidence: COMPOSITION, expect: [] },
  { name: "invented big number still caught", reply: "Rally scored 999999 last week.", evidence: COMPOSITION, expect: ["999999"] },
  { name: "real score passes", reply: "Rally scored 304130 last week.", evidence: '{"name":"Rally","score":304130}', expect: [] },
  { name: "comma formatting is normalised", reply: "Rally scored 304,130 last week.", evidence: '{"name":"Rally","score":304130}', expect: [] },
  // A patch number followed by a capitalised plural read as a count and made every news reply escalate.
  { name: "version number is not a count", reply: "The v.270 Known Issues post went up yesterday.", evidence: '{"title":"V.270 Known Issues","date":"2026-07-29"}', expect: [] },
  { name: "version number in a title passes", reply: "Patch V.270 Ride the Lightning brings changes.", evidence: '{"title":"V.270 Ride the Lightning"}', expect: [] },
  { name: "a real count next to a version still checked", reply: "There are 99 Bishops in the guild.", evidence: '{"job":"Bishop","count":9}', expect: ["99"] },
];

let failed = 0;
for (const c of CASES) {
  const got = unsupportedNumbers(c.reply, c.evidence).sort();
  const want = [...c.expect].sort();
  const ok = got.length === want.length && got.every((v, i) => v === want[i]);
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${c.name}`);
  if (!ok) console.log(`      reply: ${c.reply}\n      flagged [${got}], expected [${want}]`);
}
console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
