require("dotenv").config();
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const { announceBirthdays } = require("../src/utility/cronUtils.js");
const birthdayCmd = require("../src/commands/utility/birthday.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// /birthday and the monthly announcement, driven through the real command and the real announcer
// against throwaway user documents. Discord is stubbed; nothing is posted.
//
// Run: node tests/birthdays.js

let pass = 0, fail = 0;
const check = (ok, label) => {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}`);
  ok ? pass++ : fail++;
};

const IDS = ["888888888888888001", "888888888888888002", "888888888888888003", "888888888888888004"];
const sent = [];
const inGuild = new Set(IDS.slice(0, 3)); // the 4th has left the server
const client = {
  channels: {
    cache: {
      get: () => ({
        guild: { members: { cache: { has: (id) => inGuild.has(id) } } },
        send: async (payload) => sent.push(payload),
      }),
    },
  },
};

const interaction = (sub, month, userId) => {
  const replies = [];
  return {
    user: { id: userId },
    options: { getSubcommand: () => sub, getInteger: () => month },
    reply: async (p) => replies.push(p),
    replies,
  };
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.db.collection("user");
  const now = dayjs().tz("America/Los_Angeles");
  const month = now.month() + 1;
  const nextMonth = (month % 12) + 1;
  const year = now.year();

  // ⎯⎯ the command ⎯⎯ //
  const set = interaction("set", month, IDS[0]);
  await birthdayCmd.execute(set);
  check(/set to \*\*/.test(set.replies[0]?.content ?? ""), "set confirms the month back");
  const saved = await users.findOne({ _id: IDS[0] });
  check(saved.birthdayMonth === month, "stores the month as a number");
  check(saved.birthdayDate === undefined, "stores no free-text date");

  const clear = interaction("clear", null, IDS[0]);
  await birthdayCmd.execute(clear);
  check(/removed/.test(clear.replies[0]?.content ?? ""), "clear removes it");
  check(!(await users.findOne({ _id: IDS[0] })).birthdayMonth, "month is gone after clear");

  const empty = interaction("clear", null, IDS[1]);
  await birthdayCmd.execute(empty);
  check(/don't have/.test(empty.replies[0]?.content ?? ""), "clear on someone with no birthday says so");

  // ⎯⎯ the announcement ⎯⎯ //
  const seed = async (id, m) => users.updateOne({ _id: id }, { $set: { birthdayMonth: m, level: 1, exp: 0 } }, { upsert: true });
  await seed(IDS[0], month);
  await seed(IDS[1], month);
  await seed(IDS[2], nextMonth);
  await seed(IDS[3], month); // this month, but no longer in the server
  await users.updateMany({ _id: { $in: IDS } }, { $unset: { birthdayAnnouncedYear: "" } });

  await announceBirthdays(client);

  const description = sent[0]?.embeds?.[0]?.data?.description ?? "";
  check(sent.length === 1, `everyone shares one message, not one each (sent ${sent.length})`);
  check(description.includes(IDS[0]) && description.includes(IDS[1]), "everyone born this month is mentioned");
  check(!description.includes(IDS[2]), "someone born next month is not");
  check(!description.includes(IDS[3]), "someone who left the server is not");
  check(!description.includes("631337640754675725"), "no hardcoded owner mention");

  const marked = await users.find({ _id: { $in: [IDS[0], IDS[1]] } }).toArray();
  check(marked.every((u) => u.birthdayAnnouncedYear === year), "the announced year is recorded");

  // The schedule is once a month, but the guard must still hold if it is ever invoked twice.
  const before = sent.length;
  await announceBirthdays(client);
  check(sent.length === before, "a second run posts nothing");

  await users.deleteMany({ _id: { $in: IDS } });
  console.log(`\n${fail ? `${fail} FAILED` : "all passed"} (${pass}/${pass + fail})`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
})();
