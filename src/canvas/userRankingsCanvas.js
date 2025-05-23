const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { request } = require("undici");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

async function generateUserRankingsCanvas(interaction, users) {
  // Create the User Rankings canvas
  const canvas = createCanvas(500, 550);
  const context = canvas.getContext("2d");

  // Get the first user's rank to determine the page
  const isFirstPage = users.length > 0 ? users[0].rankPosition <= 10 : true;

  // Load the appropriate background image
  const backgroundPath = isFirstPage
    ? "../assets/canvas/user-rankings-first.png"
    : "../assets/canvas/user-rankings-other.png";

  // Create and stretch the background image to fit the canvas
  const background = await loadImage(require.resolve(backgroundPath));
  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  // Draw a row for each of the top 10 users
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const rank = user.rankPosition || i + 1;

    // Position values
    const x = 85;
    const y = 22 + i * 52.4;
    const size = 35;

    let member;
    let avatar;

    try {
      // Fetch the member from the guild
      member = await interaction.guild.members.fetch(user._id);
      const avatarURL =
        member.avatarURL({ extension: "png" }) ||
        member.user.displayAvatarURL({ extension: "png" });
      const { body } = await request(avatarURL);
      avatar = await loadImage(await body.arrayBuffer());
    } catch (error) {
      // Use a default avatar and object for users who have left
      const defaultAvatarURL = "https://cdn.discordapp.com/embed/avatars/0.png";
      const { body } = await request(defaultAvatarURL);
      avatar = await loadImage(await body.arrayBuffer());
      member = {
        nickname: user.username || "Unknown User",
        user: { username: user.username || "Unknown User" },
      };
    }

    // Draw the ranking number
    context.font = "18px Quicksand";
    context.fillStyle = "rgba(255, 255, 255, 0.85)";

    context.fillText(`#${rank}`, 40, y + size / 2 + 7);

    context.save();
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    context.closePath();
    context.clip();
    context.drawImage(avatar, x, y, size, size);
    context.restore();

    context.fillStyle = "#ffffff";

    const displayName = (member.nickname || member.user.username).replace(
      /\s*\(.*?\)\s*/g,
      ""
    );
    context.fillText(displayName, x + size + 10, y + size / 2 + 7);

    // Draw the user's level and exp on the same line
    context.font = "16px Quicksand";
    context.fillStyle = "#ffffff";
    context.fillText(`Level:`, canvas.width - 200, y + size / 2 + 7);
    context.fillStyle = "#ffc3c5";
    context.fillText(`${user.level}`, canvas.width - 153, y + size / 2 + 7);
    context.fillStyle = "#ffffff";
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
