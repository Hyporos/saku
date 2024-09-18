const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const updateLocale = require("dayjs/plugin/updateLocale");
dayjs.extend(utc);
dayjs.extend(updateLocale);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Roll a giveaway for 7 lucky members"),

  async execute(interaction) {
    // Last reset
    dayjs.updateLocale("en", {
      weekStart: 4,
    });

    // Define the date for which to check scores
    const checkDate = "2024-08-25";

    // Fetch members from the guild to check for the role
    const guild = interaction.guild; // Get the guild
    const members = await guild.members.fetch(); // Fetch all members

    // Map the members to easily check for roles
    const memberMap = new Map();
    members.forEach((member) => {
      memberMap.set(member.id, member.roles.cache.has("720001044746076181")); // Map the member ID and whether they have the Bee role
    });

    // Get all users from your schema
    const users = await culvertSchema.aggregate([
      {
        $unwind: "$characters",
      },
    ]);

    const excludedBeeCharacters = []; // Collect excluded Bee role characters
    const includedCharacters = []; // Collect valid characters without the Bee role

    // Track user IDs to ensure only the first valid character is included
    const userSeen = new Set();

    // Filter characters that have a score on the last Wednesday and exclude those with the Bee role
    users.forEach((user) => {
      const { characters } = user;
      const userId = user._id.toString(); // Assuming _id is their Discord ID

      // Check if this user ID has been seen
      if (userSeen.has(userId)) return; // Skip if we've already seen this ID

      // Find the score for the specified date
      const lastSundayScore = characters.scores.find((score) => {
        return dayjs(score.date).format("YYYY-MM-DD") === checkDate;
      });

      if (lastSundayScore && lastSundayScore.score > 0) { // Exclude users with a score of 0
        if (memberMap.has(userId) && memberMap.get(userId)) {
          // The user has the Bee role, exclude them and add to excluded list
          excludedBeeCharacters.push(characters.name);
        } else {
          // The user does not have the Bee role, include the first valid character
          includedCharacters.push({ ...user, lastSundayScore });
          userSeen.add(userId); // Mark this user ID as seen
        }
      }
    });

    // Shuffle the array to randomize selection
    const shuffled = includedCharacters.sort(() => 0.5 - Math.random());

    // Pick the first 7 random characters (no need to check for duplicate IDs)
    const selectedCharacters = shuffled.slice(0, 7);

    // Prepare reply message displaying the character's score from last Wednesday
    const replyMessage = selectedCharacters
      .map((user, index) => {
        const { characters, lastSundayScore } = user;
        return `${index + 1}: ${characters.name} - Score: ${lastSundayScore.score}`;
      })
      .join("\n");

    // Total number of users with a score above 0
    const totalUsersWithScore = includedCharacters.length + excludedBeeCharacters.length;

    // Send reply with the selected characters, their scores, and the total users with scores
    interaction.reply(
      `**Congratulations to the following lucky winners!**\n\nOut of ${totalUsersWithScore} members who participated in last week's culvert, these 7 (bees excluded, only 1 character per user) have each won **10k NX**!\n\n${replyMessage}\n\nThank you for supporting the guild! <:sakuLove:1134552433314504835>`
    );
  },
};
