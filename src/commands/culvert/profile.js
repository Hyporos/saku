const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Preview a culvert profile"),
  async execute(client, interaction) {
    const discordId = interaction.user.id;

    const user = await culvertSchema.findById(discordId, "characters").exec();

    try {
      const success = new EmbedBuilder()
        .setColor(0xffc3c5)
        .setTitle(user.characters[0].name)
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
          value: `\u0060\u0060\u0060${user.characters[0].scores[0].date}: ${user.characters[0].scores[0].score}\u0060\u0060\u0060`,
          inline: false,
        })
        .addFields(
          { name: "Personal Best", value: "17,201", inline: true },
          { name: "Total Score", value: "57388", inline: true },
          { name: "Participation", value: "14/20 (70%)", inline: true }
        );
      interaction.reply({ embeds: [success] });
      console.log(characterButtons);
    } catch (error) {
      interaction.reply({
        content: `${error}`,
      });
    }
  },
};
