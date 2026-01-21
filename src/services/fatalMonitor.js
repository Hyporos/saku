const { EmbedBuilder } = require("discord.js");
const net = require("net");
const fs = require("fs");
const path = require("path");

const FATAL_DATA_FILE = path.join(__dirname, "../data/fatalMessage.json");
const GUILD_ID = "719788426022617138";
const CHANNEL_ID = "1147319860481765500";

// IP addresses for all 40 channels
const ipAddresses = [
  "35.155.204.207",
  "52.26.82.74",
  "34.217.205.66",
  "35.161.183.101",
  "54.218.157.183",
  "52.25.78.39",
  "54.68.160.34",
  "34.218.141.142",
  "52.33.249.126",
  "54.148.170.23",
  "54.201.184.26",
  "54.191.142.56",
  "52.13.185.207",
  "34.215.228.37",
  "54.187.177.143",
  "54.203.83.148",
  "54.148.188.235",
  "52.43.83.76",
  "54.69.114.137",
  "54.148.137.49",
  "54.212.109.33",
  "44.230.255.51",
  "100.20.116.83",
  "54.188.84.22",
  "34.215.170.50",
  "54.184.162.28",
  "54.185.209.29",
  "52.12.53.225",
  "54.189.33.238",
  "54.188.84.238",
  "44.234.162.14",
  "44.234.162.13",
  "44.234.161.92",
  "44.234.161.48",
  "44.234.160.137",
  "44.234.161.28",
  "44.234.162.100",
  "44.234.161.69",
  "44.234.162.145",
  "44.234.162.130",
];

const port = 8585;
let pingLoop = null;

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(FATAL_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Save message ID to file (no-op, always use the hardcoded dev message)
function saveMessageId(messageId) {
  // No-op: always use the dev channel/message
}

// Load message ID from file (always return the dev message)
function loadMessageId() {
  return "1463578248850964623";
}

// Ping a single channel once and return the latency
function pingSingleAttempt(ip) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(3000);

    socket.on("connect", () => {
      const latency = Date.now() - startTime;
      socket.removeAllListeners();
      socket.destroy();
      resolve(latency);
    });

    socket.on("timeout", () => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(null);
    });

    socket.on("error", () => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(null);
    });

    socket.connect(port, ip);
  });
}

// Ping a channel 5 times and return the median latency
async function pingChannel(ip) {
  const results = await Promise.all([
    pingSingleAttempt(ip),
    pingSingleAttempt(ip),
    pingSingleAttempt(ip),
    pingSingleAttempt(ip),
    pingSingleAttempt(ip)
  ]);

  // Filter out null results (failed pings)
  const validResults = results.filter(r => r !== null);

  // If all pings failed, return null
  if (validResults.length === 0) return null;

  // Sort and return median
  validResults.sort((a, b) => a - b);
  return validResults[Math.floor(validResults.length / 2)];
}

// Calculate standard deviation
function calculateStdDev(values, mean) {
  const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

// Calculate stats for a single message's data
function calculateStatsForMessage(channelPings, frequencyHistory) {
  // Calculate current stats for all channels
  const currentStats = [];
  for (let channelNum in channelPings) {
    const pings = channelPings[channelNum];
    if (pings.length > 0) {
      const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
      const stdDev = calculateStdDev(pings, avgPing);
      currentStats.push({
        channelNumber: parseInt(channelNum),
        avgPing,
        stdDev,
      });
    }
  }

  // Find top 5 by highest avg ping
  const top5ByAvgPing = [...currentStats]
    .sort((a, b) => b.avgPing - a.avgPing)
    .slice(0, 5)
    .map(stat => stat.channelNumber);

  // Find top 5 by highest std dev
  const top5ByStdDev = [...currentStats]
    .sort((a, b) => b.stdDev - a.stdDev)
    .slice(0, 5)
    .map(stat => stat.channelNumber);

  // Store both lists for this round (channels can score 1 or 2 points)
  frequencyHistory.push({ avgPing: top5ByAvgPing, stdDev: top5ByStdDev });

  // Keep only last 25 rounds
  if (frequencyHistory.length > 25) {
    frequencyHistory.shift();
  }

  // Calculate frequency from history (last 25 rounds only)
  // +1 for top 5 avg ping, +2 for top 5 std dev (max +3 per round)
  const channelFrequency = {};
  for (let i = 0; i < ipAddresses.length; i++) {
    channelFrequency[i + 1] = 0;
  }

  frequencyHistory.forEach(round => {
    round.avgPing.forEach(channelNum => {
      channelFrequency[channelNum] += 1;
    });
    round.stdDev.forEach(channelNum => {
      channelFrequency[channelNum] += 2; // Double weight for std dev
    });
  });

  // Calculate final statistics for all channels
  const channelStats = {};
  for (let channelNum in channelPings) {
    const pings = channelPings[channelNum];

    if (pings.length > 0) {
      const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
      const stdDev = calculateStdDev(pings, avgPing);

      channelStats[channelNum] = {
        channel: `Ch${channelNum}`,
        avgPing: avgPing,
        stdDev: stdDev,
        frequency: channelFrequency[channelNum],
        failed: false,
      };
    } else {
      channelStats[channelNum] = {
        channel: `Ch${channelNum}`,
        avgPing: 0,
        stdDev: 0,
        frequency: 0,
        failed: true,
      };
    }
  }

  // Convert to array and sort
  const statsArray = Object.values(channelStats).filter(
    (stat) => !stat.failed
  );

  // Check if all channels failed
  const failedChannels = Object.values(channelStats).filter(
    (stat) => stat.failed
  );

  // Top 5 optimal channels (sorted by frequency, then by stdDev as tiebreaker)
  const optimalForFatal = statsArray
    .sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.stdDev - a.stdDev;
    })
    .slice(0, 5);

  return { failedChannels, optimalForFatal, historyLength: frequencyHistory.length };
}

// Function to build the embed
function buildEmbed(failedChannels, optimalForFatal, formattedTime) {
  const embed = new EmbedBuilder()
    .setTitle("Fatal Channel Analysis")
    .setColor(0xffc3c5)
    .setDescription(
      "Every 10 seconds, all 40 channels are pinged 5 times. Frequency is calculated using the top 5 channels by avg ping and std deviation.\n\n**Results vary by location.** This bot is hosted in Ashburn, Virginia. Your optimal channels may differ based on your geographic location and ISP routing.\n\u200b"
    );

  embed.addFields({
    name: "Optimal Channels for Fatal",
    value:
      "```" +
      "Channel    Frequency    Avg Ping     Std Deviation\n" +
      optimalForFatal
        .map(
          (s) =>
            `${s.channel.padEnd(10)} ${String(s.frequency).padEnd(12)} ${s.avgPing.toFixed(2).padEnd(12)} ${s.stdDev.toFixed(2)} ms`
        )
        .join("\n") +
      "```",
    inline: false,
  });

  if (failedChannels.length > 0) {
    embed.addFields({
      name: "⚠️ Offline Channels",
      value:
        failedChannels.length === 1
          ? `${failedChannels[0].channel} failed all connection attempts`
          : `${failedChannels.map((s) => s.channel).join(", ")} failed all connection attempts`,
      inline: false,
    });
  }

  embed.setFooter({
    text: `Last updated at ${formattedTime}`,
    iconURL:
      "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
  });

  return embed;
}

// Start the fatal monitor
async function startFatalMonitor(client) {
  console.log("Starting Fatal Channel Monitor...");

  // Data structures (frequencies reset on restart)
  const channelPings = {};
  const frequencyHistory = [];

  // Initialize storage for each channel
  for (let i = 0; i < ipAddresses.length; i++) {
    const channelNumber = i + 1;
    channelPings[channelNumber] = [];
  }

  // Get the target channel
  const guild = await client.guilds.fetch(GUILD_ID);
  const targetChannel = await guild.channels.fetch(CHANNEL_ID);

  let postedMessage = null;

  // Try to load existing message
  const savedMessageId = loadMessageId();
  if (savedMessageId) {
    try {
      postedMessage = await targetChannel.messages.fetch(savedMessageId);
      console.log("Loaded existing Fatal analysis message");
    } catch (error) {
      console.log("Could not fetch saved message, will create new one");
    }
  }

  // Main loop - ping and update every 10 seconds
  pingLoop = setInterval(async () => {
    try {
      // Ping all channels
      const latencies = await Promise.all(
        ipAddresses.map((ip) => pingChannel(ip))
      );

      // Store results (1 ping per channel per round)
      for (let i = 0; i < ipAddresses.length; i++) {
        const channelNumber = i + 1;
        const latency = latencies[i];

        if (latency !== null) {
          channelPings[channelNumber].push(latency);
          // Keep only last 10 pings (10 rounds × 1 ping)
          if (channelPings[channelNumber].length > 10) {
            channelPings[channelNumber].shift();
          }
        }
      }

      // Calculate stats
      const stats = calculateStatsForMessage(channelPings, frequencyHistory);

      // Check if all channels failed
      if (stats.failedChannels.length === ipAddresses.length) {
        console.error("Fatal Monitor: All channels failed connection attempts");
        return;
      }

      // Format timestamp
      const now = new Date();
      const formattedTime = now
        .toUTCString()
        .replace(/^[A-Za-z]+,\s/, "")
        .replace("GMT", "UTC");

      // Post or update message
      if (!postedMessage) {
        postedMessage = await targetChannel.send({
          embeds: [buildEmbed(stats.failedChannels, stats.optimalForFatal, formattedTime)],
        });
        saveMessageId(postedMessage.id);
        console.log("Created new Fatal analysis message");
      } else {
        await postedMessage.edit({
          embeds: [buildEmbed(stats.failedChannels, stats.optimalForFatal, formattedTime)],
        });
      }
    } catch (error) {
      console.error("Error in Fatal monitor loop:", error);
    }
  }, 10000);

  // Initial ping right away
  pingLoop._onTimeout();

  console.log("Fatal Channel Monitor started successfully");
}

// Stop the fatal monitor
function stopFatalMonitor() {
  if (pingLoop) {
    clearInterval(pingLoop);
    pingLoop = null;
    console.log("Fatal Channel Monitor stopped");
  }
}

module.exports = {
  startFatalMonitor,
  stopFatalMonitor,
};
