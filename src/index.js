const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const cron = require("cron");
const dayjs = require("dayjs");
const User = require('./schemas/userSchema');
const { createScheduledJob } = require("./utility/botUtils");
require("dotenv").config();
const express = require("express");
const routes = require("./routes/routes");
const cors = require("cors");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const app = express();

app.use(express.json());

app.use(cors());

app.listen(3000, () => {
  console.log(`Server Started at ${3000}`);
});

app.use('/api', routes)

// Create a new client instance
const client = new Client({
  intents:
    [GatewayIntentBits.Guilds] |
    [GatewayIntentBits.GuildMembers] |
    [GatewayIntentBits.MessageContent] |
    [GatewayIntentBits.GuildMessages],
  partials: [Partials.GuildMember],
});

const remindersScanChannel = "1090002887410729090";
const sakuChannel = "719788426022617142";

const ursusAfternoonEvent = createScheduledJob(
  client,
  sakuChannel,
  "0 14 * * *",
  "<@&835222431396397058> IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:1710439231:t> to <t:1710453631:t> your local time)"
);

const ursusNightEvent = createScheduledJob(
  client,
  sakuChannel,
  "0 21 * * *",
  "<@&835222431396397058> IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:1710464431:t> to <t:1710392431:t> your local time)"
);

const updateGuildJob = createScheduledJob(
  client,
  remindersScanChannel,
  "0 0 * * 4",
  "<@&720001044746076181> Please put in gskill points and update culvert scores for the week!"
);

// // 12:00 AM every 2nd day
// const culvertFlagJobAM = createScheduledJob(
//   client,
//   "1090002887410729090",
//   "0 0 */2 * *",
//   "IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:1710464431:t> to <t:1710392431:t> your local time)"
// );

// // 12:00 PM every 2nd day
// const culvertFlagJobPM = createScheduledJob(
//   client,
//   "1090002887410729090",
//   "0 12 */2 * *",
//   "IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:1710464431:t> to <t:1710392431:t> your local time)"
// );

// Start cron jobs
ursusAfternoonEvent.start();
ursusNightEvent.start();

updateGuildJob.start();

// culvertFlagJobAM.start();
// culvertFlagJobPM.start();

const setBirthdays = async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      const birthdayDate = user.birthdayDate;
      if (!birthdayDate) continue; // Skip users without a birthday date
      // Parse the birthday date using dayjs
      const birthday = dayjs(birthdayDate, "MMMM DD");
      // Extract day and month
      const month = birthday.month() + 1; // dayjs month is zero-based, so we add 1
      const day = birthday.date() - 1;
      // Create a cron schedule for the user's birthday at midnight
      const cronSchedule = `0 20 ${day} ${month} *`;
      // Create a birthday event for the user
      new cron.CronJob(
        cronSchedule,
        () => {
          const channel = client.channels.cache.get("1090002887410729090");
          if (!channel) {
            console.log("Error - Birthday message channel not found");
            return;
          }
          channel.send(`It's a special day today!\nEverybody wish <@${user.id}> a happy birthday! <:sakuParty:1072880580187930735>`);
        },
        null,
        true // Start the job right away
      );
    }
    console.log("Birthday events set up successfully");
  } catch (error) {
    console.error("Error setting up birthday events:", error);
  }
}

setBirthdays();

// Grab all of the slash command files
client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `Warning - The command at ${filePath} is missing a required "data" or "execute" property`
      );
    }
  }
}

// Grab all of the event handler files
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Log in to Discord with the bot's token
client.login(process.env.DISCORD_TOKEN);
