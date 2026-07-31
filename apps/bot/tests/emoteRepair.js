const { repairEmotes } = require("../src/utility/sakuChat.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Emote repair. Discord renders a custom emote only as <:name:id>; every other shape the model
// writes arrives as literal text in the channel, so it has to be repaired or removed before sending.
//
// Run: node tests/emoteRepair.js

const EMOTES = [
  { name: "sakuSly", id: "111111111111111111" },
  { name: "sakuHammer", id: "222222222222222222" },
  { name: "sakuHappy", id: "333333333333333333", animated: true },
];
const built = EMOTES.map((e) => ({ ...e, toString: () => `<${e.animated ? "a" : ""}:${e.name}:${e.id}>` }));
const guild = { emojis: { cache: { find: (fn) => built.find(fn), values: () => built } } };

let failed = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

// The two shapes seen in the channel
check("bare :name: becomes a real emote", repairEmotes("nice one :sakuSly:", guild), "nice one <:sakuSly:111111111111111111>");
check("half-formed <:name:> becomes a real emote", repairEmotes("caught you <:sakuSly:>", guild), "caught you <:sakuSly:111111111111111111>");
check("bare :name: mid sentence", repairEmotes("get it done :sakuHammer: today", guild), "get it done <:sakuHammer:222222222222222222> today");

// Near misses are rescued rather than deleted: deleting one mid-sentence leaves broken grammar
// ("I'll give you a instead"), which is worse than the glitch it was meant to fix.
check("trailing-letter typo resolves", repairEmotes("caught you <:sakuSlyL:>", guild), "caught you <:sakuSly:111111111111111111>");
check("dropped-letter typo resolves", repairEmotes("nice :sakuHapy:", guild), "nice <a:sakuHappy:333333333333333333>");
check("wrong case resolves", repairEmotes("go :SAKUHAMMER:", guild), "go <:sakuHammer:222222222222222222>");
check("the reported sentence stays intact", repairEmotes("I'll give you a :sakuSlyy: instead.", guild), "I'll give you a <:sakuSly:111111111111111111> instead.");

// Only a name with no plausible match at all is dropped
check("unrelated name is removed", repairEmotes("stop sandbagging :sakuQwertyzzz:", guild), "stop sandbagging");
check("unrelated bracket name is removed", repairEmotes("hey <:sakuQwertyzzz:> there", guild), "hey there");
check("fake id is rebuilt from the name", repairEmotes("x <:sakuSly:999> y", guild), "x <:sakuSly:111111111111111111> y");
check("near miss never lands on a non-saku emote", repairEmotes(":notsaku:", guild), ":notsaku:");

// Already correct output is untouched
check("valid emote passes through", repairEmotes("gz <:sakuSly:111111111111111111>", guild), "gz <:sakuSly:111111111111111111>");
check("valid animated emote passes through", repairEmotes("<a:sakuHappy:333333333333333333> yay", guild), "<a:sakuHappy:333333333333333333> yay");
check("animated half-form is repaired", repairEmotes("<a:sakuHappy:>", guild), "<a:sakuHappy:333333333333333333>");

// Things that merely look like emotes must survive
check("ratios are left alone", repairEmotes("split it 3:4:5 between us", guild), "split it 3:4:5 between us");
check("non-saku colon words are left alone", repairEmotes("the plan :b: whatever", guild), "the plan :b: whatever");
check("clock times survive", repairEmotes("reset is at 12:00 UTC", guild), "reset is at 12:00 UTC");

// Formatting after a removal
check("no double space left behind", repairEmotes("well :sakuNope: played", guild), "well played");
check("no space before punctuation", repairEmotes("nice :sakuNope: .", guild), "nice.");
check("line breaks survive", repairEmotes("one\n\ntwo :sakuSly:", guild), "one\n\ntwo <:sakuSly:111111111111111111>");

// No guild (DM or a failed cache): unresolvable emotes must still not ship as text
check("without a guild, broken forms are stripped", repairEmotes("hey :sakuSly: there", null), "hey there");
check("without a guild, valid emotes survive", repairEmotes("hey <:sakuSly:111111111111111111>", null), "hey <:sakuSly:111111111111111111>");

console.log(`\n${failed ? failed + " FAILED" : "all passed"}`);
process.exit(failed ? 1 : 0);
