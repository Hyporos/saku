const path = require("node:path");
const fs = require("node:fs");
const { EmbedBuilder } = require("discord.js");
const { CronJob } = require("cron");
const { createScheduledJob } = require("./botUtils");
const { sendWeeklyChecklist } = require("./checklistUtils");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// DST persistence
//
// dstOffset is 0 during Eastern Standard Time (UTC-5) and 1 during Eastern Daylight
// Time (UTC-4). All baseHour values represent the target EST wall-clock hour; the
// offset shifts the underlying cron expression so each announcement fires at the
// same "meaningful" local time year-round. Toggle via Admin Panel → Scheduled Tasks.

const DST_STATE_FILE = path.join(__dirname, "../data/dst-state.json");

/**
 * Reads the persisted DST offset from disk. Returns 0 (EST) if the file is
 * absent or unreadable, which is the safe default.
 */
const loadDstOffset = () => {
  try {
    return JSON.parse(fs.readFileSync(DST_STATE_FILE, "utf8")).dstOffset ?? 0;
  } catch {
    return 0;
  }
};

/** Writes the current DST offset to disk so it survives bot restarts. */
const saveDstState = (offset) => {
  try {
    fs.writeFileSync(DST_STATE_FILE, JSON.stringify({ dstOffset: offset }));
  } catch (e) {
    console.error("Error - Could not persist DST state:", e);
  }
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Job definitions

const remindersScanChannel = "1090002887410729090";
const sakuChannel = "719788426022617142";
const announcementsChannel = "720002714683179070";

// Structured job registry. baseHour is the intended EST hour during Standard Time;
// days is an array of day-of-week integers (0 = Sun … 6 = Sat), empty = every day.
const JOB_DEFINITIONS = [
  {
    id: "ursus-afternoon",
    name: "Ursus Afternoon Reminder",
    channelId: sakuChannel,
    channelName: "saku",
    baseHour: 13,
    days: [],
    category: "ursus",
    description: "Announces 2× Ursus is active for the next 4 hours.",
    getMessage: (offset) => () => {
      const now = dayjs().tz("America/New_York").hour(13 + offset).minute(0).second(0);
      const end = now.add(4, "hours");
      return `<@&835222431396397058> IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:${now.unix()}:t> to <t:${end.unix()}:t> your local time)`;
    },
  },
  {
    id: "ursus-night",
    name: "Ursus Night Reminder",
    channelId: sakuChannel,
    channelName: "saku",
    baseHour: 20,
    days: [],
    category: "ursus",
    description: "Announces 2× Ursus is active for the next 4 hours.",
    getMessage: (offset) => () => {
      const now = dayjs().tz("America/New_York").hour(20 + offset).minute(0).second(0);
      const end = now.add(4, "hours");
      return `<@&835222431396397058> IT IS 2X URSUS FOR THE NEXT FOUR HOURS! (<t:${now.unix()}:t> to <t:${end.unix()}:t> your local time)`;
    },
  },
  {
    id: "culvert-flag-mon-am",
    name: "Culvert & Flag Reminder (Mon AM)",
    channelId: sakuChannel,
    channelName: "saku",
    baseHour: 8,
    days: [1],
    category: "reminder",
    description: "Reminds members to complete Culvert and Flag Race.",
    getMessage: () => "Reminder to complete Culvert and Flag Race!",
  },
  {
    id: "culvert-flag-mon-pm",
    name: "Culvert & Flag Reminder (Mon PM)",
    channelId: sakuChannel,
    channelName: "saku",
    baseHour: 20,
    days: [1],
    category: "reminder",
    description: "Reminds members to complete Culvert and Flag Race.",
    getMessage: () => "Reminder to complete Culvert and Flag Race!",
  },
  {
    id: "culvert-flag-wed-am",
    name: "Culvert & Flag Reminder (Wed AM)",
    channelId: sakuChannel,
    channelName: "saku",
    baseHour: 8,
    days: [3],
    category: "reminder",
    description: "Reminds members to complete Culvert and Flag Race.",
    getMessage: () => "Reminder to complete Culvert and Flag Race!",
  },
  {
    id: "culvert-flag-sun-pm",
    name: "Culvert & Flag Reminder (Sun PM)",
    channelId: sakuChannel,
    channelName: "saku",
    baseHour: 20,
    days: [0],
    category: "reminder",
    description: "Reminds members to complete Culvert and Flag Race. (Image)",
    getMessage: () => "https://media.discordapp.net/attachments/1147319860481765500/1435854458381668445/image.png?ex=690e23eb&is=690cd26b&hm=67db9a7562919556cccd537f67c07d353ac7658ff7e2ba2f5e42cd1818efa3ca&=&format=webp&quality=lossless",
  },
  {
    id: "mp-reminder",
    name: "Monster Park Reminder",
    channelId: announcementsChannel,
    channelName: "announcements",
    baseHour: 19,
    days: [6],
    category: "mp",
    description: "Reminds members to collect Sunday boxes from Monster Park.",
    getMessage: () => ({
      content: "<@&962201169588019221>",
      embeds: [
        new EmbedBuilder()
          .setTitle("Spiegelmann's Watching")
          .setDescription("Get your EXP coupons!")
          .setColor(0xffc3c5),
      ],
    }),
  },
  {
    id: "culvertping-bee-reminder",
    name: "Culvert Ping Bee Reminder",
    channelId: remindersScanChannel,
    channelName: "reminders-scan",
    baseHour: 20,
    baseMinute: 30,
    days: [2],
    category: "reminder",
    description: "Reminds bees to send the culvert ping via /culvertping.",
    getMessage: () => `<@&${process.env.BEE_ROLE_ID}> Reminder to send out the /culvertping!`,
  },
  {
    id: "weekly-checklist",
    name: "Weekly Checklist",
    channelId: remindersScanChannel,
    channelName: "reminders-scan",
    baseHour: 19,
    days: [3],
    category: "reminder",
    type: "checklist",
    description: "Sends the weekly guild management checklist (gskills, scan, etc).",
  },
];

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Scheduling helpers

/**
 * Returns the next ISO run timestamp for a job definition in America/Toronto time.
 * Relies on the dayjs timezone plugin loaded at the top of this file.
 */
const computeNextRun = (def, offset) => {
  const effectiveHour = def.baseHour + offset;
  const minute = def.baseMinute ?? 0;
  const now = dayjs().tz("America/Toronto");
  if (def.days.length === 0) {
    let next = now.hour(effectiveHour).minute(minute).second(0).millisecond(0);
    if (!next.isAfter(now)) next = next.add(1, "day");
    return next.toISOString();
  }
  for (let i = 0; i <= 7; i++) {
    const candidate = now.add(i, "day").hour(effectiveHour).minute(minute).second(0).millisecond(0);
    if (def.days.includes(candidate.day()) && candidate.isAfter(now)) {
      return candidate.toISOString();
    }
  }
  return null;
};

/**
 * Stops all currently running jobs, then recreates and starts every job from
 * JOB_DEFINITIONS with the given DST offset applied to the cron expression.
 * Mutates the activeJobs map in-place so callers always hold a live reference.
 */
const startAllJobs = (client, activeJobs, offset) => {
  Object.values(activeJobs).forEach((j) => { try { j.stop(); } catch { /* ignore */ } });
  for (const def of JOB_DEFINITIONS) {
    const daysPart = def.days.length > 0 ? def.days.join(",") : "*";
    const minute = def.baseMinute ?? 0;
    let job;

    if (def.type === "checklist") {
      job = new CronJob(`${minute} ${def.baseHour + offset} * * ${daysPart}`, () => sendWeeklyChecklist(client));
    } else {
      const schedule = `${minute} ${def.baseHour + offset} * * ${daysPart}`;
      job = createScheduledJob(client, def.channelId, schedule, def.getMessage(offset));
    }

    job.start();
    activeJobs[def.id] = job;
  }
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = { loadDstOffset, saveDstState, JOB_DEFINITIONS, computeNextRun, startAllJobs };
