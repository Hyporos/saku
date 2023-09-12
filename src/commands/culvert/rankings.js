const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankings")
    .setDescription("View the culvert leaderboard")
    .addIntegerOption((option) =>
      option
        .setName("week")
        .setDescription("The specific week which scores were logged")
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(client, interaction) {
    const selectedCharacter = interaction.options.getString("character_name");

    const previous = new ButtonBuilder()
      .setCustomId("previous")
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary);

    const next = new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary);

      const custom = new ButtonBuilder()
      .setCustomId("custom")
      .setLabel("Custom")
      .setStyle(ButtonStyle.Secondary);

    const navigation = new ActionRowBuilder().addComponents(previous, next, custom);

    // Find the character with the given name
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
      },
      { "characters.$": 1 }
    );

    // Check if character is linked to a user
    const characterLinked = await culvertSchema.exists({
      "characters.name": { $regex: `^${selectedCharacter}$`, $options: "i" },
    });

    const rankings = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({ name: "Culvert Rankings" })
      .addFields({
        name: "Weekly (2023-09-10)",
        value: `\u0060\u0060\u00601.⠀Beezle\t\t\t18951\n2.⠀Druuwu\t\t\t16583\n3.⠀dissatisfied\t\t14931\n4.⠀Beewi\t\t\t\t12184\n5.⠀maister\t\t\t10941\n6.⠀Rally\t\t\t\t9843\n7.⠀lycheeemelon\t\t8431\n8.⠀memeboxx\t\t\t6531\u0060\u0060\u0060`,
        inline: false,
      })
      .setFooter({ text: "Page 1/20 • Resets in 3 days" });

    // Display responses
    interaction.reply({ embeds: [rankings], components: [navigation] });
  },
};
