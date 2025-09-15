const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const eventSchema = require("../../schemas/eventSchema.js");

module.exports = {
  async execute(interaction) {
    try {
      await interaction.deferReply();

      let users = await eventSchema.find({}, { _id: 1, mobcount: 1 }).lean();

      // Remove users with 0 mob count
      users = users.filter(u => (u.mobcount || 0) > 0); 

      if (!users.length) {
        return interaction.editReply("Error - No mob counts have been submitted");
      }

      users.sort((a, b) => (b.mobcount || 0) - (a.mobcount || 0));
      users.forEach((u, i) => (u.rank = i + 1));

      const pageSize = 10;
      let page = 1;
      const maxPage = Math.max(1, Math.ceil(users.length / pageSize));

      function slice(p) {
        const start = (p - 1) * pageSize;
        return users.slice(start, start + pageSize);
      }

      async function resolveNames(list) {
        for (const entry of list) {
            const member = await interaction.guild.members.fetch(entry._id).catch(() => null);
            entry.display = member ? member.user.tag : entry._id;
        }
      }

      function format(list) {
        const NAME_WIDTH = 17;                     
        const maxRankDigits = String(users.length).length;
        let out = "```";
        for (const e of list) {
          const rankStr = String(e.rank).padStart(maxRankDigits);
          const name =
            e.display.length > NAME_WIDTH
              ? e.display.slice(0, NAME_WIDTH - 1) + "…"
              : e.display.padEnd(NAME_WIDTH, " ");
          const scoreStr = (e.mobcount || 0).toLocaleString();
          out += `${rankStr}. ${name} ${scoreStr}\n`;
        }
        out += "```";
        return out;
      }

      async function buildEmbed(p) {
        const pageData = slice(p);
        await resolveNames(pageData);
        return new EmbedBuilder()
          .setColor(0xffc3c5)
          .setAuthor({ name: "Event Leaderboard (Mob Count)" })
          .setDescription(format(pageData))
          .setFooter({ text: `Participants: ${users.length}` });
      }

      function makeRow() {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setEmoji("<:singleleftchevron:1375242927634120804>")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId("page")
            .setLabel(`${page}/${maxPage}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("next")
            .setEmoji("<:singlerightchevron:1375242928787689693>")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === maxPage)
        );
      }

      const embed = await buildEmbed(page);
      const msg = await interaction.editReply({ embeds: [embed], components: [makeRow()] });

      if (maxPage === 1) return;

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: 120000,
        filter: (i) => i.user.id === interaction.user.id
      });

      collector.on("collect", async (i) => {
        if (i.customId === "prev" && page > 1) page--;
        else if (i.customId === "next" && page < maxPage) page++;

        const newEmbed = await buildEmbed(page);
        await i.update({ embeds: [newEmbed], components: [makeRow()] });
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => {});
      });
    } catch (err) {
      console.error(err);
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply("Error - Could not build event leaderboard");
      }
    }
  },
};