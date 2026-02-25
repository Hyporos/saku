const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const { getAllCharacters } = require("../../utility/culvertUtils.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wos")
    .setDescription("View the wall of shame")
    .addIntegerOption((option) =>
      option
        .setName("participation_rate")
        .setDescription("The minimum participation rate percentage")
        .setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const participationRateOption =
      interaction.options.getInteger("participation_rate") || 0;

    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Create pagination buttons and action row
    const previous = new ButtonBuilder()
      .setCustomId("previous")
      .setEmoji("<:singleleftchevron:1375242927634120804>")
      .setStyle(ButtonStyle.Primary);

    const next = new ButtonBuilder()
      .setCustomId("next")
      .setEmoji("<:singlerightchevron:1375242928787689693>")
      .setStyle(ButtonStyle.Primary);

    const first = new ButtonBuilder()
      .setCustomId("first")
      .setEmoji("<:doubleleftchevron:1193783344996024350>")
      .setStyle(ButtonStyle.Secondary);

    const last = new ButtonBuilder()
      .setCustomId("last")
      .setEmoji("<:doublerightchevron:1193783935071682591>")
      .setStyle(ButtonStyle.Secondary);

    const pagination = new ActionRowBuilder().addComponents(
      first,
      previous,
      next,
      last
    );

    // Get a list of all currently linked characters
    const characterList = await getAllCharacters();

    // Create a list of characters that have a participation rate the same or lower as the specified rate
    const shameList = characterList.reduce((list, character) => {
      const totalScores = character.scores.length;
      const missedScores = character.scores.filter(
        (scoreInput) => scoreInput.score === 0
      ).length;

      const submissionRate = ((totalScores - missedScores) / totalScores) * 100;

      if (submissionRate <= participationRateOption) {
        list.push({
          name: character.name,
          totalScores,
          submittedScores: totalScores - missedScores,
          rate: Math.round(submissionRate),
        });
      }

      return list;
    }, []);

    // Sort the list of characters in ascending order (rate first, then by totalScores)
    shameList.sort((a, b) => {
      // Place NaN rates at the back of the list
      if (isNaN(a.rate)) return 1;
      if (isNaN(b.rate)) return -1;

      return a.rate - b.rate || a.totalScores - b.totalScores;
    });

    // Set placements for each character, based on participation rate
    shameList.forEach((character, index) => {
      character.placement = index + 1;
    });

    // Create the placement fields for the wall of shame list
    let firstPlacement = 0;
    let lastPlacement = 8;

    function getParticipationRankings() {
      let content = "\u0060\u0060\u0060";

      for (let i = firstPlacement; i < lastPlacement; i++) {
        const character = shameList[i];
        if (!character?.name) break;

        // Adjust text padding based on placement length
        let padding = 20;
        if (character.placement > 99) padding = 18;
        if (character.placement > 9) padding = 19;

        const characterInfo = `${character.placement}. ${character.name.padEnd(
          padding,
          " "
        )}${character.submittedScores}/${character.totalScores} (${
          character.rate
        }%)\n`;

        content += characterInfo;
      }
      return content.concat("\u0060\u0060\u0060");
    }

    // A function to create the an updated embed for the wall of shame list
    let page = 1;
    const maxPage = Math.ceil(shameList.length / 8);

    function createWosEmbed(page, maxPage, participationRateOption) {
      return new EmbedBuilder()
        .setColor(0xa30d0e)
        .addFields({
          name: "Wall of Shame",
          value: `${getParticipationRankings()}`,
          inline: false,
        })
        .setFooter({
          text: `Page ${page}/${maxPage} • Minimum rate of ${participationRateOption}%`,
        });
    }

    // Disable the first/previous buttons on initial render
    if (page === 1) {
      first.setDisabled(true);
      previous.setDisabled(true);
    }

    // Display the initial wos embed
    const response = await interaction.editReply({
      embeds: [createWosEmbed(page, maxPage, participationRateOption)],
      components: [pagination],
    });

    // Create a collector to handle the pagination buttons
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id, // Only allow the initiator of the command to use the buttons
      idle: 120000, // After 2 minutes, turn off the buttons
    });

    // Handle button presses via the collector
    collector.on("collect", async (interaction) => {
      // Handle pagination, placement accuracy
      if (interaction.customId === "previous") {
        if (page > 1) {
          page--;
          firstPlacement -= 8;
          lastPlacement -= 8;
        }
      } else if (interaction.customId === "next") {
        if (page < maxPage) {
          page++;
          firstPlacement += 8;
          lastPlacement += 8;
        }
      } else if (interaction.customId === "first") {
        page = 1;
        firstPlacement = 0;
        lastPlacement = 8;
      } else if (interaction.customId === "last") {
        page = maxPage;
        firstPlacement = maxPage * 8 - 8;
        lastPlacement = maxPage * 8;
      }

      // Disable buttons if they do not serve any purpose (already at first or last page)
      if (page === 1) {
        first.setDisabled(true);
        previous.setDisabled(true);
      } else {
        first.setDisabled(false);
        previous.setDisabled(false);
      }

      if (page === maxPage) {
        last.setDisabled(true);
        next.setDisabled(true);
      } else {
        last.setDisabled(false);
        next.setDisabled(false);
      }

      // Display the previous/next page
      await interaction.deferUpdate();

      await interaction.editReply({
        embeds: [createWosEmbed(page, maxPage, participationRateOption)],
        components: [pagination],
      });
    });

    // Handle the end of the collector (after 2 minutes of idle)
    collector.on("end", () => {
      previous.setDisabled(true);
      next.setDisabled(true);
      first.setDisabled(true);
      last.setDisabled(true);

      interaction.editReply({
        embeds: [createWosEmbed(page, maxPage, participationRateOption)],
        components: [pagination],
      });
    });
  },
};
