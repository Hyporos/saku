const {
  matchScannedName,
  parseScannedName,
  candidatesFor,
  pickCandidate,
} = require("../src/domain/culvert/scanMatch.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// /scan, /culvertping and the webapp scanner route all resolve a screenshot name through one function
// now. Getting it wrong is close to invisible — a misread name writes someone else's score, or drops a
// member, and nobody finds out until they check their own graph — so it is worth testing directly
// rather than only through a live scan.

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) =>
  check(name, actual === expected, actual === expected ? "" : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);

// A stand-in roster with the shapes that actually cause trouble: confusable letters, a shared prefix,
// and a name short enough that a four-letter edge covers all of it.
const ROSTER = ["adeldruu", "rally", "boompala", "druu", "abrese", "heatherhah", "heatherlynn", "illiana"];

// ⎯⎯ Clean reads ⎯⎯ //
eq("exact name", matchScannedName("adeldruu", ROSTER).name, "adeldruu");
eq("different case", matchScannedName("AdelDruu", ROSTER).name, "adeldruu");
eq("all caps", matchScannedName("RALLY", ROSTER).name, "rally");

// ⎯⎯ Truncation, which is how the guild list renders a long name ⎯⎯ //
eq("two-dot truncation", matchScannedName("boompa..", ROSTER).name, "boompala");
eq("three-dot truncation", matchScannedName("boomp...", ROSTER).name, "boompala");
eq("one-dot truncation", matchScannedName("boompal.", ROSTER).name, "boompala");
check("truncation is reported", parseScannedName("boompa..").truncated === true);
check("a clean name is not truncated", parseScannedName("boompala").truncated === false);

// A truncated prefix shared by two names has no right answer, so it takes the first rather than
// guessing — but it must still choose one of the two that actually share the prefix.
{
  const { name, candidates } = matchScannedName("heather..", ROSTER);
  check("ambiguous prefix picks a name that has it", ["heatherhah", "heatherlynn"].includes(name), name);
  check("ambiguous prefix reports both candidates", candidates.length === 2, candidates.join(", "));
}

// ⎯⎯ The letters OCR confuses ⎯⎯ //
eq("l read as I", matchScannedName("RaIly", ROSTER).name, "rally");
eq("I read as l", matchScannedName("llliana", ROSTER).name, "illiana");
eq("1 read as l", matchScannedName("ra11y", ROSTER).name, "rally");
eq("0 read as o", matchScannedName("b00mpala", ROSTER).name, "boompala");
eq("accent OCR invented", matchScannedName("rálly", ROSTER).name, "rally");

// ⎯⎯ Things that are not names ⎯⎯ //
// Each of these used to match whoever sorted first in the roster: an empty edge makes the pattern
// `^|$`, which matches every string there is.
eq("empty string matches nothing", matchScannedName("", ROSTER).name, null);
eq("whitespace matches nothing", matchScannedName("   ", ROSTER).name, null);
eq("bare ellipsis matches nothing", matchScannedName("..", ROSTER).name, null);
eq("bare dot matches nothing", matchScannedName(".", ROSTER).name, null);
eq("null matches nothing", matchScannedName(null, ROSTER).name, null);

// Regex metacharacters were interpolated raw, so "a+b" matched "abrese" via `^a+b`, and an
// unbalanced bracket threw and took the whole scan down.
eq("regex metacharacters do not match", matchScannedName("a+b", ROSTER).name, null);
check("unbalanced bracket does not throw", (() => {
  try { matchScannedName("Jo(n", ROSTER); return true; } catch { return false; }
})());
check("backslash does not throw", (() => {
  try { matchScannedName("a\\b", ROSTER); return true; } catch { return false; }
})());

// ⎯⎯ Nobody by that name ⎯⎯ //
eq("unknown name", matchScannedName("zzzzzzzz", ROSTER).name, null);
eq("empty roster", matchScannedName("adeldruu", []).name, null);

// ⎯⎯ The pieces, checked on their own ⎯⎯ //
{
  const parsed = parseScannedName("heatherhah");
  eq("beginning is the first four", parsed.beginning, "heat");
  eq("ending is the last four", parsed.ending, "rhah");
  eq("a truncated name has no ending", parseScannedName("heat..").ending, null);
  eq("stem drops the ellipsis", parseScannedName("heat..").stem, "heat");
}
{
  const parsed = parseScannedName("heather..");
  const found = candidatesFor(parsed, ROSTER);
  check("candidatesFor finds both heathers", found.length === 2, found.join(", "));
  check("pickCandidate returns one of them", ["heatherhah", "heatherlynn"].includes(pickCandidate(parsed, found)));
  eq("pickCandidate on nothing", pickCandidate(parsed, []), null);
}

// ⎯⎯ A short name must not swallow the roster ⎯⎯ //
// "druu" is four letters, so its beginning and ending are the whole name, and it appears inside
// "adeldruu". The exact-match fast path is what keeps it landing on itself.
eq("short name prefers its exact match", matchScannedName("druu", ROSTER).name, "druu");

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
