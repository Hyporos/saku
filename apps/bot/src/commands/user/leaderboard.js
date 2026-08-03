const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { generateUserRankingsCanvas } = require("../../canvas/userRankingsCanvas.js");
const { createPaginationRow } = require("../../utility/pagination.js");
const userSchema = require("../../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const USERS_PER_PAGE = 10;

// A row's rank is its offset in the full sort, so it comes from the page number rather than anything
// stored. The branching this replaced tested `dbUser.userId`, a field the schema does not have, so
// every user took the "no longer in the guild" path and was tagged Unknown Member.
async function fetchUsersForPage(pageNum) {
  const skip = (pageNum - 1) * USERS_PER_PAGE;
  const users = await userSchema.find({}).sort({ level: -1, exp: -1 }).skip(skip).limit(USERS_PER_PAGE).lean();
  return users.map((user, i) => ({ ...user, rankPosition: skip + i + 1 }));
}

module.exports = {
  async execute(interaction) {
    try {
      // Command may take longer to execute. Defer the initial reply.
      await interaction.deferReply();

      let page = 1;

      // Get total count of users for pagination
      const totalUsers = await userSchema.countDocuments({});
      const maxPage = Math.ceil(totalUsers / USERS_PER_PAGE) || 1;

      const render = async () => ({
        files: [await generateUserRankingsCanvas(interaction, await fetchUsersForPage(page))],
        components: [createPaginationRow(page, maxPage)],
      });

      // Send the User Rankings canvas
      const response = await interaction.editReply(await render());

      // Create a collector to handle the pagination buttons
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id, // Only allow the initiator of the command to use the buttons
        idle: 120000, // After 2 minutes, turn off the buttons
      });

      // Handle button presses via the collector
      collector.on("collect", async (i) => {
        try {
          if (i.customId === "pageSelector") {
            // Create the page selection modal
            const modal = new ModalBuilder().setCustomId("page-select-modal").setTitle("Go to Page");

            const pageInput = new TextInputBuilder()
              .setCustomId("page-number")
              .setLabel(`Enter a page number (1-${maxPage})`)
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(3)
              .setRequired(true)
              .setPlaceholder("Enter page number...");
            modal.addComponents(new ActionRowBuilder().addComponents(pageInput));

            // Show the modal
            await i.showModal(modal);

            const modalSubmitInteraction = await i
              .awaitModalSubmit({
                time: 60000, // 1 minute to submit page number. If timeout, return null
                // Matching on the custom id alone meant someone else's page jump could satisfy this
                // wait and move this leaderboard instead of their own.
                filter: (submitted) =>
                  submitted.customId === "page-select-modal" && submitted.user.id === interaction.user.id,
              })
              .catch(() => null);

            if (!modalSubmitInteraction) return;

            // Get and validate the submitted page number
            const pageNumber = parseInt(modalSubmitInteraction.fields.getTextInputValue("page-number"));

            if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > maxPage) {
              return modalSubmitInteraction.reply({
                content: `Please enter a valid page number between 1 and ${maxPage}.`,
                flags: MessageFlags.Ephemeral,
              });
            }

            // Update the page and the message
            page = pageNumber;
            await modalSubmitInteraction.update(await render());
          } else {
            // Handle navigation buttons
            if (i.customId === "previous" && page > 1) page--;
            else if (i.customId === "next" && page < maxPage) page++;

            await i.update(await render());
          }
        } catch (err) {
          console.error("Error - Could not switch pages: ", err);
          if (!i.replied && !i.deferred) {
            await i.reply({ content: "Error - Could not switch pages", flags: MessageFlags.Ephemeral }).catch(() => {});
          }
        }
      });

      // When the collector ends, remove the buttons. Guarded because the message can easily be gone
      // by the time the two minutes are up.
      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => {});
      });
    } catch (error) {
      console.error(error);

      // Handle error responses
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("Error - Could not retrieve the leaderboard").catch(() => {});
      } else {
        await interaction
          .reply({ content: "Error - Could not retrieve the leaderboard", flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
  },
};
