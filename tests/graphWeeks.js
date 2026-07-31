require("dotenv").config();
const mongoose = require("mongoose");
const culvertSchema = require("../src/schemas/culvertSchema.js");
const { loadScoreIndex, loadFinalizedWeeks } = require("../src/utility/culvertChart.js");
const { applyCap, viewCap } = require("../src/commands/culvert/graph.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// /graph week-count clamping. Rank and Median can only reach as far back as the guild has finalized
// data, so the week button has to follow the view rather than claim a range it isn't drawing.
//
// Run: node tests/graphWeeks.js

let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      got ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};
const snap = (s) => ({ weeks: s.weeks, weeksSet: s.weeksSet, restores: s.uncapped?.weeks ?? null });

console.log("state machine (cap applied on each view switch)\n");

// Someone who asked for 52 weeks on Score, then walks Rank (17) -> Median (20) -> Score.
let s = { weeks: 52, weeksSet: true, uncapped: null };
check("score, no cap", snap(applyCap(s, null)), { weeks: 52, weeksSet: true, restores: null });
check("into rank, clamps to 17", snap(applyCap(s, 17)), { weeks: 17, weeksSet: true, restores: 52 });
check("into median, looser cap 20", snap(applyCap(s, 20)), { weeks: 20, weeksSet: true, restores: 52 });
check("back to rank, tightens again", snap(applyCap(s, 17)), { weeks: 17, weeksSet: true, restores: 52 });
check("back to score, restores 52", snap(applyCap(s, null)), { weeks: 52, weeksSet: true, restores: null });

// Default 8 weeks, never set by hand, against a guild with only 5 finalized weeks.
s = { weeks: 8, weeksSet: false, uncapped: null };
check("default 8 into rank cap 5", snap(applyCap(s, 5)), { weeks: 5, weeksSet: true, restores: 8 });
check("back to score, restores the unset default", snap(applyCap(s, null)), { weeks: 8, weeksSet: false, restores: null });

// A cap that isn't binding must not touch anything.
s = { weeks: 6, weeksSet: true, uncapped: null };
check("cap looser than the choice is a no-op", snap(applyCap(s, 30)), { weeks: 6, weeksSet: true, restores: null });

// Typing a number while clamped is a fresh choice: the collector clears `uncapped`, so Score keeps it.
s = { weeks: 52, weeksSet: true, uncapped: null };
applyCap(s, 17);
s.weeks = 10;
s.weeksSet = true;
s.uncapped = null;
check("explicit set while clamped survives the trip back", snap(applyCap(s, null)), { weeks: 10, weeksSet: true, restores: null });

(async () => {
  await mongoose.connect(process.env.MONGODB_URI ?? process.env.MONGO_URI);
  const [index, finalized] = await Promise.all([loadScoreIndex(), loadFinalizedWeeks()]);
  const getScoreIndex = async () => ({ index, finalized });

  // Real character with the longest history, so the caps are the live ones.
  const docs = await culvertSchema.find({}, { characters: 1 }).lean();
  const chars = docs.flatMap((d) => d.characters ?? []);
  const char = chars.sort((a, b) => (b.scores?.length ?? 0) - (a.scores?.length ?? 0))[0];

  console.log(`\nagainst live data: ${char.name}, ${char.scores.length} scores, ${finalized.size} finalized weeks\n`);
  for (const view of ["score", "scoremedian", "rank"]) {
    const cap = await viewCap({ view, omit: false }, char, getScoreIndex);
    console.log(`  ${view.padEnd(12)} cap ${cap === null ? "none (full history)" : cap}`);
  }
  const rankCap = await viewCap({ view: "rank", omit: false }, char, getScoreIndex);
  const medianCap = await viewCap({ view: "scoremedian", omit: false }, char, getScoreIndex);
  // Both views want a finalized week for the same reason, so they must agree exactly. The current
  // week is excluded from both: it is still filling up, so its guild figure isn't real yet.
  check("median and rank reach the same distance", medianCap === rankCap, true);
  check("neither exceeds the character's own history", rankCap <= char.scores.length && medianCap <= char.scores.length, true);
  check("neither counts the unfinalized current week", rankCap <= finalized.size, true);

  console.log(`\n${failed ? failed + " FAILED" : "all passed"}`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
