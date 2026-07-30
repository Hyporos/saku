const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();
const express = require("express");
const routes = require("./routes/routes");
const cors = require("cors");
const { loadDstOffset, saveDstState, JOB_DEFINITIONS, computeNextRun, startAllJobs } = require("./utility/cronRegistry");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const app = express();

app.use(express.json({ limit: "50mb" }));

app.use(cors());

const PORT = process.env.PORT || 25637;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Started at ${PORT}`);
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
  // Saku's chat reads the channel tail on every mention, so messages pile up in the cache. Sweep
  // them hourly and keep only the last half hour, which is all the context ever looks at.
  sweepers: {
    messages: { interval: 3600, lifetime: 1800 },
    threads: { interval: 3600, lifetime: 3600 },
  },
});

// Make the Discord client accessible inside Express route handlers via req.app.get("client")
app.set("client", client);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// DST state & cron registry (see utility/cronRegistry.js)

let dstOffset = loadDstOffset();

// Keeps references to running CronJob instances so they can be stopped on DST toggle.
const activeJobs = {};

// Expose the cron registry so route handlers can read state and trigger DST toggles
// via req.app.get("cronRegistry").
app.set("cronRegistry", {
  getDstOffset: () => dstOffset,
  setDstOffset: (newOffset) => {
    dstOffset = newOffset;
    saveDstState(newOffset);
    startAllJobs(client, activeJobs, newOffset);
  },
  getDefinitions: () => JOB_DEFINITIONS,
  computeNextRun: (def) => computeNextRun(def, dstOffset),
});

startAllJobs(client, activeJobs, dstOffset);

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
