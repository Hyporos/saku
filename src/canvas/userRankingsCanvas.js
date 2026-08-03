const { AttachmentBuilder } = require("discord.js");
const { createHiDpiCanvas, loadAsset, avatarFor, displayNameOf, fitText, drawCircularImage } = require("./canvasUtils.js");

const BACKGROUNDS = {
  first: require.resolve("../assets/canvas/user-rankings-first.png"),
  other: require.resolve("../assets/canvas/user-rankings-other.png"),
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const WIDTH = 500;
const HEIGHT = 550;
const AVATAR = { x: 85, size: 35 };
const ROW_HEIGHT = 52.4;
const ROW_TOP = 22;
const NAME_X = AVATAR.x + AVATAR.size + 10;
const LEVEL_X = WIDTH - 200;
const NAME_MAX_WIDTH = LEVEL_X - NAME_X - 18;

// One bulk fetch for the whole page instead of an awaited members.fetch per row, which hit the REST
// API up to ten times to render ten lines. Failure is not fatal: whatever is already cached is used
// and anyone missing falls back to their stored name.
async function membersFor(guild, ids) {
  if (!guild || !ids.length) return new Map();
  try {
    return await guild.members.fetch({ user: ids });
  } catch {
    return guild.members.cache;
  }
}

async function generateUserRankingsCanvas(interaction, users) {
  const { canvas, context } = createHiDpiCanvas(WIDTH, HEIGHT);

  // Get the first user's rank to determine the page
  const isFirstPage = users.length > 0 ? users[0].rankPosition <= 10 : true;
  const background = await loadAsset(isFirstPage ? BACKGROUNDS.first : BACKGROUNDS.other);
  context.drawImage(background, 0, 0, WIDTH, HEIGHT);

  const members = await membersFor(
    interaction.guild,
    users.map((u) => u._id).filter(Boolean)
  );

  // Every avatar for the page is fetched at once. These used to run one after another inside the draw
  // loop, so a page took as long as ten round trips laid end to end.
  const rows = await Promise.all(
    users.map(async (user, i) => {
      const member = members.get?.(user._id) ?? null;
      return {
        rank: user.rankPosition || i + 1,
        name: member ? displayNameOf(member) : (user.username ?? "Unknown Member"),
        level: user.level,
        exp: user.exp,
        avatar: await avatarFor(member, 128),
      };
    })
  );

  // Draw a row for each user on the page
  rows.forEach((row, i) => {
    const y = ROW_TOP + i * ROW_HEIGHT;
    const baseline = y + AVATAR.size / 2 + 7;

    // Draw the ranking number
    context.font = "18px Quicksand";
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillText(`#${row.rank}`, 40, baseline);

    drawCircularImage(context, row.avatar, AVATAR.x, y, AVATAR.size);

    context.fillStyle = "#ffffff";
    context.fillText(fitText(context, row.name, NAME_MAX_WIDTH), NAME_X, baseline);

    // Draw the user's level and exp on the same line
    context.font = "16px Quicksand";
    context.fillStyle = "#ffffff";
    context.fillText(`Level:`, LEVEL_X, baseline);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${row.level}`, WIDTH - 153, baseline);
    context.fillStyle = "#ffffff";
    context.fillText(`EXP:`, WIDTH - 115, baseline);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${row.exp}`, WIDTH - 78, baseline);
  });

  // Create a discord attachment with the canvas
  return new AttachmentBuilder(await canvas.encode("png"), { name: "user-rankings.png" });
}

module.exports = { generateUserRankingsCanvas };
