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
const User = require('./userSchema'); // Assuming you have a User model defined in user.js
require("dotenv").config();
const express = require("express");
const routes = require("./routes/routes");
const cors = require("cors");

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

const createScheduledEvent = (schedule, message) => {
  return new cron.CronJob(schedule, () => {
    const channel = client.channels.cache.get("719788426022617142");
    if (channel) {
      channel.send(message);
    } else {
      console.log(`Error - Channel ${channel} not found`);
    }
  });
};

const ursusAfternoonEvent = createScheduledEvent(
  "0 14 * * *",
  "<@&835222431396397058> IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:1710439231:t> to <t:1710453631:t> your local time)"
);

const ursusNightEvent = createScheduledEvent(
  "0 21 * * *",
  "<@&835222431396397058> IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:1710464431:t> to <t:1710392431:t> your local time)"
);

const setBirthdays = async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      const birthdayDate = user.birthdayDate;
      if (!birthdayDate) continue; // Skip users without a birthday date
      // Parse the birthday date using dayjs
      const birthday = dayjs(birthdayDate, "MMM DD, YYYY");
      // Extract day and month
      const month = birthday.month() + 1; // dayjs month is zero-based, so we add 1
      const day = birthday.date();
      // Create a cron schedule for the user's birthday at midnight
      const cronSchedule = `0 0 ${day} ${month} *`;
      // Create a birthday event for the user
      const birthdayEvent = new cron.CronJob(
        cronSchedule,
        () => {
          const channel = client.channels.cache.get("761406523950891059");
          if (!channel) {
            console.log("Error - Ursus reminder channel not found");
            return;
          }
          channel.send(`Happy birthday`);
        },
        null,
        true, // Start the job right away
        'UTC' // Timezone
      );
      // Start the birthday event
      birthdayEvent.start();
    }
    console.log("Birthday events set up successfully");
  } catch (error) {
    console.error("Error setting up birthday events:", error);
  }
}

setBirthdays();

// Start cron jobs
ursusAfternoonEvent.start();
ursusNightEvent.start();

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
        `Warning ⎯ The command at ${filePath} is missing a required "data" or "execute" property`
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
