const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const cron = require("cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const User = require("./schemas/userSchema");
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

app.use("/api", routes);

// Create a new client instance
const client = new Client({
  intents:
    [GatewayIntentBits.Guilds] |
    [GatewayIntentBits.GuildMembers] |
    [GatewayIntentBits.MessageContent] |
    [GatewayIntentBits.GuildMessages] |
    [GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.GuildMember],
});

const remindersScanChannel = "1090002887410729090";
const sakuChannel = "719788426022617142";
const announcementsChannel = '720002714683179070';

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
  "0 20 * * 3",
  "<@&720001044746076181> Please put in gskill points and update culvert scores for the week!"
);

// 12:00 AM every 2nd day
const culvertFlagJobAM = createScheduledJob(
  client,
  sakuChannel,
  "0 8 */2 * *",
  "Reminder to complete Culvert and Flag Race!"
);

// 12:00 PM every 2nd day
const culvertFlagJobPM = createScheduledJob(
  client,
  sakuChannel,
  "0 20 */2 * *",
  "Reminder to complete Culvert and Flag Race!"
);

const mpReminderEmbed = new EmbedBuilder()
  .setTitle("Spiegelmann's Watching")
  .setDescription("Get your EXP coupons!")
  .setColor(0xffc3c5);

const rpReminderEmbed = new EmbedBuilder()
  .setTitle("It's the end of the month!")
  .setDescription("Don't forget to use up any expiring Reward Points.")
  .setColor(0xffc3c5);

// 8:00 PM every Saturday
const mpReminderJob = createScheduledJob(
  client,
  announcementsChannel,
  "0 20 * * 6",
  {
    content: "<@&962201169588019221>", // Ping for MP role
    embeds: [mpReminderEmbed],
  }
);

// // 7:00 PM on the last day of every month
// const rpReminderJob = createScheduledJob(
//   client,
//   announcementsChannel,
//   "0 19 L * *",
//   {
//     content: "<@&962201297757540372>", // Ping for RP role
//     embeds: [rpReminderEmbed],
//   },
// );

// Start cron jobs
ursusAfternoonEvent.start();
ursusNightEvent.start();

updateGuildJob.start();

culvertFlagJobAM.start();
culvertFlagJobPM.start();

mpReminderJob.start();
// rpReminderJob.start();

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
