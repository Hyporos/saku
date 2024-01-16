const { SlashCommandBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dannis")
    .setDescription("Praise the lord"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {

    const number = Math.floor(Math.random() * 5) + 1

    function randomPhrase(number) {
      switch (number) {
        case 1:
          return `"I wait for the walker of night, my pitch boss awaits, in his blessing I pray. I can tap all things through Dannis who will bless us with stars with no booms" Dannis 1:22`;
        case 2:
          return ":PraygeGif: Dear king Dannis pls bless me and my devoted followers on this weekly reset :PraygeGif:";
        case 3:
          return "Who is dannis? For the blind, He is the vision. For the hungry, He is the chef. For the thirsty, He is the water. If dannis thinks, I agree. If dannis speaks, I am listening. If dannis has a million fans i am one of them . if dannis has ten fans i am one of them. if dannis has only one fan then that is me . if dannis has no fans, that means i am no longer on this earth . if the world is against dannis, i am against the world.";
        case 4:
          return "man i love dannis";
        case 5:
          return "Woke up this morning, remembered I'm a fan of dannis, day instantly better";
      }
    }

    interaction.reply({
      content: randomPhrase(number),
    });
  },
};
