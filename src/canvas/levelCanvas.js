const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { request } = require("undici");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

async function generateLevelCanvas(targetMember, user, requiredExp, rank) {
  // Create the User Level canvas
  const canvas = createCanvas(600, 150);
  const context = canvas.getContext("2d");

  // Create and stretch the background image to fit the canvas
  const background = await loadImage(require.resolve("../assets/canvas/user-level.png"));
  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  // Get the user's avatar image
  const avatarURL = targetMember.avatarURL({ extension: "png" }) || targetMember.user.displayAvatarURL({ extension: "png" }); // Use the server specific avatar if available
  const { body } = await request(avatarURL);
  const avatar = await loadImage(await body.arrayBuffer());

  // Draw the user's avatar image, clipped to a circle
  context.save();

  context.beginPath();
  context.arc(20 + 120 / 2, (150 - 120) / 2 + 120 / 2, 120 / 2, 0, Math.PI * 2, true);
  context.closePath();
  context.clip();
  context.drawImage(avatar, 20, (150 - 120) / 2, 120, 120);

  context.restore();  

  // Draw the user's username
  context.font = "24px Quicksand";
  context.fillStyle = "#ffffff";

  context.fillText(targetMember.nickname || targetMember.username, 160, 44); // Use the user's server specific nickname if available

  // Draw a thin line below the username
  const usernameWidth = context.measureText(targetMember.nickname || targetMember.username).width;

  context.beginPath();
  context.moveTo(160, 54);
  context.lineTo(160 + usernameWidth, 54);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 195, 197, 0.8)";
  context.stroke();

  // Draw the user's level, exp, and rank
  context.font = "18px Quicksand";
  context.fillStyle = "rgba(255, 255, 255, 0.85)";

  context.fillText(`Level: ${user.level}    EXP: ${user.exp}/${requiredExp}    Rank: ${rank}`, 160, 79);

  // Draw the progress bar background
  context.fillStyle = "#36383f";
  context.beginPath();
  context.moveTo(160, 100);
  context.arcTo(570, 100, 570, 125, 10);
  context.arcTo(570, 125, 160, 125, 10);
  context.arcTo(160, 125, 160, 100, 10);
  context.arcTo(160, 100, 570, 100, 10); 
  context.closePath();
  context.fill();

  // Draw the filled part of the progress bar
  const progressBarWidth = (user.exp / requiredExp) * 400;

  context.fillStyle = "#ffc3c5";
  context.beginPath();
  context.moveTo(160, 100);
  context.arcTo(160 + progressBarWidth, 100, 160 + progressBarWidth, 125, 10);
  context.arcTo(160 + progressBarWidth, 125, 160, 125, 10);
  context.arcTo(160, 125, 160, 100, 10);
  context.arcTo(160, 100, 160 + progressBarWidth, 100, 10);
  context.closePath();
  context.fill();

  // Create a discord attachment with the canvas
  const attachment = new AttachmentBuilder(await canvas.encode("png"), {
    name: "user-level.png",
  });

  return attachment;
}

module.exports = { generateLevelCanvas };