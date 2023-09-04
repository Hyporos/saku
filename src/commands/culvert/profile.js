const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Preview a culvert profile"),
  async execute(client, interaction) {
    const discordId = interaction.user.id;

    const user = await culvertSchema.findById(discordId, "characters").exec();

    const one = new ButtonBuilder()
      .setCustomId("1")
      .setLabel("1")
      .setStyle(ButtonStyle.Primary);

    const two = new ButtonBuilder()
      .setCustomId("2")
      .setLabel("2")
      .setStyle(ButtonStyle.Secondary);

      const three = new ButtonBuilder()
      .setCustomId("3")
      .setLabel("3")
      .setStyle(ButtonStyle.Secondary);

      const four = new ButtonBuilder()
      .setCustomId("4")
      .setLabel("4")
      .setStyle(ButtonStyle.Secondary);

      const five = new ButtonBuilder()
      .setCustomId("5")
      .setLabel("5")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(one, two, three, four, five);

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
          value:
            "```2023-08-14: 17,201\n2023-08-07: 15,862\n2023-07-31: 16,047\n2023-07-24: 16,052```",
          inline: false,
        })
        .addFields(
          { name: "Personal Best", value: "17,201", inline: true },
          { name: "Total Score", value: "57388", inline: true },
          { name: "Participation", value: "14/20 (70%)", inline: true }
        );
      interaction.reply({ embeds: [success], components: [row] });
    } catch (error) {
      interaction.reply({
        content: `${error}`,
      });
    }
  },
};
