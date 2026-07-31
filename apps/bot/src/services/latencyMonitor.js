const { EmbedBuilder } = require("discord.js");
const net = require("net");
const fs = require("fs");
const path = require("path");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const LATENCY_DATA_FILE = path.join(__dirname, "../data/latencyMessage.json");
const GUILD_ID = "719788426022617138";
const CHANNEL_ID = "1463623492015620137";

// The channel list lives in data/channel-ips.json so it can be refreshed when Nexon moves the servers
// without a code change or redeploy. ips[0] is CH1. An unreadable or empty file leaves this empty,
// which the monitor reports outright rather than quietly pinging nothing.
const CHANNEL_IPS_FILE = path.join(__dirname, "../data/channel-ips.json");

function loadChannelIps() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CHANNEL_IPS_FILE, "utf8"));
    const ips = (Array.isArray(parsed) ? parsed : parsed.ips) ?? [];
    if (!Array.isArray(ips) || ips.length === 0) throw new Error("no ips listed");
    return { ips, port: Number(parsed.port) || 8585 };
  } catch (error) {
    console.error(`Error - Could not read ${CHANNEL_IPS_FILE}: ${error.message}`);
    return { ips: [], port: 8585 };
  }
}

const { ips: ipAddresses, port } = loadChannelIps();

let pingLoop = null;

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

  // Find top 5 by lowest avg ping (best performing)
  const top5ByLowestAvgPing = [...currentStats]
    .sort((a, b) => a.avgPing - b.avgPing)
    .slice(0, 5)
    .map(stat => stat.channelNumber);

  // Find top 5 by lowest std dev (most stable)
  const top5ByLowestStdDev = [...currentStats]
    .sort((a, b) => a.stdDev - b.stdDev)
    .slice(0, 5)
    .map(stat => stat.channelNumber);

  // Store all lists for this round
  frequencyHistory.push({ 
    avgPing: top5ByAvgPing, 
    stdDev: top5ByStdDev,
    bestAvgPing: top5ByLowestAvgPing,
    bestStdDev: top5ByLowestStdDev
  });

  // Keep only last 25 rounds
  if (frequencyHistory.length > 25) {
    frequencyHistory.shift();
  }

  // Calculate frequency from history (last 25 rounds only)
  // +1 for top 5 avg ping, +2 for top 5 std dev (max +3 per round)
  const channelFrequency = {};
  const channelBestFrequency = {};
  for (let i = 0; i < ipAddresses.length; i++) {
    channelFrequency[i + 1] = 0;
    channelBestFrequency[i + 1] = 0;
  }

  frequencyHistory.forEach(round => {
    round.avgPing.forEach(channelNum => {
      channelFrequency[channelNum] += 1;
    });
    round.stdDev.forEach(channelNum => {
      channelFrequency[channelNum] += 2; // Double weight for std dev
    });
    // Track best performing channels
    round.bestAvgPing.forEach(channelNum => {
      channelBestFrequency[channelNum] += 1;
    });
    round.bestStdDev.forEach(channelNum => {
      channelBestFrequency[channelNum] += 2; // Double weight for std dev
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

  // Convert to array and sort
  const statsArray = Object.values(channelStats).filter(
    (stat) => !stat.failed
  );

  // Check if all channels failed
  const failedChannels = Object.values(channelStats).filter(
    (stat) => stat.failed
  );

  // Top 5 high latency channels (sorted by frequency, then by stdDev as tiebreaker)
  const highLatencyChannels = statsArray
    .sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.stdDev - a.stdDev;
    })
    .slice(0, 5);

  // Top 5 low latency channels (sorted by bestFrequency, then by avgPing as tiebreaker)
  const lowLatencyChannels = statsArray
    .sort((a, b) => {
      if (b.bestFrequency !== a.bestFrequency) {
        return b.bestFrequency - a.bestFrequency;
      }
      return a.avgPing - b.avgPing; // Lower ping is better
    })
    .slice(0, 5);

  return { failedChannels, highLatencyChannels, lowLatencyChannels, historyLength: frequencyHistory.length };
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Function to build the embed
function buildEmbed(failedChannels, highLatencyChannels, lowLatencyChannels, formattedTime) {
  const embed = new EmbedBuilder()
    .setTitle("Channel Latency Analysis")
    .setColor(0xffc3c5)
    .setDescription(
      "Every 10 seconds, all 40 channels are pinged 5 times. Frequency is calculated using the top 5 channels by avg ping and std deviation.\n\n**Results vary by location.** This bot is hosted in Ashburn, Virginia. Your optimal channels may differ based on your geographic location and ISP routing.\n\u200b"
    );

  embed.addFields({
    name: "Low Latency Channels",
    value:
      "```" +
      "Channel    Frequency    Avg Ping     Std Deviation\n" +
      lowLatencyChannels
        .map(
          (s) =>
            `${s.channel.padEnd(10)} ${String(s.bestFrequency).padEnd(12)} ${s.avgPing.toFixed(2).padEnd(12)} ${s.stdDev.toFixed(2)} ms`
        )
        .join("\n") +
      "```",
    inline: false,
  });

  embed.addFields({
    name: "High Latency Channels",
    value:
      "```" +
      "Channel    Frequency    Avg Ping     Std Deviation\n" +
      highLatencyChannels
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

// Shown when not one channel answered. Deliberately not styled like a reading: there are no numbers
// to report, and the useful information is which file to fix.
function buildUnreachableEmbed(formattedTime) {
  return new EmbedBuilder()
    .setTitle("Channel Latency Analysis — unavailable")
    .setColor(0xed4245)
    .setDescription(
      `None of the ${ipAddresses.length} channel servers answered on port ${port}, so there is nothing to measure.\n\n` +
        "Every address timing out at once is almost always the address list having gone stale, rather than the game being down: " +
        "Nexon moves these servers and the old IPs stop responding entirely.\n\n" +
        "Update `data/channel-ips.json` with the current addresses. No redeploy is needed, only a restart.​"
    )
    .setFooter({
      text: `Last checked at ${formattedTime}`,
      iconURL: "https://cdn.discordapp.com/attachments/1147319860481765500/1149549510066978826/Saku.png",
    });
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Start the latency monitor
async function startLatencyMonitor(client) {
  console.log("Starting High Latency Channel Monitor...");

  // No list means loadChannelIps already logged why. Starting a loop that pings nothing every ten
  // seconds forever would only bury that, so it stops here instead.
  if (ipAddresses.length === 0) {
    console.error(`Error - High Latency Monitor not started: no channel IPs in ${CHANNEL_IPS_FILE}`);
    return;
  }

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
      console.log("Loaded existing High Latency analysis message");
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

      // Format timestamp
      const now = new Date();
      const formattedTime = now
        .toUTCString()
        .replace(/^[A-Za-z]+,\s/, "")
        .replace("GMT", "UTC");

      // Every single channel failing is not a latency reading, it's a broken configuration: almost
      // always the IP list having gone stale after Nexon moved the servers. It used to log and return,
      // which left the last good embed sitting in the channel looking current, so the one state that
      // needs a human is the one nobody could see. Now it says so in the channel itself.
      const allDown = ipAddresses.length > 0 && stats.failedChannels.length === ipAddresses.length;
      if (allDown) console.error(`High Latency Monitor: all ${ipAddresses.length} channels failed on port ${port}`);

      const embed = allDown
        ? buildUnreachableEmbed(formattedTime)
        : buildEmbed(stats.failedChannels, stats.highLatencyChannels, stats.lowLatencyChannels, formattedTime);

      // Post or update message
      if (!postedMessage) {
        postedMessage = await targetChannel.send({ embeds: [embed] });
        saveMessageId(postedMessage.id);
        console.log("Created new High Latency analysis message");
      } else {
        await postedMessage.edit({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in High Latency monitor loop:", error);
    }
  }, 10000);

  // Initial ping right away
  pingLoop._onTimeout();

  console.log("High Latency Channel Monitor started successfully");
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  startLatencyMonitor,
};
