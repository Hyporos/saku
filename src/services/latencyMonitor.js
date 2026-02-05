const { EmbedBuilder } = require("discord.js");
const net = require("net");
const fs = require("fs");
const path = require("path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const LATENCY_DATA_FILE = path.join(__dirname, "../data/latencyMessage.json");
const GUILD_ID = "719788426022617138";
const CHANNEL_ID = "1463623492015620137";

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

// Configuration constants
const CONFIG = {
  PING_ATTEMPTS: 5,
  PING_TIMEOUT: 3000,
  PING_HISTORY_SIZE: 10,
  FREQUENCY_HISTORY_SIZE: 25,
  UPDATE_INTERVAL: 10000, // 10 seconds
  TOP_CHANNELS_COUNT: 5
};

// Scoring weights for frequency calculation
const SCORING = {
  AVG_PING_WEIGHT: 1,
  STD_DEV_WEIGHT: 2
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(LATENCY_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Save message ID to file
function saveMessageId(messageId) {
  ensureDataDir();
  fs.writeFileSync(LATENCY_DATA_FILE, JSON.stringify({
    messageId: messageId
  }, null, 2));
}

// Load message ID from file
function loadMessageId() {
  try {
    if (fs.existsSync(LATENCY_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(LATENCY_DATA_FILE, "utf8"));
      return data.messageId || null;
    }
  } catch (error) {
    console.error("Error loading latency message ID:", error);
  }
  return null;
}

// Ping a single channel once and return the latency
function pingSingleAttempt(ip) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(CONFIG.PING_TIMEOUT);

    const cleanup = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.on("connect", () => cleanup(Date.now() - startTime));
    socket.on("timeout", () => cleanup(null));
    socket.on("error", () => cleanup(null));

    socket.connect(port, ip);
  });
}

// Ping a channel multiple times and return the median latency
async function pingChannel(ip) {
  const results = await Promise.all(
    Array(CONFIG.PING_ATTEMPTS).fill().map(() => pingSingleAttempt(ip))
  );

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

// Calculate frequency scores for worst and best performing channels
function calculateFrequencyScores(frequencyHistory) {
  const channelFrequency = {};
  const channelBestFrequency = {};
  
  // Initialize frequency counters
  for (let i = 0; i < ipAddresses.length; i++) {
    channelFrequency[i + 1] = 0;
    channelBestFrequency[i + 1] = 0;
  }

  // Calculate scores from history
  frequencyHistory.forEach(round => {
    // High latency channels
    round.avgPing.forEach(channelNum => {
      channelFrequency[channelNum] += SCORING.AVG_PING_WEIGHT;
    });
    round.stdDev.forEach(channelNum => {
      channelFrequency[channelNum] += SCORING.STD_DEV_WEIGHT;
    });
    
    // Best performing (for optimal usage)
    round.bestAvgPing.forEach(channelNum => {
      channelBestFrequency[channelNum] += SCORING.AVG_PING_WEIGHT;
    });
    round.bestStdDev.forEach(channelNum => {
      channelBestFrequency[channelNum] += SCORING.STD_DEV_WEIGHT;
    });
  });

  return { channelFrequency, channelBestFrequency };
}

// Calculate current channel statistics
function calculateCurrentStats(channelPings) {
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
  return currentStats;
}

// Get top performing channels by metric
function getTopChannels(stats, metric, ascending = false) {
  const sorted = [...stats].sort((a, b) => 
    ascending ? a[metric] - b[metric] : b[metric] - a[metric]
  );
  return sorted.slice(0, CONFIG.TOP_CHANNELS_COUNT).map(stat => stat.channelNumber);
}

// Update frequency history with current round data
function updateFrequencyHistory(currentStats, frequencyHistory) {
  const roundData = {
    avgPing: getTopChannels(currentStats, 'avgPing'),
    stdDev: getTopChannels(currentStats, 'stdDev'),
    bestAvgPing: getTopChannels(currentStats, 'avgPing', true),
    bestStdDev: getTopChannels(currentStats, 'stdDev', true)
  };
  
  frequencyHistory.push(roundData);
  
  // Keep only last N rounds
  if (frequencyHistory.length > CONFIG.FREQUENCY_HISTORY_SIZE) {
    frequencyHistory.shift();
  }
  
  return roundData;
}

// Build final channel statistics object
function buildChannelStats(channelPings, channelFrequency, channelBestFrequency) {
  const channelStats = {};
  
  for (let channelNum in channelPings) {
    const pings = channelPings[channelNum];
    const hasData = pings.length > 0;
    
    if (hasData) {
      const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
      const stdDev = calculateStdDev(pings, avgPing);
      
      channelStats[channelNum] = {
        channel: `Ch${channelNum}`,
        avgPing,
        stdDev,
        frequency: channelFrequency[channelNum],
        bestFrequency: channelBestFrequency[channelNum],
        failed: false,
      };
    } else {
      channelStats[channelNum] = {
        channel: `Ch${channelNum}`,
        avgPing: 0,
        stdDev: 0,
        frequency: 0,
        bestFrequency: 0,
        failed: true,
      };
    }
  }
  
  return channelStats;
}

// Get ranked channels based on primary and secondary sort criteria
function getRankedChannels(channels, primaryMetric, secondaryMetric, secondaryAscending = false) {
  return channels
    .sort((a, b) => {
      if (b[primaryMetric] !== a[primaryMetric]) {
        return b[primaryMetric] - a[primaryMetric];
      }
      // Secondary sort - lower is better for avgPing, higher for stdDev
      return secondaryAscending 
        ? a[secondaryMetric] - b[secondaryMetric]
        : b[secondaryMetric] - a[secondaryMetric];
    })
    .slice(0, CONFIG.TOP_CHANNELS_COUNT);
}

// Format channel data into a table string
function formatChannelTable(channels, frequencyField) {
  const header = "Channel    Frequency    Avg Ping     Std Deviation";
  const rows = channels.map(channel => 
    `${channel.channel.padEnd(10)} ${String(channel[frequencyField]).padEnd(12)} ${channel.avgPing.toFixed(2).padEnd(12)} ${channel.stdDev.toFixed(2)} ms`
  );
  
  return "```\n" + header + "\n" + rows.join("\n") + "\n```";
}

// Calculate stats for a single message's data
function calculateStatsForMessage(channelPings, frequencyHistory) {
  const currentStats = calculateCurrentStats(channelPings);
  updateFrequencyHistory(currentStats, frequencyHistory);

  // Calculate frequency scores from history
  const { channelFrequency, channelBestFrequency } = calculateFrequencyScores(frequencyHistory);

  // Build final channel statistics
  const channelStats = buildChannelStats(channelPings, channelFrequency, channelBestFrequency);

  // Separate working and failed channels
  const allStats = Object.values(channelStats);
  const workingChannels = allStats.filter(stat => !stat.failed);
  const failedChannels = allStats.filter(stat => stat.failed);

  // Get ranked channel lists
  const highLatencyChannels = getRankedChannels(workingChannels, 'frequency', 'stdDev');
  const lowLatencyChannels = getRankedChannels(workingChannels, 'bestFrequency', 'avgPing', true);

  return { failedChannels, highLatencyChannels, lowLatencyChannels, historyLength: frequencyHistory.length };
}

// Function to build the embed
function buildEmbed(failedChannels, highLatencyChannels, lowLatencyChannels, formattedTime) {
  const embed = new EmbedBuilder()
    .setTitle("Channel Latency Analysis")
    .setColor(0xffc3c5)
    .setDescription(
      `Every ${CONFIG.UPDATE_INTERVAL / 1000} seconds, all 40 channels are pinged ${CONFIG.PING_ATTEMPTS} times. Frequency is calculated using the top ${CONFIG.TOP_CHANNELS_COUNT} channels by avg ping and std deviation.\n\n**Results vary by location.** This bot is hosted in Ashburn, Virginia. Your optimal channels may differ based on your geographic location and ISP routing.\n\u200b`
    );

  // Add channel ranking fields
  embed.addFields(
    {
      name: "Low Latency Channels", 
      value: formatChannelTable(lowLatencyChannels, 'bestFrequency'),
      inline: false,
    },
    {
      name: "High Latency Channels",
      value: formatChannelTable(highLatencyChannels, 'frequency'),
      inline: false,
    }
  );

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

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Start the latency monitor
async function startLatencyMonitor(client) {

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
      console.log("Loaded existing latency analysis message");
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
          // Keep only last N pings
          if (channelPings[channelNumber].length > CONFIG.PING_HISTORY_SIZE) {
            channelPings[channelNumber].shift();
          }
        }
      }

      // Calculate stats
      const stats = calculateStatsForMessage(channelPings, frequencyHistory);

      // Check if all channels failed
      if (stats.failedChannels.length === ipAddresses.length) {
        console.error("Latency Monitor: All channels failed connection attempts");
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
          embeds: [buildEmbed(stats.failedChannels, stats.highLatencyChannels, stats.lowLatencyChannels, formattedTime)],
        });
        saveMessageId(postedMessage.id);
        console.log("Created new latency analysis message");
      } else {
        await postedMessage.edit({
          embeds: [buildEmbed(stats.failedChannels, stats.highLatencyChannels, stats.lowLatencyChannels, formattedTime)],
        });
      }
    } catch (error) {
      console.error("Error in latency monitor loop:", error);
    }
  }, CONFIG.UPDATE_INTERVAL);

  // Initial ping right away
  pingLoop._onTimeout();

  console.log("Channel Latency Monitor started successfully");
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  startLatencyMonitor,
};
