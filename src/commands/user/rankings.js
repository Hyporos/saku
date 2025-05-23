const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require("discord.js");
const {
  generateUserRankingsCanvas,
} = require("../../canvas/userRankingsCanvas.js");
const { createPaginationRow } = require("../../utility/pagination.js");
const userSchema = require("../../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

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

      // Function to fetch users for a specific page
      async function fetchUsersForPage(pageNum) {
        const skip = (pageNum - 1) * usersPerPage;

        const dbUsers = await userSchema
          .find({})
          .sort({ level: -1, exp: -1 })
          .skip(skip)
          .limit(usersPerPage);

        // Process users and store in this array
        const validUsers = [];

        for (const dbUser of dbUsers) {
          try {
            // Calculate the rank position based on page number
            const rankPosition = skip + validUsers.length + 1;

            // If user exists in database but not in guild anymore
            if (!dbUser.userId) {
              validUsers.push({
                ...dbUser.toObject(),
                rankPosition: rankPosition,
                username: "Unknown Member",
                isUnknown: true,
              });
            } else {
              // Regular member still in guild
              validUsers.push({
                ...dbUser.toObject(),
                rankPosition: rankPosition,
              });
            }
          } catch (err) {
            // Add placeholder 'unknown member'
            const rankPosition = skip + validUsers.length + 1;
            validUsers.push({
              _id: dbUser._id || "unknown",
              userId: dbUser.userId || "unknown",
              username: "Unknown Member",
              level: dbUser.level || 0,
              exp: dbUser.exp || 0,
              rankPosition: rankPosition,
              isUnknown: true,
            });
          }
        }

        return validUsers;
      }

      // Fetch initial users
      const users = await fetchUsersForPage(page);

      // Run the function to generate the User Rankings canvas
      const attachment = await generateUserRankingsCanvas(interaction, users);

      // Send the User Rankings canvas
      const response = await interaction.editReply({
        files: [attachment],
        components: [createPaginationRow(page, maxPage)],
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
                filter: (i) => i.customId === "page-select-modal",
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
                ephemeral: true,
              });
              return;
            }

            // Update the page
            page = pageNumber;

            // Get users for the selected page
            const usersForPage = await fetchUsersForPage(page);
            const newAttachment = await generateUserRankingsCanvas(
              interaction,
              usersForPage
            );

            // Update the message with new page
            await modalSubmitInteraction.update({
              files: [newAttachment],
              components: [createPaginationRow(page)],
            });
          } else {
            // Handle navigation buttons
            if (i.customId === "previous" && page > 1) {
              page--;
            } else if (i.customId === "next" && page < maxPage) {
              page++;
            }

            // Get users for the page
            const usersForPage = await fetchUsersForPage(page);
            const newAttachment = await generateUserRankingsCanvas(
              interaction,
              usersForPage
            );

            // Update the message with new page
            await i.update({
              files: [newAttachment],
              components: [createPaginationRow(page, maxPage)],
            });
          }
        } catch (err) {
          console.error("Error - Could not switch pages: ", err);
          try {
            if (!i.replied && !i.deferred) {
              await i.reply({
                content: "Error - Could not switch pages",
                ephemeral: true,
              });
            }
          } catch (e) {
          }
        }
      });

      // When the collector ends, remove the buttons
      collector.on("end", async () => {
        await interaction.editReply({
          components: [],
        });
      });
    } catch (error) {
      console.error(error);

      // Handle error responses
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("Error - Could not retrieve rankings");
      } else {
        await interaction.reply({
          content: "Error - Could not retrieve rankings",
          ephemeral: true,
        });
      }
    }
  },
};
