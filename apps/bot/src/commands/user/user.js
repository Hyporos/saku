const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { generateUserLevelCanvas } = require("../../canvas/userLevelCanvas.js");
const { generateUserRankingsCanvas } = require("../../canvas/userRankingsCanvas.js");
const { getDiscordUser, getDiscordUserRank } = require("../../domain/levels.js");
const { getRequiredExp } = require("../../config/levels.js");
const { createPaginationRow } = require("../../lib/pagination.js");
const userSchema = require("../../schemas/userSchema.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Both subcommands live here. They used to be sibling files, which the command loader reads as
// commands in their own right — with no `data` export they failed that check and logged a warning on
// every boot, in index.js, deploy-commands.js and /reload alike.

const USERS_PER_PAGE = 10;

// ⎯⎯ /user level ⎯⎯ //

async function level(interaction) {
  // Two queries, a member fetch, an avatar download and a PNG encode all happen below. Replying
  // straight out of that raced Discord's three second window, and when it lost, the catch tried to
  // reply to an interaction that no longer existed and threw again, so nothing was shown at all.
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    // Get user info from the database. If not found, set default values
    const user = (await getDiscordUser(targetUser.id)) ?? { level: 1, exp: 0 };

    // Counted in the database rather than by downloading every user document and searching it,
    // which is what this used to do to find one position.
    const position = user._id ? await getDiscordUserRank(user) : null;
    const rank = position ? `#${position}` : "Unranked";

    const requiredExp = getRequiredExp(user.level);
    const attachment = await generateUserLevelCanvas(targetMember, user, requiredExp, rank);

    await interaction.editReply({ files: [attachment] });
  } catch (error) {
    console.error("Error - /user level failed:", error);
    await interaction.editReply("Error - Could not retrieve user level").catch(() => {});
  }
}

// ⎯⎯ /user leaderboard ⎯⎯ //

// Which page the person running the command lands on, counted in the database rather than by walking
// the whole collection looking for them.
async function pageOfUser(userId) {
  const me = await userSchema.findById(userId).lean();
  if (!me) return null;
  const ahead = await userSchema.countDocuments({
    $or: [{ level: { $gt: me.level } }, { level: me.level, exp: { $gt: me.exp } }],
  });
  return Math.ceil((ahead + 1) / USERS_PER_PAGE);
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

// A row's rank is its offset in the full sort, so it comes from the page number rather than from
// anything stored. The branching this replaced tested `dbUser.userId`, a field the schema does not
// have, so every user took the "no longer in the guild" path and was tagged Unknown Member before the
// canvas had even looked them up. The inner try/catch around it could not throw.
async function fetchUsersForPage(pageNum) {
  const skip = (pageNum - 1) * USERS_PER_PAGE;
  const dbUsers = await userSchema
    .find({})
    .sort({ level: -1, exp: -1 })
    .skip(skip)
    .limit(USERS_PER_PAGE)
    .lean();

  return dbUsers.map((dbUser, i) => ({ ...dbUser, rankPosition: skip + i + 1 }));
}

async function leaderboard(interaction) {
  try {
    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    let page = 1;

    const totalUsers = await userSchema.countDocuments({});
    const maxPage = Math.ceil(totalUsers / USERS_PER_PAGE) || 1;

    // Worked out once: the board does not move while the panel is open.
    const myPage = await pageOfUser(interaction.user.id);

    const users = await fetchUsersForPage(page);
    const attachment = await generateUserRankingsCanvas(interaction, users, interaction.user.id);

    const response = await interaction.editReply({
      files: [attachment],
      components: [paginationRow(page, maxPage, myPage)],
    });

    // Redraws the board for whatever `page` currently is.
    const showPage = async () => {
      const usersForPage = await fetchUsersForPage(page);
      const newAttachment = await generateUserRankingsCanvas(interaction, usersForPage, interaction.user.id);
      await interaction.editReply({
        files: [newAttachment],
        components: [paginationRow(page, maxPage, myPage)],
      });
    };

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id, // Only the initiator may use the buttons
      idle: 120000, // After 2 minutes, turn off the buttons
    });

    collector.on("collect", async (i) => {
      try {
        if (i.customId === "pageSelector") {
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

          await i.showModal(modal);

          const submitted = await i
            .awaitModalSubmit({
              time: 60000, // 1 minute to submit a page number, then it gives up
              // Scoped to the person who opened it. awaitModalSubmit collects client-wide with no
              // user check of its own, and every leaderboard panel uses this same custom id, so
              // matching on the id alone let someone else's page jump land on this board.
              filter: (s) => s.customId === "page-select-modal" && s.user.id === interaction.user.id,
            })
            .catch(() => null);

          if (!submitted) return;

          const pageNumber = parseInt(submitted.fields.getTextInputValue("page-number"));
          if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > maxPage) {
            await submitted.reply({
              content: `Please enter a valid page number between 1 and ${maxPage}.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          page = pageNumber;
          // Acknowledged first, for the same reason as the navigation buttons below.
          await submitted.deferUpdate();
          await showPage();
          return;
        }

        // Acknowledged before anything is drawn. Building a page means a database read, ten member
        // lookups, ten avatar downloads and a PNG encode, and `update` allows three seconds from the
        // click for all of it — miss that and Discord drops the interaction, which is what "Saku
        // didn't respond in time" is. Deferring first removes the deadline.
        await i.deferUpdate();

        if (i.customId === "previous" && page > 1) page--;
        else if (i.customId === "next" && page < maxPage) page++;
        else if (i.customId === "jumpToMe" && myPage) page = myPage;

        await showPage();
      } catch (err) {
        console.error("Error - Could not switch pages: ", err);
        if (!i.replied && !i.deferred) {
          await i
            .reply({ content: "Error - Could not switch pages", flags: MessageFlags.Ephemeral })
            .catch(() => {});
        }
      }
    });

    // When the collector ends, remove the buttons. Guarded because the message can easily be gone by
    // the time the two minutes are up.
    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("Error - Could not retrieve rankings").catch(() => {});
    } else {
      await interaction
        .reply({ content: "Error - Could not retrieve rankings", flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const SUBCOMMANDS = { level, leaderboard };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Discord User Commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("level")
        .setDescription("View your or another user's level and exp")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user you would like to view")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leaderboard").setDescription("View the server leaderboard")
    ),

  async execute(interaction) {
    // Each subcommand owns its own deferral and error reporting, so this only has to route. The
    // wrapper that used to sit here called interaction.reply() on failure, which always threw a
    // second time: by then the subcommand had already deferred.
    await SUBCOMMANDS[interaction.options.getSubcommand()](interaction);
  },
};
