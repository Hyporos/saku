const { AttachmentBuilder } = require("discord.js");
const { loadImage } = require("@napi-rs/canvas");
const { request } = require("undici");
const { createHiDpiCanvas, loadAsset, displayNameOf, fitText, drawCircularImage, DEFAULT_AVATAR } = require("./canvasUtils.js");

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
// "Unknown Member" measures 153px at 18px Quicksand, so the budget has to clear that or the longest
// name on the board is the one that gets cut.
const NAME_MAX_WIDTH = LEVEL_X - NAME_X - 6;

// Members are still looked up one id at a time, exactly as they always have been. Every attempt to
// make this cleverer — batching it, putting a shorter clock on it — ended with real people rendering
// as Unknown Member, so it is left alone.
const MEMBER_DEADLINE_MS = 4000;

// Pictures are the one thing on a clock. undici waits five minutes by default and image decoding has
// no limit at all, so one avatar that never answers used to hold the whole page open.
//
// This does NOT use canvasUtils' cached avatarFor, and that is deliberate. Routing the leaderboard
// through the shared cache — or lengthening this deadline to match it — was tried and reverted: a page
// of thirty rows is a completely different problem from the level card's single avatar, and every
// version that shared the machinery ended with real members rendering as Unknown Member. Only the URL
// is shared, because a second copy of that literal is just a second thing to get wrong.
const DEADLINE_MS = 1500;

const withDeadline = (work, ms = DEADLINE_MS) =>
  Promise.race([work, new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms).unref())]);

const fetchImage = async (url) => {
  const { body } = await request(url, {
    headersTimeout: DEADLINE_MS,
    bodyTimeout: DEADLINE_MS,
    // A hard ceiling whichever phase stalls, since a request timeout cannot interrupt a decode that
    // has already begun.
    signal: AbortSignal.timeout(DEADLINE_MS),
  });
  return loadImage(Buffer.from(await body.arrayBuffer()));
};

// The fallback for every failure, so it must never be the thing that fails. Fetched once and reused.
let defaultAvatar = null;
async function getDefaultAvatar() {
  if (defaultAvatar) return defaultAvatar;
  try {
    defaultAvatar = await withDeadline(fetchImage(DEFAULT_AVATAR));
  } catch {
    defaultAvatar = null;
  }
  return defaultAvatar;
}

// Handled separately on purpose: someone whose picture will not load is still in the guild and keeps
// their name.
async function resolveRow(guild, user) {
  let member = null;
  try {
    member = await withDeadline(guild.members.fetch(user._id), MEMBER_DEADLINE_MS);
  } catch {
    member = null;
  }

  let avatar = null;
  try {
    const avatarURL = member
      ? member.avatarURL({ extension: "png" }) || member.user.displayAvatarURL({ extension: "png" })
      : DEFAULT_AVATAR;
    avatar = await withDeadline(fetchImage(avatarURL));
  } catch {
    avatar = await getDefaultAvatar();
  }

  return { member, avatar };
}

// ⎯⎯ "You are here" ⎯⎯ //

// Measured off the background art rather than guessed, so the highlight lands exactly on a row instead
// of near one. The top three rows carry gold, silver and bronze washes of their own; this is the same
// idea in the accent colour, for whoever ran the command.
const ROW = { x: 20, width: 460, top: 20, height: 40, step: 52.33, radius: 10 };

function drawYouAreHere(context, index) {
  const y = ROW.top + index * ROW.step;

  // Brightest at the coloured edge and gone by three quarters across, which is how the podium washes
  // in the artwork behave.
  const glow = context.createLinearGradient(ROW.x, 0, ROW.x + ROW.width * 0.75, 0);
  glow.addColorStop(0, "rgba(255, 195, 197, 0.22)");
  glow.addColorStop(1, "rgba(255, 195, 197, 0)");

  context.save();
  context.beginPath();
  context.roundRect(ROW.x, y, ROW.width, ROW.height, ROW.radius);
  context.clip();
  context.fillStyle = glow;
  context.fillRect(ROW.x, y, ROW.width, ROW.height);
  context.restore();
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

async function generateUserRankingsCanvas(interaction, users, highlightId = null) {
  const { canvas, context } = createHiDpiCanvas(WIDTH, HEIGHT);

  // Get the first user's rank to determine the page
  const isFirstPage = users.length > 0 ? users[0].rankPosition <= 10 : true;

  // Create and stretch the background image to fit the canvas
  const background = await loadAsset(isFirstPage ? BACKGROUNDS.first : BACKGROUNDS.other);
  context.drawImage(background, 0, 0, WIDTH, HEIGHT);

  // Drawn straight after the background so it sits under the avatars and text rather than over them.
  const mine = highlightId ? users.findIndex((user) => user._id === highlightId) : -1;
  if (mine !== -1) drawYouAreHere(context, mine);

  const resolved = await Promise.all(users.map((user) => resolveRow(interaction.guild, user)));

  // Draw a row for each of the top 10 users
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const rank = user.rankPosition || i + 1;
    const y = ROW_TOP + i * ROW_HEIGHT;
    const baseline = y + AVATAR.size / 2 + 7;
    const { member, avatar } = resolved[i];

    // Draw the ranking number
    context.font = "18px Quicksand";
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillText(`#${rank}`, 40, baseline);

    drawCircularImage(context, avatar, AVATAR.x, y, AVATAR.size);

    // Anyone the guild could not resolve has left, so there is no name left to show for them.
    context.fillStyle = "#ffffff";
    const name = member ? displayNameOf(member, "Unknown Member") : user.username || "Unknown Member";
    context.fillText(fitText(context, name, NAME_MAX_WIDTH), NAME_X, baseline);

    // Draw the user's level and exp on the same line
    context.font = "16px Quicksand";
    context.fillStyle = "#ffffff";
    context.fillText(`Level:`, LEVEL_X, baseline);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${user.level}`, WIDTH - 153, baseline);
    context.fillStyle = "#ffffff";
    context.fillText(`EXP:`, WIDTH - 115, baseline);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${user.exp}`, WIDTH - 78, baseline);
  }

  // Create a discord attachment with the canvas
  return new AttachmentBuilder(await canvas.encode("png"), { name: "user-rankings.png" });
}

module.exports = { generateUserRankingsCanvas };
