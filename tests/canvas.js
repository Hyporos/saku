const fs = require("node:fs");
const path = require("node:path");
const { createCanvas } = require("@napi-rs/canvas");
const { generateUserLevelCanvas } = require("../src/canvas/userLevelCanvas.js");
const { generateUserRankingsCanvas } = require("../src/canvas/userRankingsCanvas.js");
const { displayNameOf, fitText } = require("../src/canvas/canvasUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Renders both cards against the cases the old code broke on. Pass `--write <dir>` to also drop the
// PNGs somewhere to look at them.

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
// what the old canvas read and crashed on for anyone without a server nickname.
const member = (displayName) => ({
  displayName,
  user: { username: "fallbackname", displayAvatarURL: () => null },
  avatarURL: () => null,
});

(async () => {
  // ⎯⎯ Names ⎯⎯ //
  check("a member with no nickname resolves instead of throwing", displayNameOf(member("Brian")) === "Brian");
  check("an all-emoji name does not render blank", displayNameOf(member("🐝🐝🐝")).length > 0);
  check("a parenthetical is stripped", displayNameOf(member("Brian (Kronos)")) === "Brian");
  check("a missing member yields the fallback", displayNameOf(undefined) === "Unknown");

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

  // ⎯⎯ Leaderboard ⎯⎯ //
  const users = Array.from({ length: 10 }, (_, i) => ({
    _id: `${i}`,
    username: `Stored Name ${i}`,
    level: 30 - i,
    exp: 500 - i,
    rankPosition: i + 1,
  }));

  // Half the page resolves to a live member and half does not, which exercises the stored-name path
  // for people who have left the server.
  const interaction = {
    guild: {
      members: {
        fetch: async () => new Map(users.slice(0, 5).map((u) => [u._id, member(`Live Member ${u._id} With A Long Name`)])),
        cache: new Map(),
      },
    },
  };

  const board = await generateUserRankingsCanvas(interaction, users);
  save("leaderboard", board);
  check("leaderboard renders with mixed live and departed members", board.attachment.length > 1000, `${board.attachment.length} bytes`);

  const empty = await generateUserRankingsCanvas(interaction, []);
  check("leaderboard renders with no users", empty.attachment.length > 1000);

  // A guild fetch that rejects must fall back rather than take the card down.
  const broken = { guild: { members: { fetch: async () => { throw new Error("no intent"); }, cache: new Map() } } };
  const fallback = await generateUserRankingsCanvas(broken, users);
  check("leaderboard survives a failed member fetch", fallback.attachment.length > 1000);

  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
