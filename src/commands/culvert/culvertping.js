const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const { getAllCharacters } = require("../../utility/culvertUtils.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
    .setName("culvertping")
    .setDescription("Create a pingable list of people who need to run culvert")
    .addAttachmentOption((option) =>
      option.setName("attach").setDescription("Image").setRequired(true)
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    // Parse the command arguments
    const imageOption = interaction.options.getAttachment("attach");

    // Command may take longer to execute. Defer the initial reply.
    await interaction.deferReply();

    // Immediately show progress
    await interaction.editReply("Preparing to analyze image...");

    // Get a list of all currently linked characters
    const characterList = await getAllCharacters();

    // Find an exception for the character name. if no exception exists, keep the entry name
    async function checkExceptions(entryName) {
      const exceptions = await exceptionSchema.find({});

      const exception = exceptions.find(
        (entry) => entryName.toLowerCase() === entry.exception.toLowerCase()
      );
      const returnedName = exception ? exception.name : entryName;

      return returnedName;
    }

    async function fetchBuffer(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Image fetch failed");
      return Buffer.from(await res.arrayBuffer());
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    await interaction.editReply("Analyzing image...");

    // Fetch the image and convert to base64
    const imageBuffer = await fetchBuffer(imageOption.proxyURL || imageOption.url);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are analyzing a MapleStory guild member list screenshot.
Extract ONLY the character names from this image which should be one column with one name per row.

The format should be one name per line.

Rules:
- Only include the character name (typically the first column, there is usually just one column in each image)
- Ignore all other columns (class, level, world, guild, culvert score, etc.)
- Return ONLY the character names, one per line
- Preserve exact character names including special characters (ö, á, etc.)
- Do not include headers or any other text

Example output:
PlayerName1
PlayerName2
PlayerName3`;

    let nameArray;
    
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: imageOption.contentType || "image/png"
          }
        },
        prompt
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse the AI response into an array of names
      nameArray = text.trim().split(/\r?\n/).filter(name => name.length > 0);

      await interaction.editReply("Processing names...");
    } catch (error) {
      console.error("Gemini API Error:", error);
      return interaction.editReply(
        "Error - Failed to analyze the image with Gemini API."
      );
    }

    // Array to store users who need to run culvert
    const usersNeedingCulvert = [];
    const notFoundNames = [];

    // Process each scanned name
    for (const scannedName of nameArray) {
      const checkedName = await checkExceptions(scannedName);
      
      // Check if the name is truncated with ellipsis
      const isTruncated = checkedName.endsWith("...");
      
      let nameBeginning, nameEnd, truncatedPrefix;
      
      if (isTruncated) {
        // For truncated names, remove the "..." and use the entire prefix for matching
        truncatedPrefix = checkedName.slice(0, -3);
        nameBeginning = truncatedPrefix.substring(0, 4);
      } else {
        // Get the first and last 4 letters of the character name to use for better database matching
        nameBeginning = checkedName.substring(0, 4);
        nameEnd = checkedName.substring(checkedName.length - 4);
      }

      const matchingNames = [];

      for (const character of characterList) {
        if (!character.name) continue;

        if (isTruncated) {
          // For truncated names, match any name that starts with the truncated prefix
          if (character.name.toLowerCase().startsWith(truncatedPrefix.toLowerCase())) {
            matchingNames.push(character.name.toLowerCase());
          }
        } else {
          // Find all names which match with the iterated nameBeginning or nameEnd
          const isNameMatching = character.name
            .toLowerCase()
            .match(new RegExp(`^${nameBeginning}|${nameEnd}$`, "gi"));

          // Store matched character names in a separate array
          if (isNameMatching && isNameMatching.length > 0) {
            matchingNames.push(character.name.toLowerCase());
          }
        }
      }

      // Set the character to the proper character in the scanned entry
      let character;
      let userDiscordId;

      // If more than one name was matched, perform a more accurate search
      if (matchingNames.length > 1) {
        for (const duplicateName of matchingNames) {
          const searchName = isTruncated 
            ? truncatedPrefix.toLowerCase() 
            : checkedName.toLowerCase();
          
          if (isTruncated) {
            // For truncated names, find the name that starts with the prefix
            if (duplicateName.startsWith(searchName)) {
              // Find the specified duplicate character
              const user = await culvertSchema.findOne(
                {
                  "characters.name": {
                    $regex: `^${duplicateName}$`,
                    $options: "i",
                  },
                },
                { "characters.$": 1, _id: 1 }
              );
              character = user?.characters[0];
              userDiscordId = user?._id;
              break; // Take the first match
            }
          } else if (duplicateName.includes(searchName)) {
            // Find the specified duplicate character
            const user = await culvertSchema.findOne(
              {
                "characters.name": {
                  $regex: `^${duplicateName}$`,
                  $options: "i",
                },
              },
              { "characters.$": 1, _id: 1 }
            );
            character = user?.characters[0];
            userDiscordId = user?._id;
          }
        }
      } else if (matchingNames.length === 1) {
        // Find the specified character, when no duplicates found
        if (isTruncated) {
          // For truncated names with a single match, use the matched name
          const matchedName = matchingNames[0];
          const user = await culvertSchema.findOne(
            {
              "characters.name": { $regex: `^${matchedName}$`, $options: "i" },
            },
            { "characters.$": 1, _id: 1 }
          );
          character = user?.characters[0];
          userDiscordId = user?._id;
        } else {
          const namePattern = `${nameBeginning}|${nameEnd}`;
          const user = await culvertSchema.findOne(
            {
              "characters.name": { $regex: `^${namePattern}$`, $options: "i" },
            },
            { "characters.$": 1, _id: 1 }
          );
          character = user?.characters[0];
          userDiscordId = user?._id;
        }
      }

      // Add matched user to the list
      if (character && userDiscordId) {
        // Check if we already have this user in the list (in case they have multiple characters)
        if (!usersNeedingCulvert.find(u => u.discordId === userDiscordId)) {
          usersNeedingCulvert.push({
            discordId: userDiscordId,
            characterName: character.name
          });
        }
      } else {
        // Character not found in database
        notFoundNames.push(checkedName);
      }
    }

    // Build the response message
    let pings = "";
    
    // Ping each user
    for (const user of usersNeedingCulvert) {
      pings += `<@${user.discordId}> `;
    }

    let response = "People who still need to run culvert\n```\n" + pings + "\n```";

    // Add list of names that couldn't be found
    if (notFoundNames.length > 0) {
      response += "\n\nThe following characters could not be found:\n";
      for (const name of notFoundNames) {
        response += `- **${name}**\n`;
      }
    }

    await interaction.editReply(response);
  },
};
