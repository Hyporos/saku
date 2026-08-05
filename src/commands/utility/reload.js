const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Swaps a command's code out without restarting the bot. It reloads the HANDLER only: anything that
// changes what Discord knows about a command (its name, description or options) still needs
// deploy-commands, because that half lives on Discord's side rather than in this process.

// Read off disk rather than hardcoded, so a new command folder shows up on its own.
const categories = () =>
  fs
    .readdirSync(path.join(__dirname, ".."), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("[OWNER] Reloads a command")
    .addStringOption((option) =>
      option.setName("category").setDescription("The category of the command").setRequired(true).setAutocomplete(true)
    )
    .addStringOption((option) =>
      option.setName("command").setDescription("The command to reload").setRequired(true).setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  // Both options were free text, so reloading anything meant remembering the exact command name and
  // which folder it lives in, and a typo in either came back as a flat "could not find".
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const value = focused.value.toLowerCase();
    const pool = focused.name === "category" ? categories() : [...interaction.client.commands.keys()];
    const matches = pool
      .filter((name) => name.toLowerCase().includes(value))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 25);
    await interaction.respond(matches.map((name) => ({ name, value: name }))).catch(() => {});
  },

  async execute(interaction) {
    // Parse the command arguments
    const categoryOption = interaction.options.getString("category", true).toLowerCase();
    const commandOption = interaction.options.getString("command", true).toLowerCase();

    // Fetch the command name, return if nonexistent
    const command = interaction.client.commands.get(commandOption);

    if (!command) {
      return interaction.reply({
        content: `Error - Could not find the command \`/${commandOption}\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Resolved on its own, because a wrong category used to throw straight out of require.resolve,
    // outside the try, and surfaced as a generic command failure instead of saying what was wrong.
    let resolved;
    try {
      resolved = require.resolve(`../${categoryOption}/${command.data.name}.js`);
    } catch {
      return interaction.reply({
        content: `Error - \`/${command.data.name}\` is not in the \`${categoryOption}\` category`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // The live collection is only touched once the new copy has loaded cleanly. The old order deleted
    // the command FIRST, so a file with a syntax error in it left the bot with no such command at all:
    // the reply said the reload had failed, and the command it was reloading was gone until a restart.
    const cached = require.cache[resolved];
    delete require.cache[resolved];

    try {
      const newCommand = require(resolved);
      // A rename leaves the old key behind, which would otherwise keep answering with stale code.
      if (newCommand.data.name !== command.data.name) interaction.client.commands.delete(command.data.name);
      interaction.client.commands.set(newCommand.data.name, newCommand);

      // Handle responses
      await interaction.reply({
        content: `The \`/${newCommand.data.name}\` command was reloaded`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      // Put the working copy back, so a bad edit costs nothing: the command keeps running the version
      // it had before rather than disappearing.
      if (cached) require.cache[resolved] = cached;
      console.error(error);
      await interaction.reply({
        content: `Error - Could not reload the command \`/${command.data.name}\`:\n\`${error.message}\``,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
