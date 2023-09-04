const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const schema = require("../../schema.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Preview a culvert profile"),
  async execute(client, interaction) {
    const discordId = interaction.user.id;

    const character = await schema.findOne({ _id: discordId }, "character");

    if (character) {
      const afterEmbed = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setTitle(character.character)
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
      interaction.reply({ embeds: [afterEmbed] });
    } else {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setDescription("No characters have been detected.\nLink a character using the `/link` command.");
      interaction.reply({ embeds: [errorEmbed] });
    }
  },
};
