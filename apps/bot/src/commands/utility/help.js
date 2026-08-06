const { isBee, isOwner } = require("../../config/ids.js");
const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ACCENT = 0xffc3c5;
const EPHEMERAL_V2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const BEE_EMOJI = "🐝";
const OWNER_EMOJI = "👮";

// Category display order.
const CATEGORIES = ["Culvert", "User", "Fun", "Utility"];

// Single source of truth for /help — the category dropdown, command dropdown, detail view,
// and autocomplete all derive from this. Adding a command is one entry here.
// Access tiers: (default) public · `bee: true` bee/admin · `owner: true` owner-only.
const COMMANDS = [
  {
    name: "gpq",
    cat: "Culvert",
    desc: "Log a culvert score for one of your characters. The score is set to the current weekly reset (Thursday 12:00 AM UTC), and logging again for the same week overwrites it rather than adding a second entry. If you omit the character and have only one linked, it's picked automatically. Beating your previous best gets a 🏆 and a reaction.",
    params: "`[score]` - The score to be logged (0 to 2,000,000)\n`[character]` - The character to log it to (optional; defaults to your only linked character)",
  },
  {
    name: "profile",
    cat: "Culvert",
    desc: "View a character's culvert profile: class and level from the official rankings, join date, this week's score, personal best, the last four weeks, yearly total, and weekly/yearly rank. Leave the character empty to see your own; the autocomplete lists everyone, so you can look up any member. Ranks are worked out against the current roster, so you're only ever placed against people still in the guild. If the rankings site is unreachable the profile still loads, just without class and level.",
    params: "`[character]` - The character to view (optional; defaults to your own, and you can view anyone's)",
  },
  {
    name: "graph",
    cat: "Culvert",
    desc: "View the interactive progression graph of a character. Switch between Score, Score + Median, and Rank views, adjust the number of weeks, hide missed weeks, and browse your characters — or view anyone else's. Score covers every week the character has. The guild median needs guild data behind it, so it only reaches back to the first finalized week (the current week is included, calculated from what's been logged so far). Rank is finalized weeks only, since placing someone against a half-logged week would be meaningless.",
    params: "`[character]` - The character to graph (optional; defaults to your own, and you can view anyone's)",
  },
  {
    name: "graphcolor",
    cat: "Culvert",
    desc: "Change the color of your progression graph area using an interactive picker — choose from the dropdown to preview each color on your own graph, then apply it. Your graph is shown to other users in the color you choose",
    params: "None - pick a color from the interactive dropdown, preview it live on your graph, then press Apply Color",
  },
  {
    name: "rankings",
    cat: "Culvert",
    desc: "View the interactive culvert leaderboard. Switch between Weekly and Yearly rankings from the dropdown, page through the standings, and use Jump to Me to find your own character. Shows a top-3 podium with medals. Give it a class to rank only that class — the board is then numbered 1 to N within the class rather than showing guild-wide positions. The class list autocompletes from the classes people here actually play, so it stays current as new ones are added to the game.",
    params: "`[class]` - Only rank characters of this class (optional; autocompletes)",
  },
  {
    name: "character link",
    cat: "Culvert",
    bee: true,
    desc: "Link a character to a Discord ID. The name is checked against the official rankings and stored with its real capitalisation, so you can type it in any case. The join date accepts most common forms (ex: April 28 2023 or 2023-04-28) and must be a real past date. If the character isn't on the rankings — a brand new character, or one that hasn't ranked yet — use `override` to link it anyway. The character always starts from scratch with no scores; use `/character restore` if you need an old history put back. A welcome message is posted in the culvert channel.",
    params:
      "`[character]` - The character to be linked\n`[discord_user]` - The Discord user to be paired with the character\n`[member_since]` - The date that the character joined the guild\n`[override]` - Force link the character, even if not present on rankings",
  },
  {
    name: "character unlink",
    cat: "Culvert",
    bee: true,
    desc: "Unlink and remove a character from the database. Every score they ever logged is permanently deleted, so it asks you to confirm first and tells you exactly how many scores are about to go. The character is written into the action log before it's removed, so a mistake can be reconstructed. Any /scan exceptions for that name are cleaned up too, and the user's record is deleted entirely if that was their last character.",
    params: "`[character]` - The character to be unlinked (pick from the list, it autocompletes)",
  },
  {
    name: "character restore",
    cat: "Culvert",
    bee: true,
    desc: "Undo an unlink. Puts the character back on its original owner with every score it had, its join date, its graph colour and any /scan exceptions that went with it — exactly as it was. Only works for characters unlinked in the last 90 days, since that's how long the action log keeps the snapshot; anything older is gone for good. If a character was unlinked more than once it takes the most recent unlink that actually had scores, so an emptied one can't hide a full one. The list autocompletes from recent unlinks, leaving out anything that has since been linked again.",
    params: "`[character]` - The character to restore (pick from the list, it autocompletes)",
  },
  {
    name: "character rename",
    cat: "Culvert",
    bee: true,
    desc: "Rename a character. All scores and character info are kept, and any /scan exceptions pointing at the old name follow it across. Like link, the new name is verified against the rankings and stored with its real capitalisation; use `override` if it isn't ranked yet.",
    params:
      "`[old_name]` - The character to be renamed (pick from the list, it autocompletes)\n`[new_name]` - The new name to set for this character\n`[override]` - Force rename the character, even if not present on rankings",
  },
  {
    name: "character changeid",
    cat: "Culvert",
    bee: true,
    desc: "Move everything tied to a Discord account to another one: culvert characters and scores, level and EXP, birthday, and their starboard posts and stars given. Used when someone remakes their Discord. Shows you exactly what will move and asks to confirm first, and writes a full copy to the action log beforehand so nothing can be lost. The new account must have no culvert data of its own.",
    params: "`[old_user]` - The current Discord user to change ID from\n`[new_user]` - The new Discord user to transfer data to",
  },
  {
    name: "character correct",
    cat: "Culvert",
    bee: true,
    desc: "Edit or create a score for a character. If no score exists for that week, one is created; otherwise the existing one is overwritten. Pick `week` for this week or last week, or give an exact `date` for an older one — a culvert week is identified by the Wednesday before its reset, so a date has to land on a Wednesday. If that week has already been finalized, its locked-in record is updated to match, so /graph, the guild median and /weekly all show the correction too.",
    params:
      "`[character]` - The character to be corrected (pick from the list, it autocompletes)\n`[score]` - The new score to submit\n`[week]` - This week or last week (use this or `date`)\n`[date]` - An exact week instead (YYYY-MM-DD, must be a Wednesday)",
  },
  {
    name: "exception",
    cat: "Culvert",
    bee: true,
    desc: "Add a character exception to /scan. If a name is being incorrectly read by the bot, you can add an exception (alternative name) for the bot to recognize.",
    params: "`[name]` - The name of the character\n`[exception]` - The alternative name, which is being incorrectly scanned",
  },
  {
    name: "scan",
    cat: "Culvert",
    bee: true,
    desc: "Submit bulk culvert data from a screenshot. The screenshot must be from the Member Participation Status tab in the guild menu, and only contain the columns from Name to Culvert.",
    params: "`[attach]` - Screenshot of the culvert character name and score list \n`[week]` - Submit the scores for either the current or the last week",
  },
  {
    name: "culvertping",
    cat: "Culvert",
    bee: true,
    desc: "Scan a list of character names from a screenshot and create a pingable list of their names. Best used with a screenshot from the Culvert board of character names who have a score of 0.",
    params: "`[attach]` - Screenshot containing the list of character names to ping",
  },
  {
    name: "finalize",
    cat: "Culvert",
    bee: true,
    desc: "Finalize a week's culvert scores. It first lists any characters with unsubmitted scores (to confirm /scan didn't miss anyone or that members have left), then locks in the week — saving a finalized record with submitted/total counts and a score snapshot used by /weekly, plus a JSON backup of all user data. Use override to finalize despite missing scores.",
    params: "`[week]` - Check the scores for either the current or the last week\n`[override]` - Ignore unsubmitted scores and proceed with finalization",
  },
  {
    name: "wos",
    cat: "Culvert",
    bee: true,
    desc: "View the wall of shame. On the wall there will be a list of users sorted by their participation rate, based on the minimum rate provided.",
    params: "`[participation_rate]` - The minimum participation rate percentage to filter by",
  },
  {
    name: "export",
    cat: "Culvert",
    bee: true,
    desc: "Export a .csv of every character's scores, one column per week, sorted by how long they've been in the guild. Opens straight into Excel or Sheets. Exports everything by default; give `weeks` a number to trim it to that many of the most recent weeks instead. Asking for more weeks than exist just gives you all of them. The file is named with today's date so a folder of exports stays sorted.",
    params: "`[weeks]` - How many recent weeks to include (optional; defaults to all time)",
  },
  {
    name: "weekly",
    cat: "Culvert",
    bee: true,
    desc: "View weekly guild culvert statistics and score graphs. `stats` opens on the latest finalized week with totals, averages and percentiles, each showing its change against the week before — page back through every finalized week with the chevrons. `graph` shows the guild's score progression over time. All figures come from the finalized snapshot of each week, so they stay fixed once a week is closed, even if a member later leaves.",
    params:
      "None - `stats` takes no arguments; use the chevrons to move between weeks and Latest to jump back to the newest\n`graph` - Opens an interactive graph; use the buttons to change the metric (total or spread) and week count",
  },
  {
    name: "chat",
    cat: "Fun",
    desc: "Chat with Saku AI. Talk MapleStory (bosses, gear, progression, patches) or ask about your culvert scores, the leaderboard, and when culvert resets — Saku pulls live guild data and can search the web to answer, and remembers your conversation. `/chat` works in any channel because the reply is only visible to you. @mentioning Saku is public, so that one is limited to the Saku chat channel; bees can mention anywhere. Guild members only.",
    params:
      "`[message]` - What you want to say or ask Saku\n`[image]` - A screenshot for Saku to look at, such as gear, a boss drop or a score screen (optional)",
  },
  {
    name: "roll",
    cat: "Fun",
    desc: "Roll a number between 1 and 100, or between 1 and a number you pick",
    params: "`[max]` - Roll 1 to this number instead of 100 (optional; defaults to 100)",
  },
  { name: "dannis", cat: "Fun", desc: "Praise the lord", params: "None" },
  {
    name: "starboard top",
    cat: "Fun",
    desc: "The interactive starboard leaderboard. A message reaches the starboard once 10 people react to it with the star emote (your own star on your own message never counts). Switch between All Time, This Year and This Month, and page through the rest. Ranked by the most stars a post ever held, so an old favourite doesn't slide down the board when people leave the server.",
    params: "None",
  },
  {
    name: "starboard user",
    cat: "Fun",
    desc: "Someone's starboard record: how many of their messages made it, how many stars they've earned in total, where they place against everyone else, their best post, and how many other people's posts they've handed a star to.",
    params: "`[member]` - Whose record to view (optional; defaults to you)",
  },
  {
    name: "starboard random",
    cat: "Fun",
    desc: "Pull a random post off the starboard, with the context around it: how many stars it got, where it ranks against everything else, when it made the board, and which channel it came from.",
    params: "None",
  },
  {
    name: "user level",
    cat: "User",
    desc: "View your or another user's Discord level and EXP.",
    params: "`[user]` - The user you would like to view (optional; defaults to yourself)",
  },
  {
    name: "user leaderboard",
    cat: "User",
    desc: "View the server level leaderboard, ranked by level and EXP.",
    params: "None",
  },
  {
    name: "help",
    cat: "Utility",
    desc: "Display a list of all commands. Browse by category and open any command from the dropdown to see its details. Did you really just do /help help?",
    params: "None",
  },
  {
    name: "birthday set",
    cat: "Utility",
    desc: "Save the month you were born in. Saku wishes everyone born that month together, in a single message posted at midnight Pacific on the 1st. Only the month is stored, never a date.",
    params: "`[month]` - Pick your birth month from the list",
  },
  {
    name: "birthday clear",
    cat: "Utility",
    desc: "Remove your saved birthday so you are no longer included in the monthly announcement.",
    params: "None",
  },
  { name: "ping", cat: "Utility", desc: "Check Saku's response time. It will display both the latency and API ping.", params: "None" },
  {
    name: "say",
    cat: "Utility",
    bee: true,
    desc: "Have Saku relay a message for you in the specified channel",
    params: "`[message]` - The message you would like Saku to send\n`[channel]` - The text channel to send the message in",
  },
  {
    name: "reload",
    cat: "Utility",
    owner: true,
    desc: "Reload a command's code without restarting the bot.",
    params: "`[category]` - The category of the command\n`[command]` - The command to reload",
  },
];

// A command is visible at a view tier: member < bee < owner.
function canSee(c, view) {
  if (c.owner) return view === "owner";
  if (c.bee) return view === "bee" || view === "owner";
  return true;
}

const commandByName = (name) => COMMANDS.find((c) => c.name === name?.toLowerCase());
const catCommands = (cat, view) => COMMANDS.filter((c) => c.cat === cat && canSee(c, view));

// ⎯⎯ Panel ⎯⎯ //

function render(state, owner, disabled = false) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  const cmd = state.command ? commandByName(state.command) : null;

  if (cmd) {
    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## /${cmd.name}\n${cmd.desc}`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Parameters**\n${cmd.params}`));
  } else {
    const cmds = catCommands(state.cat, state.view);
    const line = (list) => list.map((c) => `\`${c.name}\``).join(" ");
    const pub = line(cmds.filter((c) => !c.bee && !c.owner));
    const bee = line(cmds.filter((c) => c.bee));
    const own = line(cmds.filter((c) => c.owner));
    const body = [pub || null, bee ? `Bee-only: ${bee}` : null, own ? `Owner-only: ${own}` : null].filter(Boolean).join("\n\n");
    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Saku Bot Commands\n-# Choose a category, then open a command for details."))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${state.cat}**\n${body}`));
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  // Category dropdown
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help_cat")
        .setPlaceholder("Category")
        .setDisabled(disabled)
        .addOptions(
          CATEGORIES.filter((cat) => catCommands(cat, state.view).length).map((cat) => ({
            label: cat,
            value: cat,
            default: cat === state.cat,
          }))
        )
    )
  );

  // Command dropdown (scoped to the selected category)
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help_cmd")
        .setPlaceholder(`View a ${state.cat} command…`)
        .setDisabled(disabled)
        .addOptions(
          catCommands(state.cat, state.view).map((c) => {
            // Tier emoji goes inline in the label (unicode) so no option uses the emoji field —
            // that avoids Discord's phantom alignment padding on the emoji-less options.
            const icon = c.owner ? `${OWNER_EMOJI} ` : c.bee ? `${BEE_EMOJI} ` : "";
            return { label: `${icon}/${c.name}`, value: c.name, default: c.name === state.command };
          })
        )
    )
  );

  // Owner-only: preview the panel as a member, a bee, or the owner
  if (owner) {
    const btn = (id, label, active) =>
      new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(active ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(disabled);
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        btn("help_as_member", "View as Member", state.view === "member"),
        btn("help_as_bee", "View as Bee", state.view === "bee"),
        btn("help_as_owner", "View as Owner", state.view === "owner")
      )
    );
  }

  return { components: [container], flags: EPHEMERAL_V2 };
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("Display a list of all commands"),

  async execute(interaction) {
    const owner = isOwner(interaction.user.id);
    const view = owner ? "owner" : isBee(interaction.member, interaction.user.id) ? "bee" : "member";
    const state = { cat: "Culvert", command: null, view };

    await interaction.reply(render(state, owner));
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ idle: 180_000 });

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: "This isn't your help panel — run `/help` for your own.", flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        try {
          await i.deferUpdate();
        } catch {
          return; // interaction expired (stale panel / latency)
        }

        if (i.customId === "help_cat") {
          state.cat = i.values[0];
          state.command = null;
        } else if (i.customId === "help_cmd") {
          state.command = i.values[0];
        } else if (i.customId === "help_as_member") {
          state.view = "member";
        } else if (i.customId === "help_as_bee") {
          state.view = "bee";
        } else if (i.customId === "help_as_owner") {
          state.view = "owner";
        }

        // Drop a now-hidden selection after a view change
        if (state.command && !canSee(commandByName(state.command), state.view)) state.command = null;

        await i.editReply(render(state, owner));
      } catch (err) {
        console.error("Error - /help interaction failed:", err);
      }
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply(render(state, owner, true));
      } catch {
        // message may have been deleted
      }
    });
  },
};
