const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { announcementTiming } = require("../src/commands/utility/birthday.js");

dayjs.extend(utc);
dayjs.extend(timezone);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// What /birthday set promises about when the wish lands. The nightly catch-up makes this depend on
// where in the month you are, and the interesting case is the last day: by the next midnight the
// month has rolled over, so the catch-up can no longer match and it has to wait for next year.
// No database or network, so this is safe to run any time.
//
// Run: node tests/birthdayTiming.js

const at = (iso) => dayjs.tz(iso, "America/Los_Angeles");

const CASES = [
  { name: "mid-month, own month", now: "2026-08-15", month: 8, wished: false, expect: /tomorrow, \*\*August 16\*\*/ },
  { name: "on the 1st, after the run went out", now: "2026-08-01", month: 8, wished: false, expect: /tomorrow, \*\*August 2\*\*/ },
  { name: "last day of a 31-day month waits a year", now: "2026-08-31", month: 8, wished: false, expect: /ends tonight.*next year/ },
  { name: "last day of a 30-day month waits a year", now: "2026-09-30", month: 9, wished: false, expect: /ends tonight.*next year/ },
  { name: "last day of February waits a year", now: "2026-02-28", month: 2, wished: false, expect: /ends tonight.*next year/ },
  { name: "second to last day still catches up", now: "2026-08-30", month: 8, wished: false, expect: /tomorrow, \*\*August 31\*\*/ },
  { name: "already wished this year", now: "2026-08-15", month: 8, wished: true, expect: /already been wished this year/ },
  { name: "a future month waits for the 1st", now: "2026-08-15", month: 12, wished: false, expect: /on the 1st of \*\*December\*\*/ },
  { name: "a month already gone waits for the 1st", now: "2026-08-15", month: 3, wished: false, expect: /on the 1st of \*\*March\*\*/ },
];

let failed = 0;
for (const c of CASES) {
  const got = announcementTiming(c.month, c.wished, at(c.now));
  const ok = c.expect.test(got);
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${c.name}`);
  if (!ok) console.log(`      ${got}\n      expected /${c.expect.source}/`);
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
