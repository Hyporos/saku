const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { request } = require("undici");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

async function generateUserRankingsCanvas(interaction, users) {
  // Create the User Rankings canvas
  const canvas = createCanvas(500, 550);
  const context = canvas.getContext("2d");

  // Create and stretch the background image to fit the canvas
  const background = await loadImage(require.resolve("../assets/canvas/user-rankings.png"));
  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  // Draw a row for each of the top 10 users
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const member = await interaction.guild.members.fetch(user._id);
    const avatarURL = member.avatarURL({ extension: "png" }) || member.user.displayAvatarURL({ extension: "png" });
    const { body } = await request(avatarURL);
    const avatar = await loadImage(await body.arrayBuffer());

    // Position values
    const x = 80;
    const y = 22 + i * 52.4;
    const size = 35;

    // Draw the ranking number
    context.font = "18px Quicksand";
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillText(`#${i + 1}`, 35, y + size / 2 + 7);

    context.save();
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    context.closePath();
    context.clip();
    context.drawImage(avatar, x, y, size, size);
    context.restore();

    context.fillStyle = "#ffffff";
    
    const displayName = (member.nickname || member.user.username).replace(/\s*\(.*?\)\s*/g, '');
    context.fillText(displayName, x + size + 10, y + size / 2 + 7);

    // Draw the user's level and exp on the same line
    context.font = "16px Quicksand";
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillText(`Level:`, canvas.width - 200, y + size / 2 + 7);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${user.level}`, canvas.width - 153, y + size / 2 + 7);
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.fillText(`EXP:`, canvas.width - 115, y + size / 2 + 7);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${user.exp}`, canvas.width - 78, y + size / 2 + 7);
  }

  // Create a discord attachment with the canvas
  const attachment = new AttachmentBuilder(await canvas.encode("png"), {
    name: "user-rankings.png",
  });

  return attachment;
}

module.exports = { generateUserRankingsCanvas };