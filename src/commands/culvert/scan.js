const { SlashCommandBuilder } = require("discord.js");
const { createWorker } = require("tesseract.js");
const Jimp = require("jimp");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Check Saku's response time")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    ),

  async execute(client, interaction) {
    await interaction.reply({
      content: "Scanning...",
      fetchReply: true,
    });

    const image = interaction.options.getAttachment("attach");

    Jimp.read(image.proxyURL).then(function (image) {
      image
          .color([
            { apply: 'brighten', params: [20] }
          ])
          .contrast(1)
          .greyscale()
          .invert()
          .resize(1000, Jimp.AUTO)
          .write("processedImage.jpg");
  })

    const worker = await createWorker({
      logger: (m) => console.log(m),
    });
    (async () => {
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      const {
        data: { text },
      } = await worker.recognize("./processedImage.jpg");
      await interaction.editReply({ files: ["./processedImage.jpg"], content: text });
      await worker.terminate();
    })();
  },
};
