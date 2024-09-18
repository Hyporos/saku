const { SlashCommandBuilder } = require("discord.js");
const culvertSchema = require("../../culvertSchema.js");
const axios = require("axios");
const net = require("net");


// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  data: new SlashCommandBuilder()
  .setName("fatal")
  .setDescription("WIP"),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  async execute(interaction) {
    await interaction.deferReply();

    // Hardcoded IP addresses and ports
    const ipAddresses = [
      "35.155.204.207", "52.26.82.74", "34.217.205.66", "35.161.183.101",
      "54.218.157.183", "52.25.78.39", "54.68.160.34", "34.218.141.142",
      "52.33.249.126", "54.148.170.23", "54.201.184.26", "54.191.142.56",
      "52.13.185.207", "34.215.228.37", "54.187.177.143", "54.203.83.148",
      "54.148.188.235", "52.43.83.76", "54.69.114.137", "54.148.137.49",
      "54.212.109.33", "44.230.255.51", "100.20.116.83", "54.188.84.22",
      "34.215.170.50", "54.184.162.28", "54.185.209.29", "52.12.53.225",
      "54.189.33.238", "54.188.84.238", "44.234.162.14", "44.234.162.13",
      "44.234.161.92", "44.234.161.48", "44.234.160.137", "44.234.161.28",
      "44.234.162.100", "44.234.161.69", "44.234.162.145", "44.234.162.130",
    ];

    const port = 8585;
    const pingResults = [];
    
    // Process the TCP connection and display latency statistics
    function processConnection(index, startTime, error) {
      const latency = Date.now() - startTime;

      if (error) {
        pingResults.push(`Channel ${index}: Failed - ${error.message}`);
      } else {
        pingResults.push(`Channel ${index}: Latency: ${latency}ms`);
      }

      // Check if all pings are done
      if (pingResults.length === ipAddresses.length) {
        // Split results into chunks to fit within Discord's message limit
        const chunkSize = 2000; // Discord's message length limit
        for (let i = 0; i < pingResults.length; i += chunkSize) {
          interaction.followUp(pingResults.slice(i, i + chunkSize).join('\n'));
        }
      }
    }

    // Iterate through the list of hardcoded IP addresses
    ipAddresses.forEach((ip, index) => {
      const startTime = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(3000);

      socket.on("connect", () => {
        processConnection(index + 1, startTime, null); 
        socket.destroy();
      });

      socket.on("timeout", () => {
        processConnection(index + 1, startTime, new Error("Timed out"));
        socket.destroy();
      });

      socket.on("error", (err) => {
        processConnection(index + 1, startTime, err);
        socket.destroy();
      });

      socket.connect(port, ip);
    });

  },
};
