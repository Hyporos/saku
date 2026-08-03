const { CHANNELS } = require("../config/ids.js");
// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const CHECKLIST_CHANNEL_ID = CHANNELS.REMINDERS_SCAN;

// One entry per weekly task. The id is used as the button's customId.
const CHECKLIST_ITEMS = [
  { id: "checklist_3", title: "Saku Guild Skills" },
  { id: "checklist_2", title: "Sakuwu Guild Skills" },
  { id: "checklist_1", title: "Hana Guild Skills" },
  { id: "checklist_5", title: "Scan Saku Culvert Scores" },
  { id: "checklist_4", title: "Saku In-Game Rank Movement" },
];

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const buildChecklistMessage = (completions = new Map()) => {
  const sections = [];

  for (let i = 0; i < CHECKLIST_ITEMS.length; i++) {
    const item = CHECKLIST_ITEMS[i];
    const completedBy = completions.get(item.id) ?? null;

    const button = completedBy
      ? { type: 2, custom_id: item.id, label: completedBy, style: 3 }
      : { type: 2, custom_id: item.id, label: "Mark Done", style: 2 };

    if (i > 0) sections.push({ type: 14, divider: true, spacing: 1 });

    sections.push({
      type: 9,
      components: [{ type: 10, content: `**${item.title}**` }],
      accessory: button,
    });
  }

  return {
    flags: 1 << 15,
    components: [
      {
        type: 17,
        accent_color: 0xffc3c5,
        components: [
          {
            type: 10,
            content: "## Weekly Checklist\nHere are this week's tasks. Mark each one as done when complete.",
          },
          { type: 14, divider: true, spacing: 2 },
          ...sections,
        ],
      },
    ],
  };
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Reads completed items from the existing message so state is preserved on each button click.
const parseCompletionsFromMessage = (message) => {
  const completions = new Map();

  const container = message.toJSON().components?.[0];
  if (!container?.components) return completions;

  for (const child of container.components) {
    if (child.type === 9 && child.accessory?.style === 3) {
      completions.set(child.accessory.custom_id, child.accessory.label);
    }
  }

  return completions;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const sendWeeklyChecklist = async (client) => {
  const channel = client.channels.cache.get(CHECKLIST_CHANNEL_ID);

  if (!channel) {
    console.error("Error - Weekly checklist channel not found");
    return;
  }

  await channel.send(`<@&720001044746076181>`);
  await channel.send(buildChecklistMessage());
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
  sendWeeklyChecklist,
  buildChecklistMessage,
  parseCompletionsFromMessage,
};
