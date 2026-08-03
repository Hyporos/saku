const { AttachmentBuilder } = require("discord.js");
const {
  createHiDpiCanvas,
  loadAsset,
  avatarFor,
  displayNameOf,
  fitText,
  drawCircularImage,
  fillRoundedRect,
} = require("./canvasUtils.js");

const BACKGROUND = require.resolve("../assets/canvas/user-level.png");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const WIDTH = 600;
const HEIGHT = 150;
const AVATAR_SIZE = 120;
const TEXT_X = 160;
const BAR = { x: 160, y: 103, width: 405, height: 20, radius: 10 };

async function generateUserLevelCanvas(targetMember, user, requiredExp, rank) {
  const { canvas, context } = createHiDpiCanvas(WIDTH, HEIGHT);

  // Create and stretch the background image to fit the canvas
  const [background, avatar] = await Promise.all([loadAsset(BACKGROUND), avatarFor(targetMember, 256)]);
  context.drawImage(background, 0, 0, WIDTH, HEIGHT);

  drawCircularImage(context, avatar, 20, (HEIGHT - AVATAR_SIZE) / 2, AVATAR_SIZE);

  // Draw the user's username
  context.font = "24px Quicksand";
  context.fillStyle = "#ffffff";

  const displayName = fitText(context, displayNameOf(targetMember), BAR.width);
  context.fillText(displayName, TEXT_X, 44);

  // Draw a thin line below the username
  const usernameWidth = context.measureText(displayName).width;

  context.beginPath();
  context.moveTo(TEXT_X, 54);
  context.lineTo(TEXT_X + usernameWidth, 54);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 195, 197, 0.8)";
  context.stroke();

  // Past the last level in the table getRequiredExp returns Infinity, which used to print literally
  // as "EXP: 4200/Infinity" and left the bar empty. A maxed out card reads MAX and fills.
  const maxed = !Number.isFinite(requiredExp) || requiredExp <= 0;
  const progress = maxed ? 1 : Math.min(1, Math.max(0, user.exp / requiredExp));

  // Draw the user's level, exp, and rank
  context.font = "18px Quicksand";
  context.fillStyle = "rgba(255, 255, 255, 0.85)";

  const expText = maxed ? "MAX" : `${user.exp}/${requiredExp}`;
  context.fillText(fitText(context, `Level: ${user.level}     EXP: ${expText}     Rank: ${rank}`, BAR.width), TEXT_X, 79);

  // Draw the progress bar background
  context.fillStyle = "#36383f";
  fillRoundedRect(context, BAR.x, BAR.y, BAR.width, BAR.height, BAR.radius);

  // Draw the filled part of the progress bar
  context.fillStyle = "#ffc3c5";
  fillRoundedRect(context, BAR.x, BAR.y, BAR.width * progress, BAR.height, BAR.radius);

  // Create a discord attachment with the canvas
  return new AttachmentBuilder(await canvas.encode("png"), { name: "user-level.png" });
}

module.exports = { generateUserLevelCanvas };
