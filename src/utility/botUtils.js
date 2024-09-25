const { CronJob } = require("cron");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Check if the bot has crashed in the last 2 minutes. If so, send a crash report.
 *
 * @param {string} channel - The channel for the message to be sent to.
 */

function checkForCrashes(channel) {
  fs.readdir("/home/container/.apollo/crashes", (err, files) => {
    if (err) {
      console.error("Error - Cannot find the crash log directory");
      return;
    }

    // Check each file in the directory
    for (const file of files) {
      const fileNamePattern =
        /^crash-(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\.log$/;
      const match = fileNamePattern.exec(file);

      if (match) {
        // Parse the date from the file name
        const fileDate = dayjs.utc(match[1]);
        const now = dayjs().utc();

        // Check if the file was created today and on this hour
        if (fileDate.isSame(now, "day") && fileDate.isSame(now, "hour")) {
          // Check if the file date is within the last 2 minutes
          if (now.diff(fileDate, "minute") <= 2) {
            // If channel found, send the crash report
            if (channel) {
              const filePath = path.join(
                "/home/container/.apollo/crashes/",
                file
              );
              channel.send({
                content: `Uh oh! Saku ran into an issue and temporarily crashed but is back online now:`,
                files: [filePath],
              });
            }

            break;
          }
        }
      }
    }
  });
}


/**
 * Finds a character based on the given name
 *
 * @param {Object} client - The client object from Discord.js.
 * @param {string} channel - The channel id for the message to be sent to.
 * @param {string} schedule - The cron schedule to be used for the job.
 * @param {string} message - The message to be sent to the channel.
 */

const createScheduledJob = (client, channelId, schedule, message) => {
  return new CronJob(schedule, () => {
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
      console.log(`Error - Channel ${channelId} not found`);
    }

    channel.send(message);
  });
};

module.exports = { checkForCrashes, createScheduledJob };
