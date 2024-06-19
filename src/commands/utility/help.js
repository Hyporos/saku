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
    ];

    isBee &&
      choices.push(
        "link",
        "unlink",
        "rename",
        "correct",
        "scan",
        "finalize",
        "wos",
        "export"
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
    // Get parameter options
    const selectedCommand = interaction.options.getString("command");

    // Check if the sender is a Bee
    const isBee =
      interaction.member.roles.cache.has("720001044746076181") ||
      interaction.user.id === "631337640754675725";

    // Get command info
    function getCommandInfo(type) {
      if (type === "description") {
        switch (selectedCommand) {
          case "gpq":
            return "Log a culvert score for one of your characters. The score will be set to the Sunday of this week (weekly reset)";
          case "profile":
            return "View the culvert profile of a user. It will show a variety of stats such as rankings, past scores, and character info (level, class)";
          case "graph":
            return "View the progression graph of a character. It will show a history of past culvert scores, up to any amount of weeks";
          case "graphcolor":
            return "Change the color of your progression graph area. Your graph will also be displayed to other users in the color you choose";
          case "rankings":
            return "View the culvert leaderboard. You can choose between displaying weekly or lifetime scores";
          case "link":
            return "Link a character to a Discord ID. You must include the join date as well in a proper, common form (ex: YYYY-MM-DD)";
          case "unlink":
            return "Unlink and remove a character from the database. All of their data, such as submitted scores, will be gone";
          case "rename":
            return "Rename a character. All stats and character info will remain.";
          case "correct":
            return "Edit or create a new score for a character. If the date does not exist, a new one will be created. The score must be in the 'YYYY-MM-DD' format.";
          case "scan":
            return "Submit bulk culvert data from a screenshot. The screenshot must be from the Member Participation Status tab in the guild menu, and only contain the columns from Name to Culvert.";
          case "finalize":
            return "View a list of characters that have unsubmitted scores for the given week. Use this to confirm whether or not /scan has missed any characters or if members have left the guild. If successful, a JSON containing all user data will be returned.";
          case "wos":
            return "View the wall of shame. On the wall there will be a list of users sorted by their participation rate, from lowest to 60%.";
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
        }
      } else if (type === "parameters") {
        switch (selectedCommand) {
          case "gpq":
            return `\u0060[character]\u0060 ⎯ The character that the score will be logged to\n\u0060[score]\u0060 ⎯ The score to be logged`;
          case "profile":
            return `\u0060[character]\u0060 ⎯ The character's profile to be viewed`;
          case "graph":
            return `\u0060[character]\u0060 ⎯ The character's graph to be rendered\n\u0060[number_of_weeks]\u0060 ⎯ The number of weeks to display (default: 8)\n\u0060[omit_unsubmitted]\u0060 ⎯ Prevent unsubmitted scores (missed weeks) from displaying`;
          case "graphcolor":
            return `\u0060[color]\u0060 ⎯ The new color of the graph area (default: pink)`;
          case "rankings":
            return `\u0060[timeframe]\u0060 ⎯ The timeframe that the leaderboard will display`;
          case "link":
            return `\u0060[character]\u0060 ⎯ The character to be linked\n\u0060[discord_user]\u0060 ⎯ The Discord user to be paired with the character\n\u0060[member_since]\u0060 ⎯ The date that the character joined the guild`;
          case "unlink":
            return `\u0060[character]\u0060 ⎯ The character to be unlinked`;
          case "rename":
            return `\u0060[old_name]\u0060 ⎯ The character to be renamed\n\u0060[new_name]\u0060 ⎯ The new name to set for this character`;
          case "correct":
            return `\u0060[character]\u0060 ⎯ The character to be corrected\n\u0060[date]\u0060 ⎯ The date of the score\n\u0060[score]\u0060 ⎯ The new score to submit`;
          case "scan":
            return `\u0060[week]\u0060 ⎯ Submit the scores for either the current or the last week`;
          case "finalize":
            return `\u0060[week]\u0060 ⎯ Check the scores for either the current or the last week\n\u0060[override]\u0060 ⎯ Ignore unsubmitted scores and proceed with finalization`;
          case "wos":
            return `None`;
          case "export":
            return `None`;
          case "roll":
            return `None`;
            case "8ball":
              return `\u0060[question]\u0060 ⎯ Your question, to be answered by the Magic 8 Ball`;
          case "help":
            return `\u0060[command]\u0060 ⎯ The command to view in depth`;
          case "ping":
            return `None`;
        }
      }
    }

    // Create the general help embed
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
            ? ", \u0060link\u0060, \u0060unlink\u0060, \u0060rename\u0060, \u0060correct\u0060, \u0060scan\u0060, \u0060finalize\u0060, \u0060wos\u0060, \u0060export\u0060"
            : ""
        }`,
      })
      .addFields({ name: "Fun", value: "`roll`, `8ball`" })
      .addFields({ name: "Utility", value: "`help`, `ping`" });

    // Create the specific help embed
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

    // Display responses
    let response = "";

    if (!getCommandInfo("description") && selectedCommand !== null) {
      response = `Error - The command **${selectedCommand}** could not be found`;
    } else {
      response = { embeds: [selectedCommand ? specificHelp : help] };
    }

    interaction.reply(response);
  },
};
