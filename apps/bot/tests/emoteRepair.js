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
const guild = {
  emojis: {
    cache: {
      find: (fn) => EMOTES.map((e) => ({ ...e, toString: () => `<${e.animated ? "a" : ""}:${e.name}:${e.id}>` })).find(fn),
    },
  },
};

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

// Names the model invented: dropped, not left as text
check("invented bare name is removed", repairEmotes("stop sandbagging :sakuNope:", guild), "stop sandbagging");
check("invented bracket name is removed", repairEmotes("hey <:sakuNope:> there", guild), "hey there");
check("invented name with a fake id is removed", repairEmotes("x <:sakuNope:999> y", guild), "x y");

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
