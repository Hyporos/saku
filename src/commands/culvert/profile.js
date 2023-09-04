const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Preview a culvert profile"),
  async execute(client, interaction) {
    const beforeEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setDescription("Loading...");

    const message = await interaction.reply({
      embeds: [beforeEmbed],
      fetchReply: true,
    });

    const afterEmbed = new EmbedBuilder()
      .setColor(0xffc3c5)
      .setTitle("Druuwu")
      .setDescription("Saku Culvert Stats")
      .setThumbnail(
        "https://i.mapleranks.com/u/IHPLFBDDCCGNPIFMLMIACBEPIPELOHEJFNKMOHAIODAJLGEBOHAKNKFLPLACFHCIHAJGHCOHAKABMCNECAIFAPCNKDDEBODIMONAKNMDDGNDHCLOFMIBHKBANOGALHGCPMLPNILOBPHIEACPMDLNLLMMFMNPHOKAJICIDAOFOAINKEJAFMMLGKLFLJOCLPCOJLOJPOIFLJIAAINMBJEIMGMECAFFHACPODAAEBAFKMBIKCHMKABJCAEDMADJCDHF.png"
      )
      .addFields(
        { name: "Class", value: "Hero", inline: true },
        { name: "Level", value: "276", inline: true },
        { name: "Rank", value: "Bloom", inline: true }
      )
      .addFields({
        name: "Recent Scores",
        value:
          "```2023-08-14: 17,201\n2023-08-07: 15,862\n2023-07-31: 16,047\n2023-07-24: 16,052```",
        inline: false,
      })
      .addFields(
        { name: "Personal Best", value: "17,201", inline: true },
        { name: "Total Score", value: "57388", inline: true },
        { name: "Participation", value: "14/20 (70%)", inline: true }
      );

    interaction.editReply({ embeds: [afterEmbed] });
  },
};
