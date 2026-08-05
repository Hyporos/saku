const fs = require("node:fs");
const path = require("node:path");
const { createCanvas } = require("@napi-rs/canvas");
const { generateUserLevelCanvas } = require("../src/canvas/userLevelCanvas.js");
const { displayNameOf, fitText } = require("../src/canvas/canvasUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Renders the level card against the cases the old code broke on. Pass `--write <dir>` to also drop
// the PNGs somewhere to look at them.

const writeIndex = process.argv.indexOf("--write");
const writeDir = writeIndex === -1 ? null : process.argv[writeIndex + 1];

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const save = (name, attachment) => {
  if (writeDir) fs.writeFileSync(path.join(writeDir, `${name}.png`), attachment.attachment);
};

// A GuildMember stub shaped like a real one: note there is no `username` property on it, which is
// what the old card read and crashed on for anyone without a server nickname.
const member = (displayName) => ({
  displayName,
  partial: false,
  user: { username: "fallbackname", displayAvatarURL: () => null },
  avatarURL: () => null,
});

// What the cache holds when GuildMember partials are enabled: no user object, so the real
// `displayName` getter (`this.nickname ?? this.user.displayName`) throws when it is read.
const partialMember = () => ({
  partial: true,
  nickname: null,
  avatarURL: () => null,
  get displayName() {
    throw new TypeError("Cannot read properties of undefined (reading 'displayName')");
  },
});

(async () => {
  // ⎯⎯ Names ⎯⎯ //
  check("a member with no nickname resolves instead of throwing", displayNameOf(member("Brian")) === "Brian");
  check("an all-emoji name does not render blank", displayNameOf(member("🐝🐝🐝")).length > 0);
  check("a parenthetical is stripped", displayNameOf(member("Brian (Kronos)")) === "Brian");
  check("a missing member yields the fallback", displayNameOf(undefined) === "Unknown");
  check("a partial member whose displayName getter throws is survivable", displayNameOf(partialMember()) === "Unknown");

  const context = createCanvas(10, 10).getContext("2d");
  context.font = "24px Quicksand";
  const fitted = fitText(context, "A".repeat(200), 200);
  check("a long name is ellipsized to fit", context.measureText(fitted).width <= 200 && fitted.endsWith("…"));
  check("a short name is left alone", fitText(context, "Brian", 200) === "Brian");

  // ⎯⎯ Level card ⎯⎯ //
  const cards = [
    ["zero-exp", { level: 1, exp: 0 }, 175],
    ["tiny-exp", { level: 1, exp: 2 }, 175],
    ["half", { level: 5, exp: 250 }, 475],
    ["over-full", { level: 5, exp: 99999 }, 475],
    ["max-level", { level: 101, exp: 4200 }, Infinity],
  ];
  for (const [label, user, requiredExp] of cards) {
    const card = await generateUserLevelCanvas(member("A Very Long Nickname Indeed Yes"), user, requiredExp, "#3");
    save(`level-${label}`, card);
    check(`level card renders: ${label}`, card.attachment.length > 1000, `${card.attachment.length} bytes`);
  }

  // ⎯⎯ Leaderboard: nothing may wait forever ⎯⎯ //
  // One member whose avatar never answers used to hold the whole page open indefinitely, so the
  // command blew past the three seconds Discord allows and reported that Saku had not responded.
  {
    const net = require("node:net");
    const { generateUserRankingsCanvas } = require("../src/canvas/userRankingsCanvas.js");
    const server = net.createServer(() => {}); // accepts the connection, then never answers
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const stalled = `http://127.0.0.1:${server.address().port}/avatar.png`;

    const stub = (name, url) => ({
      nickname: name,
      user: { username: name, displayAvatarURL: () => url },
      avatarURL: () => url,
    });
    const rows = Array.from({ length: 10 }, (_, i) => ({ _id: `u${i}`, level: 21, exp: 100 - i, rankPosition: 41 + i }));

    const timed = async (label, guild) => {
      const started = Date.now();
      const drawn = await Promise.race([
        generateUserRankingsCanvas({ guild }, rows),
        new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);
      const elapsed = Date.now() - started;
      check(`${label} — draws without hanging`, drawn !== null && elapsed < 10000, `${elapsed}ms`);
      return drawn;
    };

    await timed("one stalled avatar", { members: { fetch: async (id) => stub(id, id === "u3" ? stalled : null) } });
    await timed("every avatar stalled", { members: { fetch: async (id) => stub(id, stalled) } });
    await timed("the member lookup itself hangs", { members: { fetch: () => new Promise(() => {}) } });

    // A member whose avatar will not load is still in the guild and must keep their name.
    const kept = await generateUserRankingsCanvas(
      { members: { fetch: async () => stub("Boompala (Hyunpil)", stalled) } },
      [rows[0]]
    );
    save("leaderboard-stalled-avatar", kept);
    check("a stalled avatar costs the picture, not the name", kept.attachment.length > 1000);

    server.close();
  }

  // Costs the full avatar timeout to run, so it is opt-in: `node tests/canvas.js --slow`.
  if (process.argv.includes("--slow")) {
    const net = require("node:net");
    const { avatarFor } = require("../src/canvas/canvasUtils.js");
    const server = net.createServer(() => {}); // accepts the connection, then never answers
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const stalled = `http://127.0.0.1:${server.address().port}/never-answers.png`;
    const stub = { partial: false, avatarURL: () => stalled, user: { displayAvatarURL: () => stalled } };

    const started = Date.now();
    const image = await avatarFor(stub, 128);
    const first = Date.now() - started;
    check("a stalled avatar gives up rather than hanging the card", image !== null && first < 15000, `${first}ms`);

    const again = Date.now();
    await avatarFor(stub, 128);
    check("...and is not retried on the next view", Date.now() - again < 1000, `${Date.now() - again}ms`);
    server.close();
  }

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
