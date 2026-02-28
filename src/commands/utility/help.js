const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Display a list of all commands")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to view in depth")
        .setAutocomplete(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async autocomplete(interaction) {
    const value = interaction.options.getFocused().toLowerCase();

    const isBee =
      interaction.member.roles.cache.has("720001044746076181") ||
      interaction.user.id === "631337640754675725";

    let choices = [
      "gpq",
      "profile",
      "graph",
      "graphcolor",
      "rankings",
      "roll",
      "8ball",
      "help",
      "ping",
      "dannis",
    ];

    isBee &&
      choices.push(
        "link",
        "unlink",
        "rename",
        "changeid",
        "correct",
        "exception",
        "scan",
        "culvertping",
        "finalize",
        "wos",
        "export",
        "say"
      );

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(value))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const selectedCommand = interaction.options.getString("command");

    // Check if the command exists or has no help embed associated with it
    if (!getCommandInfo("description") && selectedCommand !== null) {
      return interaction.reply(
        `Error - The command **${selectedCommand}** could not be found`
      );
    }

    // Check if the sender is a Bee
    const isBee =
      interaction.member.roles.cache.has("720001044746076181") ||
      interaction.user.id === "631337640754675725";

    // Get command info
    function getCommandInfo(type) {
      if (type === "description") {
        // Get the description for the command
        switch (selectedCommand) {
          case "gpq":
            return "Log a culvert score for one of your characters. The score will be set to the current weekly reset (Thursday 12:00 AM UTC)";
          case "profile":
            return "View the culvert profile of a user. It will show a variety of stats such as rankings, past scores, and character info (level, class)";
          case "graph":
            return "View the progression graph of a character. It will show a history of past culvert scores, up to any amount of weeks";
          case "graphcolor":
            return "Change the color of your progression graph area. Your graph will also be displayed to other users in the color you choose";
          case "rankings":
            return "View the culvert leaderboard. You can choose between displaying weekly or yearly scores";
          case "link":
            return "Link a character to a Discord ID. You must include the join date as well in a proper, common form (ex: YYYY-MM-DD)";
          case "unlink":
            return "Unlink and remove a character from the database. All of their data, such as submitted scores, will be gone";
          case "rename":
            return "Rename a character. All stats and character info will remain.";
          case "changeid":
            return "Change the Discord ID for a culvert user. This will transfer all culvert data (characters, scores, graph color) from one Discord account to another.";
          case "correct":
            return "Edit or create a new score for a character. If the date does not exist, a new one will be created. The score must be in the 'YYYY-MM-DD' format.";
          case "exception":
            return "Add a character exception to /scan. If a name is being incorrectly read by the bot, you can add an exception (alternative name) for the bot to recognize.";
          case "scan":
            return "Submit bulk culvert data from a screenshot. The screenshot must be from the Member Participation Status tab in the guild menu, and only contain the columns from Name to Culvert.";
          case "culvertping":
            return "Scan a list of character names from a screenshot and create a pingable list of their names. Best used with a screenshot from the Culvert board of character names who have a score of 0.";
          case "finalize":
            return "View a list of characters that have unsubmitted scores for the given week. Use this to confirm whether or not /scan has missed any characters or if members have left the guild. If successful, a JSON containing all user data will be returned.";
          case "wos":
            return "View the wall of shame. On the wall there will be a list of users sorted by their participation rate, based on the minimum rate provided.";
          case "export":
            return "Export a .csv containing all members scores along with their dates. This file can be imported into Excel or Sheets for viewing.";
          case "roll":
            return "Roll a number between 1 and 100";
          case "8ball":
            return "Seek advice from the Magic 8 Ball";
          case "help":
            return "Display a list of all commands. You can choose to use /help followed by a command name to view more details about that particular command. Did you really just do /help help?";
          case "ping":
            return "Check Saku's response time. It will display both the latency and API ping.";
          case "say":
            return "Have Saku relay a message for you in the specified channel";
          case "dannis":
            return "Praise the lord";
        }
      } else if (type === "parameters") {
        // Get the argument information for the command
        switch (selectedCommand) {
          case "gpq":
            return `\u0060[character]\u0060 - The character that the score will be logged to\n\u0060[score]\u0060 - The score to be logged`;
          case "profile":
            return `\u0060[character]\u0060 - The character's profile to be viewed`;
          case "graph":
            return `\u0060[character]\u0060 - The character's graph to be rendered\n\u0060[number_of_weeks]\u0060 - The number of weeks to display (default: 8)\n\u0060[omit_unsubmitted]\u0060 - Prevent unsubmitted scores (missed weeks) from displaying`;
          case "graphcolor":
            return `\u0060[color]\u0060 - The new color of the graph area (default: pink)`;
          case "rankings":
            return `\u0060[timeframe]\u0060 - The timeframe that the leaderboard will display`;
          case "link":
            return `\u0060[character]\u0060 - The character to be linked\n\u0060[discord_user]\u0060 - The Discord user to be paired with the character\n\u0060[member_since]\u0060 - The date that the character joined the guild\n\u0060[override]\u0060 - Force link the character, even if not present on rankings`;
          case "unlink":
            return `\u0060[character]\u0060 - The character to be unlinked`;
          case "rename":
            return `\u0060[old_name]\u0060 - The character to be renamed\n\u0060[new_name]\u0060 - The new name to set for this character\n\u0060[override]\u0060 - Force rename the character, even if not present on rankings`;
          case "changeid":
            return `\u0060[old_user]\u0060 - The current Discord user to change ID from\n\u0060[new_user]\u0060 - The new Discord user to transfer data to`;
          case "correct":
            return `\u0060[character]\u0060 - The character to be corrected\n\u0060[date]\u0060 - The date of the score\n\u0060[score]\u0060 - The new score to submit`;
          case "exception":
            return `\u0060[name]\u0060 - The name of the character\n\u0060[exception]\u0060 - The alternative name, which is being incorrectly scanned`;
          case "scan":
            return `\u0060[attach]\u0060 - Screenshot of the culvert character name and score list \n\u0060[week]\u0060 - Submit the scores for either the current or the last week`;
          case "culvertping":
            return `\u0060[attach]\u0060 - Screenshot containing the list of character names to ping`;
          case "finalize":
            return `\u0060[week]\u0060 - Check the scores for either the current or the last week\n\u0060[override]\u0060 - Ignore unsubmitted scores and proceed with finalization`;
          case "wos":
            return `\u0060[participation_rate]\u0060 - The minimum participation rate percentage to filter by`;
          case "export":
            return `None`;
          case "roll":
            return `None`;
          case "8ball":
            return `\u0060[question]\u0060 - Your question, to be answered by the Magic 8 Ball`;
          case "help":
            return `\u0060[command]\u0060 - The command to view in depth`;
          case "ping":
            return `None`;
          case "say":
            return `\u0060[message]\u0060 - The message you would like Saku to send\n\u0060[channel]\u0060 - The channel where would like to send the message`;
          case "dannis":
            return `None`;
        }
      }
    }

    // Create an embed for general /help commands
    const help = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({
        name: "Saku Bot Commands",
        iconURL:
          "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      })
      .setDescription(
        "Use `/help` followed by a command name to view more details\n\u2800"
      )
      .addFields({
        name: "Culvert",
        value: `\u0060gpq\u0060, \u0060profile\u0060, \u0060graph\u0060, \u0060graphcolor\u0060, \u0060rankings\u0060${
          isBee
            ? ", \u0060link\u0060, \u0060unlink\u0060, \u0060rename\u0060, \u0060changeid\u0060, \u0060correct\u0060, \u0060exception\u0060, \u0060scan\u0060, \u0060culvertping\u0060, \u0060finalize\u0060, \u0060wos\u0060, \u0060export\u0060"
            : ""
        }`,
      })
      .addFields({ name: "Fun", value: "`roll`, `8ball`" })
      .addFields({ name: "Utility", value: "`help`, `ping`" });

    // Create a /help embed for the specified command
    const specificHelp = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setAuthor({
        name: "Saku Bot Commands",
        iconURL:
          "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
      })
      .setTitle(`/${selectedCommand}`)
      .setDescription(`${getCommandInfo("description")}\n\u2800`)
      .addFields({
        name: "Parameters",
        value: `${getCommandInfo("parameters")}`,
      });

    // Handle responses
    interaction.reply({ embeds: [selectedCommand ? specificHelp : help] });
  },
};
