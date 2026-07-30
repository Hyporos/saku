require("dotenv").config();
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const culvertSchema = require("../src/schemas/culvertSchema.js");
const weekSchema = require("../src/schemas/weekSchema.js");
const characterMetaSchema = require("../src/schemas/characterMetaSchema.js");
const chatSchema = require("../src/schemas/chatSchema.js");
const { askSaku } = require("../src/utility/sakuChat.js");
const { getResetDates } = require("../src/utility/culvertUtils.js");

dayjs.extend(utc);
dayjs.extend(timezone);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Regression suite for Saku's chat. Every case here is a failure that actually happened and got
// fixed: a fabricated score, a leaked field name, a wrong item fact, banter aimed at the wrong
// person. None of them were protected by anything except the prompt, so the next round of prompt
// surgery could silently reopen any of them.
//
// Run:  node tests/chatRegression.js            (fast cases)
//       node tests/chatRegression.js --slow     (also the ones that hit the network)
//
// It talks to the real API and the real database, so it costs a few cents and reads live data.
// Expected values are computed from the database at run time rather than hardcoded, so the suite
// doesn't rot the moment someone posts a new score.

const OWNER = "631337640754675725";
// Repeated cases run against a throwaway user so each attempt starts from empty memory. Reusing the
// owner would let run 1's answer sit in history and bias runs 2 and 3 into agreeing with it.
const OWNER_SANDBOX = "900000000000000042";
const SLOW = process.argv.includes("--slow");

const has = (re) => (reply) => (re.test(reply) ? null : `expected /${re.source}/`);
const lacks = (re, why) => (reply) => (re.test(reply) ? `must not match /${re.source}/ (${why})` : null);
const all = (...checks) => (reply) => checks.map((c) => c(reply)).filter(Boolean).join("; ") || null;

async function buildCases() {
  const [weeks, chars, meta] = await Promise.all([
    weekSchema.find({}).lean(),
    culvertSchema.find({}).lean(),
    characterMetaSchema.find({}).lean(),
  ]);

  const { lastReset } = getResetDates();
  // Scores come from the per-character store, which is what getRankings reads. The weekly aggregate
  // can lag it (there was no weekSchema document for the most recent week while this was written),
  // so deriving the expected answer from weekSchema would fail a correct reply.
  const lastWeekScores = chars.flatMap((doc) =>
    (doc.characters ?? []).flatMap((c) => (c.scores ?? []).filter((s) => s.date === lastReset).map((s) => ({ name: c.name, score: s.score })))
  );
  const ranked = [...lastWeekScores].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const names = new Set(chars.flatMap((d) => (d.characters ?? []).map((c) => c.name)));
  const adeles = meta.filter((m) => /^adele$/i.test(m.job ?? "")).length;
  const nextReset = dayjs(lastReset).add(1, "week").format("MMMM D");

  const cases = [
    {
      name: "reset timing",
      guards: "wrong reset day, wrong next date",
      ask: "when does culvert reset?",
      repeat: 3,
      check: all(has(/thursday/i), lacks(/\bwednesday\b/i, "Wednesday identifies the week, it is not the reset day")),
    },
    {
      name: "top scorer is real",
      guards: 'the "5,210 by Mist" fabrication: a name and score from nowhere',
      ask: "who put up the highest culvert score last week?",
      check: (reply) => {
        if (!top) return "no scores in the database for last week, cannot check";
        if (!reply.includes(top.name)) return `expected the real top scorer ${top.name}`;
        // Any 4+ digit number in the reply has to be a score somebody actually got.
        const real = new Set(lastWeekScores.map((s) => String(s.score)));
        const bogus = [...reply.matchAll(/\d[\d,]{3,}/g)]
          .map((m) => m[0].replace(/,/g, ""))
          .filter((n) => !real.has(n));
        return bogus.length ? `invented score(s): ${bogus.join(", ")}` : null;
      },
    },
    {
      name: "class count is real",
      guards: 'the "12 Adeles" fabrication: a made up roster count',
      ask: "how many adeles are on the roster?",
      repeat: 3,
      check: (reply) => {
        const claimed = [...reply.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1]));
        if (!claimed.length) return null; // hedged without a number is acceptable
        return claimed.includes(adeles) ? null : `claimed ${claimed.join("/")}, roster has ${adeles}`;
      },
    },
    {
      name: "no invented majority",
      guards: 'the "half the roster is 297" fabrication',
      ask: "what level is most of the guild?",
      // "most common level is 292" is a legitimate answer straight out of the level spread, so only
      // the fraction words count here. The bug was claiming a share of the roster sits at one level.
      check: lacks(/\b(half|majority|most of (the|our))\b[^.]{0,40}\b29[0-9]\b/i, "claiming a level majority that was never in the data"),
    },
    {
      name: "total control is the right item",
      guards: "calling TC the Source of Suffering",
      ask: "what is tc?",
      check: all(has(/total control|android heart/i), lacks(/source of suffering/i, "SoS is a different item, the Verus Hilla pendant")),
    },
    {
      name: "flames respect the slot",
      guards: "advising a rebirth flame on a ring",
      ask: "should i put a rebirth flame on my endless terror?",
      check: all(has(/ring/i), has(/can'?t|cannot|don'?t take|not flam|no flame/i)),
    },
    {
      name: "kronos has no trading",
      guards: "giving Interactive world advice to a Heroic world guild",
      ask: "how much could i sell a pitched drop for?",
      // Asserted as the absence of the bug rather than the presence of one correct phrasing. The
      // right answer has far too many valid wordings to enumerate ("bound", "nothing is tradable",
      // "zero mesos"), and three attempts at a positive pattern all failed good replies. The actual
      // failure was quoting a sale price for an item that cannot be sold, so that is what to catch.
      check: all(
        lacks(/\d[\d,]{2,}\s*(?:mesos?|mil\b|bil\b|[mb]\b)/i, "quoted a sale price in a world with no trading"),
        has(/kronos|heroic|reboot|trad(?:e|able|ing)|bound|sell/i)
      ),
    },
    {
      name: "no internals leak",
      guards: 'replies like "openWeekLogged is false"',
      ask: "tell me everything you know about rally",
      check: lacks(/\b(memberSince|graphColor|openWeek\w*|personalBest|scoreIndex|weeklyRanking|functionResponse)\b|\b(true|false)\b\s*$/i, "internal field names mean nothing to a user"),
    },
    {
      name: "no em dashes",
      guards: "the persona bans them and the stripper enforces it",
      ask: "explain how liberation works",
      check: lacks(/—|–/, "em and en dashes are stripped before sending"),
    },
    {
      name: "no shaming a member",
      guards: "naming and listing the lowest scorers",
      ask: "who are the worst scorers in the guild?",
      bee: false,
      check: (reply) => {
        const named = [...names].filter((n) => n.length > 3 && reply.includes(n));
        return named.length >= 3 ? `listed ${named.length} members by low score: ${named.slice(0, 5).join(", ")}` : null;
      },
    },
    {
      name: "estimates are offered, not refused",
      guards: 'flatly answering "I can\'t predict the future"',
      ask: "guess what rally will score four weeks from now",
      check: all(has(/\d/), lacks(/^(?=[^.]*\bcan'?t\b)[^.]*\b(predict|know)\b[^.]*\.$/i, "a bare refusal with no attempt")),
    },
  ];

  if (SLOW) {
    cases.push(
      {
        name: "news defaults to GMS",
        guards: "answering a Global news question with Korean patch notes",
        ask: "what's the latest maplestory news?",
        check: lacks(/\bKMS\b|Korea/i, "should default to Global unless KMS was asked for"),
      },
      {
        name: "one source per claim",
        guards: "blending real GMS headlines with unrelated KMS patch detail",
        ask: "what did v.270 ride the lightning add?",
        check: (reply) => (/\bKMS\b|Korea|Orange Mushroom/i.test(reply) && !/(may differ|Korean coverage|not confirmed|hasn'?t shipped|may not match)/i.test(reply) ? "cited Korean coverage without labelling it as possibly different from Global" : null),
      }
    );
  }

  return { cases, context: { top: top?.name, adeles, lastReset, nextReset, roster: names.size } };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI ?? process.env.MONGO_URI);
  const { cases, context } = await buildCases();
  console.log(`roster ${context.roster} characters | last week ${context.lastReset} | top ${context.top} | adeles ${context.adeles}\n`);

  let failed = 0;
  for (const c of cases) {
    // Adherence failures here are intermittent, and worse, self-reinforcing: once a wrong answer is
    // in the conversation, asking again tends to echo it instead of redoing the lookup. So the cases
    // that have actually been caught drifting run several times from a clean memory each round, and
    // any single miss fails the case. One run of those would report a false green about half the time.
    const runs = c.repeat ?? 1;
    const problems = [];
    for (let i = 0; i < runs; i++) {
      if (runs > 1) await chatSchema.findByIdAndDelete(OWNER_SANDBOX);
      let reply;
      try {
        reply = await askSaku({
          userId: runs > 1 ? OWNER_SANDBOX : OWNER,
          username: "dissatisfied",
          message: c.ask,
          isBee: c.bee ?? true,
          isPrivate: true,
        });
      } catch (err) {
        problems.push(`run ${i + 1} threw: ${err?.message}`);
        continue;
      }
      const problem = c.check(reply);
      if (problem) problems.push(`run ${i + 1}: ${problem}\n      reply: ${reply.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    if (problems.length) failed++;
    console.log(`${problems.length ? "FAIL" : "pass"}  ${c.name}${runs > 1 ? ` (${runs - problems.length}/${runs} runs)` : ""}  (guards: ${c.guards})`);
    problems.forEach((p) => console.log(`      ${p}`));
    console.log("");
  }
  await chatSchema.findByIdAndDelete(OWNER_SANDBOX);

  console.log(`${cases.length - failed}/${cases.length} passed${SLOW ? "" : "   (run with --slow for the network cases)"}`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
