const { Events } = require("discord.js");
const { buildChecklistMessage, parseCompletionsFromMessage } = require("../lib/checklist.js");
const { ROLES, USERS } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      // Display an error if an invalid command was entered
      if (!command) {
        console.error(
          `Error - No command matching /${interaction.commandName} was found`
        );
        return;
      }

      // Access comes off the command module itself (`tier`, `tiers`, `culvert`), not from lists kept
      // here. Those lists had to be edited whenever a command was added, renamed or merged, and
      // forgetting meant a bee command silently became public with nothing to catch it. Two real
      // examples it was hiding: /weekly was described and documented as bee but never appeared in the
      // list, and "subtract" was listed but is a subcommand of /event, so commandName never matched
      // it and that check could not fire at all.
      const subcommand = interaction.options.getSubcommand(false);
      const tier = (subcommand && command.tiers?.[subcommand]) || command.tier || "public";

      // Display an error message if Friends try to use culvert commands
      if (command.culvert && interaction.member.roles.cache.has(ROLES.FRIEND)) {
        interaction.reply(`Error - Friends do not have permission to use this command`);
        return;
      }

      // Display an error message if members try to use owner commands
      if (tier === "owner" && interaction.user.id !== USERS.OWNER) {
        interaction.reply(`Error - You do not have permission to use this command`);
        return;
      }

      // Display an error message if members try to use bee commands. The owner is an exception.
      if (tier === "bee" && !interaction.member.roles.cache.has(ROLES.BEE) && interaction.user.id !== USERS.OWNER) {
        interaction.reply(`Error - Members do not have permission to use this command`);
        return;
      }

      // Display an error message if the command fails
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(
          `Error - Could not execute the /${interaction.commandName} command`
        );
        console.error(error);
      }
    }

    // Handle button interactions
    else if (interaction.isButton()) {
      if (interaction.customId.startsWith("checklist_")) {
        const displayName = interaction.member?.displayName || interaction.user.username;
        const completions = parseCompletionsFromMessage(interaction.message);
        const existing = completions.get(interaction.customId);

        if (existing !== undefined) {
          // Only the person who checked it can uncheck it
          if (existing === displayName) {
            completions.delete(interaction.customId);
          } else {
            await interaction.deferUpdate();
            return;
          }
        } else {
          completions.set(interaction.customId, displayName);
        }

        await interaction.update(buildChecklistMessage(completions));
      }
    }

    // Handle autocomplete functionality
    else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(error);
      }
    }
  },
};
