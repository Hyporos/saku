const {
  matchScannedName,
  parseScannedName,
  candidatesFor,
  pickCandidate,
  exceptionMapper,
  parseScanEntries,
  displayScannedName,
  resolveScan,
  groupIndex,
  planGroup,
  parseGroupList,
  toKey,
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

// ⎯⎯ The guild list layout from 2026-11: "Character(Main)", truncated anywhere ⎯⎯ //
// Membership is per account group and the character before the bracket changes freely, so the main
// wins; the character settles ties and is the fallback when the main isn't linked.
{
  const R = ["beezlebub", "caycia", "cayro", "wrignt", "bloom", "yong", "katie"];
  eq("bracketed main", matchScannedName("Katie(bloom)", R).name, "bloom");
  eq("main cut off with dots", matchScannedName("wrignt(wrig..", R).name, "wrignt");
  eq("main cut off with the dots lost", matchScannedName("Zorbo(Bee", R).name, "beezlebub");
  eq("short main settled by the character", matchScannedName("Caycia(Cay..", R).name, "caycia");
  eq("same character twice", matchScannedName("Yong(Yong)", R).name, "yong");
  eq("unlinked main falls back to the character", matchScannedName("katie(Nobody)", R).name, "katie");
  eq("space before the bracket", matchScannedName("Katie (bloom)", R).name, "bloom");
  eq("exception on the main half", matchScannedName("Alt(Beez1e)", R, exceptionMapper([{ exception: "beez1e", name: "beezlebub" }])).name, "beezlebub");
  eq("exception on the whole cell", matchScannedName("X(Y..", R, exceptionMapper([{ exception: "x(y..", name: "yong" }])).name, "yong");
  eq("truncated whole cell still matches", matchScannedName("Cayci..", R).name, "caycia");
  eq("bare bracket matches nothing", matchScannedName("(", R).name, null);
  eq("shown readably when unmatched", displayScannedName("Beezle(Bee"), "Beezle (Bee..)");
  const { scores } = parseScanEntries(["Katie (bloom) 1234", "Caycia(Cay.. 197190"], (n) => n);
  eq("scan line keeps the bracket", scores[0].name, "Katie(bloom)");
  eq("scan line keeps its score", scores[1].score, 197190);
}

// ⎯⎯ resolveScan: one screenshot, decided whole ⎯⎯ //
// Mains are stable and the character before the bracket isn't, so Saku learns main → linked
// character from exact matches only, and every rule below decides what a row may save or teach.
{
  const WEEK = "2026-11-11";
  const past = (...scores) => scores.map((score, i) => ({ date: `2026-10-${String(7 + i * 7).padStart(2, "0")}`, score }));
  const ROSTER = [
    { _id: "111", characters: [{ name: "Katie", memberSince: "Jan 01, 2025", scores: past(100000, 110000, 105000) }] },
    { _id: "222", characters: [{ name: "Bloom", scores: [...past(200000, 190000, 195000), { date: WEEK, score: 1 }] }] },
    { _id: "333", characters: [{ name: "Caycia", scores: past(60000) }] },
    { _id: "444", characters: [{ name: "Cayro", scores: past(60000) }] },
    { _id: "555", characters: [{ name: "Newbie", memberSince: "Dec 01, 2026", scores: [] }] },
    { _id: "666", characters: [{ name: "Wrignt", scores: past(150000, 150000, 150000) }] },
    { _id: "777", characters: [{ name: "Zed", scores: past(90000, 90000, 90000) }] },
    { _id: "888", characters: [{ name: "Abcdefgh", scores: [] }] },
  ];
  const MAPS = [{ _id: "m1", kind: "main", source: "auto", exception: "GhostRep..", name: "zed" }];
  const run = (rows, mappings = MAPS) =>
    resolveScan({ rows: rows.map(([name, score]) => ({ name, score })), roster: ROSTER, mappings, week: WEEK });
  const row = (result, raw) => result.rows.find((r) => r.raw === raw);

  // Key normalizing, on both sides
  eq("key drops case, spaces and trailing dots", toKey(" Bee Zle.. "), "beezle");
  eq("misread found with dots on either side", exceptionMapper([{ exception: "Boompa..", name: "boompala" }])("boompa"), "boompala");

  // A known main
  let r = run([["Alt(Bloom)", 150000]]);
  eq("linked main matches", row(r, "Alt(Bloom)").name, "Bloom");
  eq("linked main teaches nothing", r.learned.length, 0);
  check("sandbag flag kept", row(r, "Alt(Bloom)").sandbag === true && row(r, "Alt(Bloom)").personalBest === 200000);
  check("an existing score is replaced, not added", r.saves[0].replace === true);
  eq("mapped main matches", run([["Whoever(GhostRep)", 90000]]).rows[0].name, "Zed");
  eq("mapped main matches when cut", run([["X(Ghost..", 90000]]).rows[0].name, "Zed");
  eq("misread on the main half", run([["Alt(B1oom)", 200000]], [{ exception: "b1oom", name: "Bloom" }]).rows[0].name, "Bloom");

  // Rule 2: learn only from an exact match, and say so
  r = run([["Katie(Ranger)", 106000]]);
  eq("unknown main falls to the exact character", row(r, "Katie(Ranger)").status, "saved");
  eq("main is learned", r.learned.length, 1);
  check("learned item names the key, character and person",
    r.learned[0]?.key === "ranger" && r.learned[0]?.name === "Katie" && r.learned[0]?.discordId === "111" && r.learned[0]?.replaces === null);
  eq("cut main is never learned", run([["Katie(Rang..", 106000]]).learned.length, 0);
  eq("fuzzy character is never learned", run([["Katle(Qwerty)", 106000]]).learned.length, 0);
  eq("fuzzy character still saves", run([["Katle(Qwerty)", 106000]]).rows[0].status, "saved");

  // Rule 3: one row, one person
  r = run([["Katie(Ranger)", 106000], ["Kat(Katie)", 104000]]);
  check("two rows for one person both conflict", r.rows.every((x) => x.status === "conflict"));
  eq("a conflict saves nothing", r.saves.length, 0);
  eq("a conflict learns nothing", r.learned.length, 0);
  check("the conflict carries both raw cells", r.conflicts[0]?.rows.map((x) => x.raw).join("|") === "Katie(Ranger)|Kat(Katie)");

  // Rule 4: a changed main replaces the person's old mapping
  r = run([["Katie(NewRep)", 106000]], [...MAPS, { _id: "m2", kind: "main", exception: "oldrep", name: "Katie" }]);
  check("main change replaces the old one", r.learned[0]?.key === "newrep" && r.learned[0]?.replaces?.key === "oldrep" && r.learned[0]?.replaces?.id === "m2");
  eq("old main still matches until replaced", run([["Alt(OldRep)", 106000]], [{ kind: "main", exception: "oldrep", name: "Katie" }]).rows[0].name, "Katie");

  // Rule 5: coverage
  r = run([["Alt(Bloom)", 195000], ["Xbcdefgx(Qwerty)", 1], ["Foo(Bar)", 148000]]);
  const missingOf = (id) => r.missing.find((m) => m.discordId === id);
  check("unrowed active people are missing", ["111", "333", "444", "666", "777", "888"].every((id) => missingOf(id)));
  check("someone not in the guild yet is not missing", !missingOf("555"));
  check("someone with a row is not missing", !missingOf("222"));
  check("paired by name", missingOf("888")?.suggestion?.raw === "Xbcdefgx(Qwerty)" && missingOf("888")?.suggestion?.by === "name");
  check("paired by score when names share nothing", missingOf("666")?.suggestion?.raw === "Foo(Bar)" && missingOf("666")?.suggestion?.by === "score");
  eq("suggestion keys on the bracketed name", missingOf("666")?.suggestion?.main, "bar");
  eq("no pairing without a likely row", missingOf("333")?.suggestion ?? null, null);

  // Rule 6: a cut main that fits several people is never guessed
  r = run([["Zorbo(Cay..", 120000]]);
  eq("ambiguous cut main is unmatched", r.rows[0].status, "ambiguous");
  check("candidates come back as suggestions", r.rows[0].suggestions?.join(",") === "Caycia,Cayro");
  eq("the character settles it", run([["Caycia(Cay..", 120000]]).rows[0].name, "Caycia");
  eq("a cut main with one owner is fine", run([["Q(Wrig..", 150000]]).rows[0].name, "Wrignt");

  // Rule 7: score sanity on a row matched without its main
  r = run([["Katie(Ranger)", 400000]]);
  eq("far above PB is a check", r.rows[0].status, "check");
  check("a check saves and learns nothing", r.saves.length === 0 && r.learned.length === 0);
  check("the check says why", r.checks[0]?.reason === "high" && r.checks[0]?.main === "ranger");
  eq("far below average is a check", run([["Katie(Ranger)", 30000]]).rows[0].status, "check");
  eq("a known main is never checked", run([["Alt(Bloom)", 900000]]).rows[0].status, "saved");
  eq("too little history is never checked", run([["Caycia(NewMain)", 900000]]).rows[0].status, "saved");

  // Absent and not found
  eq("joined after the week is absent", run([["Newbie(Newbie)", 5]]).rows[0].status, "absent");
  eq("nobody is notFound", run([["Nobody(Noone)", 5]]).rows[0].status, "notFound");
  eq("a NaN score saves as 0", run([["Alt(Bloom)", NaN]]).saves[0].score, 0);
}

// ⎯⎯ Declared groups: /character group outranks learned and misread mappings ⎯⎯ //
{
  const WEEK = "2026-11-11";
  const past = (...scores) => scores.map((score, i) => ({ date: `2026-10-${String(7 + i * 7).padStart(2, "0")}`, score }));
  const ROSTER = [
    {
      _id: "111",
      characters: [{ name: "Katie", scores: past(100000, 110000, 105000) }, { name: "Kitty", scores: [] }],
      group: { main: "Sunflower", characters: ["Moonbeam", "Katie"], scoresTo: "Katie" },
    },
    { _id: "222", characters: [{ name: "Bloom", scores: past(200000, 190000, 195000) }], group: { main: "Bloomrep", characters: ["Sunbeam"], scoresTo: "Bloom" } },
    { _id: "333", characters: [{ name: "Rosa", scores: [] }], group: { main: "Moonlit", characters: [], scoresTo: "Gone" } },
    { _id: "444", characters: [{ name: "Zed", scores: past(90000, 90000, 90000) }] },
  ];
  const run = (rows, mappings = []) =>
    resolveScan({ rows: rows.map(([name, score]) => ({ name, score })), roster: ROSTER, mappings, week: WEEK });

  let r = run([["Whoever(Sunflower)", 106000]]);
  eq("group by bracketed main", r.rows[0].name, "Katie");
  eq("...via the group", r.rows[0].via, "group");
  eq("...teaches nothing", r.learned.length, 0);
  eq("group by logged-in name", run([["Moonbeam(NewRep)", 106000]]).rows[0].name, "Katie");
  eq("a logged-in group name learns no main", run([["Moonbeam(NewRep)", 106000]]).learned.length, 0);
  eq("a group name with no bracket", run([["Sunbeam", 195000]]).rows[0].name, "Bloom");
  eq("group name matched through confusables", run([["X(SunfIower)", 106000]]).rows[0].name, "Katie");
  eq("bracket outranks the character beside it", run([["Sunbeam(Sunflower)", 106000]]).rows[0].name, "Katie");
  eq("truncated main, one group fits", run([["Q(Sunf..", 106000]]).rows[0].name, "Katie");
  r = run([["Q(Moon..", 106000]]);
  check("truncated main, two groups fit: not guessed by group", r.rows[0].via !== "group", JSON.stringify(r.rows[0]));
  eq("...the character beside it still settles it", run([["Moonbeam(Moon..", 106000]]).rows[0].name, "Katie");
  eq("a cut main loses to a character plainly someone else's", run([["Zed(Sunf..", 90000]]).rows[0].name, "Zed");
  eq("a group with a gone scoresTo falls back to their first character", run([["X(Moonlit)", 1000]]).rows[0].name, "Rosa");

  // A group beats a learned main and a misread pointing elsewhere.
  r = run([["Alt(Sunflower)", 106000]], [{ _id: "m1", kind: "main", source: "auto", exception: "sunflower", name: "Zed" }]);
  eq("group beats a learned mapping", r.rows[0].name, "Katie");
  r = run([["Alt(Bloomrep)", 195000]], [{ exception: "bloomrep", name: "Zed" }]);
  eq("group beats a misread", r.rows[0].name, "Bloom");

  // Learning never claims a group name, and the existing rules still hold.
  r = run([["Zed(Moonbeam)", 90000]]);
  eq("bracketed group name wins over the character beside it", r.rows[0].name, "Katie");
  eq("...and is never learned", r.learned.length, 0);
  r = run([["Moonbeam(Sunflower)", 106000], ["Katie(Katie)", 104000]]);
  check("one row, one person still holds for groups", r.rows.every((x) => x.status === "conflict"));
  r = run([["Alt(Sunflower)", 900000]]);
  eq("a declared group is not score-checked", r.rows[0].status, "saved");
  check("coverage counts a group row", !r.missing.some((m) => m.discordId === "111"));

  // /culvertping matches through the same groups.
  const groups = groupIndex(ROSTER);
  const names = ["katie", "kitty", "bloom", "rosa", "zed"];
  eq("culvertping: group by bracket", matchScannedName("Alt(Sunflower)", names, (n) => n, groups).name, "katie");
  eq("culvertping: group by logged-in name", matchScannedName("Moonbeam(Unknown)", names, (n) => n, groups).name, "katie");
  eq("culvertping: no groups, no change", matchScannedName("Alt(Bloom)", names).name, "bloom");
  check("a name two people declared decides nothing", groupIndex([
    { _id: "1", characters: [{ name: "A1" }], group: { main: "Same", scoresTo: "A1" } },
    { _id: "2", characters: [{ name: "B1" }], group: { main: "Same", scoresTo: "B1" } },
  ]).get("same") === null);
  // Declaring a group: scoresTo default, and names that belong to somebody else.
  const plan = (input) => planGroup({ discordId: "111", roster: ROSTER, ...input });
  eq("scoresTo defaults to the main when it is linked", plan({ main: "Kitty", alts: ["Moonbeam"] }).group?.scoresTo, "Kitty");
  eq("...else to their first linked character", plan({ main: "Sunflower" }).group?.scoresTo, "Katie");
  eq("scoresTo given is kept in its real spelling", plan({ main: "Sunflower", scoresTo: "kitty" }).group?.scoresTo, "Kitty");
  check("scoresTo must be their own linked character", Boolean(plan({ main: "Sunflower", scoresTo: "Zed" }).error));
  check("a duplicate name is refused", Boolean(plan({ main: "Sunflower", alts: ["sunflower"] }).error));
  check("a name linked to someone else is refused", /linked to someone else/.test(plan({ main: "Sunflower", alts: ["Zed"] }).error ?? ""));
  check("a name in someone else's group is refused", /someone else's group/.test(plan({ main: "Sunbeam" }).error ?? ""));
  check("their own group's names are fine to reuse", Boolean(plan({ main: "Sunflower", alts: ["Moonbeam"] }).group));
  check("no linked character is refused", /Ask a bee/.test(planGroup({ discordId: "999", main: "X", roster: ROSTER }).error ?? ""));
}

// ⎯⎯ Reading a Group List screenshot ⎯⎯ //
{
  const list = (text) => parseGroupList(text).join(",");
  eq("one name per line, in row order", list("Bellze\nBellzeBeast\nbelzadena"), "Bellze,BellzeBeast,belzadena");
  eq("blank lines and headers are skipped", list("Name\n\nBellze\n  \nJob\nLevel:\nBelzaran\n"), "Bellze,Belzaran");
  eq("the window title is skipped", list("Group List\nBellze"), "Bellze");
  eq("a stray Job and Level column is cut off", list("Bellze Night Lord 295\nBellzren Ren 280"), "Bellze,Bellzren");
  eq("bullets and numbering are removed", list("- Bellze\n2. Bellzren\n* `Belzaran`"), "Bellze,Bellzren,Belzaran");
  eq("a name starting with a digit keeps it", list("1Bellze"), "1Bellze");
  eq("a repeated row counts once, whatever its case", list("Bellze\nbellze\nBELLZE\nBellzren"), "Bellze,Bellzren");
  eq("more than six rows keep the first six", list("a1\na2\na3\na4\na5\na6\na7\na8"), "a1,a2,a3,a4,a5,a6");
  eq("special characters are kept", list("Bellzö"), "Bellzö");
  eq("an empty answer reads nothing", list(""), "");
  eq("a CRLF answer reads the same", list("Bellze\r\nBellzren\r\n"), "Bellze,Bellzren");
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
