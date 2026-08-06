require("dotenv").config();
const { unsupportedNumbers, unsupportedNames } = require("../src/features/chat/index.js");

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

// A gap worked out from two figures that were looked up is not invented, but only when the reply
// shows both of them. These were escalating to the expensive corrective model on every fight.
const SCORES = "getCharacter returned 304130 for Rally and 220224 for Ingest, guild average 184566";

const CASES = [
  { name: "gap between two quoted scores passes", reply: "Rally scored 304,130 against Ingest's 220,224, a gap of 83,906.", evidence: SCORES, expect: [] },
  { name: "sum of two quoted scores passes", reply: "Rally put up 304,130 and Ingest 220,224, so 524,354 between them.", evidence: SCORES, expect: [] },
  { name: "a gap with the operands NOT shown is still caught", reply: "The gap between them was 83,906.", evidence: SCORES, expect: ["83906"] },
  { name: "an invented figure beside real ones is still caught", reply: "Rally scored 304,130, Ingest 220,224, and Etel 999,111.", evidence: SCORES, expect: ["999111"] },
  { name: "a rounded gap passes", reply: "Rally is on 304,130 and Ingest 220,224, so a lead of roughly 84,000.", evidence: SCORES, expect: [] },
  { name: "a rounded gap to the nearest thousand passes", reply: "304,130 against 220,224 is about 83,900 between them.", evidence: SCORES, expect: [] },
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
  // Discord markup carries 18 digit ids. When history holds full-form emote tags the model echoes
  // one, and the id was read as an invented figure and sent the turn to the corrective model.
  { name: "emote id is markup, not a number", reply: "He's on a heater, 304,130 this week <:sakuSmug:1113503249534820445>", evidence: '{"score":304130}', expect: [] },
  { name: "channel mention id is markup", reply: "Ping me over in <#1532571112469299220> and I'll answer there.", evidence: "{}", expect: [] },
  { name: "user mention id is markup", reply: "That one was <@631337640754675725> asking.", evidence: "{}", expect: [] },
  { name: "fabrication beside an emote still caught", reply: "He scored 999,999 <:sakuSmug:1113503249534820445>", evidence: '{"score":304130}', expect: ["999999"] },
];

// ⎯⎯ Name guard ⎯⎯ //
// With the corrective round gone this is the only guard that still acts on a reply: a flagged name
// costs its sentence, and the whole answer if nothing else survives. So a false positive here is now
// more expensive than a miss, and every case below is one that actually cost an answer.
const ROSTER = JSON.stringify({ found: true, name: "Rally", lastCompletedWeek: "2026-07-22", lastCompletedWeekScore: 304130, job: "Kain" });

const NAME_CASES = [
  { name: "an invented character name is caught", reply: "Our only Mihile is Kaelen, and he's doing well.", evidence: ROSTER, expect: ["Kaelen"] },
  { name: "a real looked-up name passes", reply: "Rally put up 304,130 last week.", evidence: ROSTER, expect: [] },
  // Weeks are stored as ISO, so a month named in prose is in no tool result. This cost a complete,
  // correct answer ("the gap ... for the week of July 22") and replaced it with a placeholder.
  { name: "a month name is not a person", reply: "For the week of July 22 the gap was 56,946 points.", evidence: ROSTER, expect: [] },
  { name: "every month passes", reply: "January February March April June July August September October November December were all tracked.", evidence: ROSTER, expect: [] },
  { name: "a weekday is not a person", reply: "Culvert resets Thursday, so Wednesday closes the week.", evidence: ROSTER, expect: [] },
  // Gerund and imperative sentence openers, which fight scenes and advice replies are built from.
  { name: "a gerund opener is not a person", reply: "Catching up to Rally is a tall order at 304,130.", evidence: ROSTER, expect: [] },
  { name: "an imperative opener is not a person", reply: "Focus on your dailies. Outside of that, keep bossing.", evidence: ROSTER, expect: [] },
  // Fight scenes name maps, and a map is never a character.
  { name: "map furniture is not a person", reply: "They meet in the Royal Library and it ends on the Bridge.", evidence: ROSTER, expect: [] },
  { name: "a plural class name passes on its singular", reply: "The Bishops did well this week.", evidence: JSON.stringify({ job: "Bishop" }), expect: [] },
  { name: "a possessive is stripped before checking", reply: "Rally's score was 304,130.", evidence: ROSTER, expect: [] },
  // Fight scenes turn returned skill names into compound adjectives, which tokenise whole.
  { name: "a compound adjective off a real skill passes", reply: "A Dominion-boosted burst closed it out.", evidence: JSON.stringify({ signatureSkills: "Quintuple Star, Dominion" }), expect: [] },
  { name: "an invented compound is still caught", reply: "A Zephyrblade-boosted burst closed it out.", evidence: ROSTER, expect: ["Zephyrblade-boosted"] },
  // Sentence-opening capitals carry no signal: English capitalises the first word regardless, and
  // this position produced every false positive worth chasing.
  { name: "an ordinary word opening a sentence passes", reply: "Typical week for him. Rally is still ahead.", evidence: ROSTER, expect: [] },
  { name: "an invented name mid-sentence is still caught", reply: "Typical week. Our only Mihile is Kaelen.", evidence: ROSTER, expect: ["Kaelen"] },
  { name: "an opener that also appears mid-sentence is still checked", reply: "Kaelen took it. Rally lost to Kaelen.", evidence: ROSTER, expect: ["Kaelen"] },
  // The accepted gap, pinned so it is visible rather than a surprise: a fabricated name that only
  // ever opens a sentence is no longer caught.
  { name: "KNOWN GAP: invented name only as an opener is missed", reply: "Kaelen is our only Mihile.", evidence: ROSTER, expect: [] },
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
for (const c of NAME_CASES) {
  const got = unsupportedNames(c.reply, c.evidence).sort();
  const want = [...c.expect].sort();
  const ok = got.length === want.length && got.every((v, i) => v === want[i]);
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${c.name}`);
  if (!ok) console.log(`      reply: ${c.reply}\n      flagged [${got}], expected [${want}]`);
}
const total = CASES.length + NAME_CASES.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
