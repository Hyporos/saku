const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const {
  generateUserRankingsCanvas,
} = require("../../canvas/userRankingsCanvas.js");
const { createPaginationRow } = require("../../lib/pagination.js");
const userSchema = require("../../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Which page the person running the command lands on, counted in the database rather than by walking
// the whole collection looking for them.
async function pageOfUser(userId, usersPerPage) {
  const me = await userSchema.findById(userId).lean();
  if (!me) return null;
  const ahead = await userSchema.countDocuments({
    $or: [{ level: { $gt: me.level } }, { level: me.level, exp: { $gt: me.exp } }],
  });
  return Math.ceil((ahead + 1) / usersPerPage);
}

// The shared pagination row, plus a jump straight to your own page. Disabled for anyone who has never
// earned EXP, and while you are already looking at yourself.
function paginationRow(page, maxPage, myPage) {
  return createPaginationRow(page, maxPage).addComponents(
    new ButtonBuilder()
      .setCustomId("jumpToMe")
      .setLabel("Jump to Me")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!myPage || page === myPage)
  );
}

module.exports = {
  async execute(interaction) {
    try {
      // Command may take longer to execute. Defer the initial reply.
      await interaction.deferReply();

      // Create pagination buttons and action row
      let page = 1;
      const usersPerPage = 10;

      // Get total count of users for pagination
      const totalUsers = await userSchema.countDocuments({});
      const maxPage = Math.ceil(totalUsers / usersPerPage) || 1;

      // Worked out once: the board does not move while the panel is open.
      const myPage = await pageOfUser(interaction.user.id, usersPerPage);

      // A row's rank is its offset in the full sort, so it comes from the page number rather than from
      // anything stored. The branching this replaced tested `dbUser.userId`, a field the schema does
      // not have, so every user took the "no longer in the guild" path and was tagged Unknown Member
      // before the canvas had even looked them up. The inner try/catch around it could not throw.
      async function fetchUsersForPage(pageNum) {
        const skip = (pageNum - 1) * usersPerPage;
        const dbUsers = await userSchema
          .find({})
          .sort({ level: -1, exp: -1 })
          .skip(skip)
          .limit(usersPerPage)
          .lean();

        return dbUsers.map((dbUser, i) => ({ ...dbUser, rankPosition: skip + i + 1 }));
      }

      // Fetch initial users
      const users = await fetchUsersForPage(page);

      // Run the function to generate the User Rankings canvas
      const attachment = await generateUserRankingsCanvas(interaction, users, interaction.user.id);

      // Send the User Rankings canvas
      const response = await interaction.editReply({
        files: [attachment],
        components: [paginationRow(page, maxPage, myPage)],
      });

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
            const modal = new ModalBuilder()
              .setCustomId("page-select-modal")
              .setTitle("Go to Page");

            const pageInput = new TextInputBuilder()
              .setCustomId("page-number")
              .setLabel(`Enter a page number (1-${maxPage})`)
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(3)
              .setRequired(true)
              .setPlaceholder("Enter page number...");
            modal.addComponents(
              new ActionRowBuilder().addComponents(pageInput)
            );

            // Show the modal
            await i.showModal(modal);

            const modalSubmitInteraction = await i
              .awaitModalSubmit({
                time: 60000, // 1 minute to submit page number. If timeout, return null
                // Scoped to the person who opened it. awaitModalSubmit collects client-wide with no
                // user check of its own, and every leaderboard panel uses this same custom id, so
                // matching on the id alone let someone else's page jump land on this board.
                filter: (submitted) =>
                  submitted.customId === "page-select-modal" && submitted.user.id === interaction.user.id,
              })
              .catch(() => null);

            if (!modalSubmitInteraction) return;

            // Get the submitted page number
            const pageNumber = parseInt(
              modalSubmitInteraction.fields.getTextInputValue("page-number")
            );

            // Validate the page number
            if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > maxPage) {
              await modalSubmitInteraction.reply({
                content: `Please enter a valid page number between 1 and ${maxPage}.`,
                flags: MessageFlags.Ephemeral,
              });
              return;
            }

            // Update the page
            page = pageNumber;

            // Acknowledged first, for the same reason as the navigation buttons below.
            await modalSubmitInteraction.deferUpdate();

            // Get users for the selected page
            const usersForPage = await fetchUsersForPage(page);
            const newAttachment = await generateUserRankingsCanvas(
              interaction,
              usersForPage,
              interaction.user.id
            );

            // Update the message with new page
            await interaction.editReply({
              files: [newAttachment],
              components: [paginationRow(page, maxPage, myPage)],
            });
          } else {
            // Acknowledged before anything is drawn. Building a page means a database read, ten member
            // lookups, ten avatar downloads and a PNG encode, and `update` allows three seconds from
            // the click for all of it — miss that and Discord drops the interaction, which is what
            // "Saku didn't respond in time" is. Deferring first removes the deadline.
            await i.deferUpdate();

            // Handle navigation buttons
            if (i.customId === "previous" && page > 1) {
              page--;
            } else if (i.customId === "next" && page < maxPage) {
              page++;
            } else if (i.customId === "jumpToMe" && myPage) {
              page = myPage;
            }

            // Get users for the page
            const usersForPage = await fetchUsersForPage(page);
            const newAttachment = await generateUserRankingsCanvas(
              interaction,
              usersForPage,
              interaction.user.id
            );

            // Update the message with new page
            await interaction.editReply({
              files: [newAttachment],
              components: [paginationRow(page, maxPage, myPage)],
            });
          }
        } catch (err) {
          console.error("Error - Could not switch pages: ", err);
          try {
            if (!i.replied && !i.deferred) {
              await i.reply({
                content: "Error - Could not switch pages",
                flags: MessageFlags.Ephemeral,
              });
            }
          } catch (e) {
          }
        }
      });

      // When the collector ends, remove the buttons. Guarded because the message can easily be gone by
      // the time the two minutes are up.
      collector.on("end", async () => {
        await interaction
          .editReply({
            components: [],
          })
          .catch(() => {});
      });
    } catch (error) {
      console.error(error);

      // Handle error responses
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("Error - Could not retrieve rankings");
      } else {
        await interaction.reply({
          content: "Error - Could not retrieve rankings",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
