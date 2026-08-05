const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const axios = require("axios");
const dayjs = require("dayjs");
const culvertSchema = require("../../schemas/culvertSchema.js");
const exceptionSchema = require("../../schemas/exceptionSchema.js");
const actionLogSchema = require("../../schemas/actionLogSchema.js");
const weekSchema = require("../../schemas/weekSchema.js");
const userSchema = require("../../schemas/userSchema.js");
const starboardSchema = require("../../schemas/starboardSchema.js");
const { nameMatch, getResetDates } = require("../../utility/culvertUtils.js");
const { CHANNELS } = require("../../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Every operation that edits the roster, in one place: they all resolve a character the same way, all
// write to the same collections, and all log the same shape.

// MapleStory names are alphanumeric. Checked before anything reaches the database or the rankings API.
const VALID_NAME = /^[A-Za-z0-9]{2,13}$/;

// GMS opened in May 2005, so nothing predates it and nothing can join in the future.
const GAME_LAUNCH = "2005-05-11";

// The highest score in this database is a little over 1.1 million, so this is roughly double the real
// ceiling: high enough never to reject a genuine score, low enough that a fat-fingered extra digit is
// caught before it skews the guild median and every graph that reads it.
const MAX_SCORE = 2000000;

// How far back a restore can reach, matching the action log's own expiry.
const RESTORE_WINDOW_DAYS = 90;

const RANKINGS_URL = (name) =>
  `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=1&page_index=1&character_name=${encodeURIComponent(
    name
  )}`;

/**
 * Look a character up on the official rankings.
 *
 * The API answers 200 with `ranks: []` for a name that does not exist, so the old `.catch()` never
 * fired for the ordinary not-found case: `ranks[0]?.characterName` came back undefined and was written
 * into the database as a character with no name at all. A miss has to be detected from the body.
 *
 * @param {string} name - The character name to look up.
 * @returns {Promise<string|null>} - The properly cased name, or null if it is not on the rankings.
 */
async function lookupOnRankings(name) {
  const { data } = await axios.get(RANKINGS_URL(name), { timeout: 10000 });
  return data?.ranks?.[0]?.characterName ?? null;
}

// Resolve a name against the rankings, or explain why it could not be. Returns null once it has
// already answered the interaction.
async function resolveName(interaction, name, override, label) {
  if (override) return name;
  try {
    const found = await lookupOnRankings(name);
    if (found) return found;
    await interaction.editReply(
      `Error - The character **${name}** could not be found on the rankings. Use \`override\` if the name is correct`
    );
  } catch (error) {
    console.error(`Error - /character ${label} could not reach the rankings:`, error?.message ?? error);
    await interaction.editReply(
      "Error - The rankings could not be reached right now. Try again shortly, or use `override`"
    );
  }
  return null;
}

const filterChoices = (names, focused) => {
  const value = String(focused).toLowerCase();
  return [...new Set(names.filter(Boolean))]
    .filter((name) => name.toLowerCase().includes(value))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 25);
};

// Names currently linked to somebody, for the autocomplete on every subcommand that edits one.
async function linkedNames(focused) {
  const docs = await culvertSchema.find({}, { "characters.name": 1 }).lean();
  return filterChoices(
    docs.flatMap((doc) => (doc.characters ?? []).map((character) => character.name)),
    focused
  );
}

// Characters unlinked recently enough that their snapshot still exists. Anything linked again since
// is left out: restore refuses those, so offering them was only ever a way to get an error.
async function restorableNames(focused) {
  const [entries, docs] = await Promise.all([
    actionLogSchema
      .find({ action: "Unlink Character", snapshot: { $ne: null } }, { target: 1 })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean(),
    culvertSchema.find({}, { "characters.name": 1 }).lean(),
  ]);

  const linked = new Set(
    docs.flatMap((doc) => (doc.characters ?? []).map((character) => character.name?.toLowerCase())).filter(Boolean)
  );

  return filterChoices(
    entries.map((entry) => entry.target).filter((name) => !linked.has(name?.toLowerCase())),
    focused
  );
}

// Who owns a character, with just that character projected out of their array. Written out in four
// places before, each one having to remember the positional projection.
const findOwner = (name) =>
  culvertSchema.findOne({ "characters.name": nameMatch(name) }, { "characters.$": 1 }).lean();

const isLinked = (name) => culvertSchema.exists({ "characters.name": nameMatch(name) });

const logAction = (fields) =>
  actionLogSchema
    .create({ ...fields, timestamp: new Date() })
    // Never block the operation itself on a failed log.
    .catch((error) => console.error("Error - Could not record the action:", error?.message ?? error));

// Anything that destroys, moves or reinstates data asks first, and says exactly what is about to
// happen. Cancel is always appended, so callers only describe the choices that go somewhere.
// Returns the chosen button id, or null if it was cancelled or timed out.
async function choose(interaction, content, buttons) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

  const row = new ActionRowBuilder().addComponents(
    ...buttons.map((button) =>
      new ButtonBuilder().setCustomId(button.id).setLabel(button.label).setStyle(button.style)
    ),
    new ButtonBuilder().setCustomId("char_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  );

  const message = await interaction.editReply({ content, components: [row] });
  const press = await message
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 30000,
    })
    .catch(() => null);

  if (!press || press.customId === "char_cancel") {
    await interaction.editReply({
      content: press ? "Cancelled, nothing was changed." : "Timed out, nothing was changed.",
      components: [],
    });
    return null;
  }

  await press.deferUpdate();
  return press.customId;
}

// The common case: one way forward, or cancel. Red by default because most of these take something
// away; restoring gives it back, so it gets green.
const confirm = async (interaction, content, label, style = ButtonStyle.Danger) =>
  (await choose(interaction, content, [{ id: "char_confirm", label, style }])) === "char_confirm";

// ⎯⎯ Week snapshots ⎯⎯ //

// A finalized week is served from its weekSchema snapshot rather than from the live characters, so an
// edit that only touches the character is invisible to /graph, the guild median and /weekly. Anything
// that changes a name or a score has to reach the snapshot too.
async function renameInWeeks(oldName, newName) {
  const result = await weekSchema.updateMany(
    { "scores.name": nameMatch(oldName) },
    { $set: { "scores.$[entry].name": newName } },
    { arrayFilters: [{ "entry.name": nameMatch(oldName) }] }
  );
  return result.modifiedCount ?? 0;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The most recent unlink that still has something worth putting back. An unlink of a character with no
// scores writes a snapshot too, and taking the newest blindly would let that empty one hide a richer
// one underneath it — which is exactly what happens when somebody is unlinked, relinked fresh, then
// unlinked again.
async function latestSnapshot(name) {
  const entries = await actionLogSchema
    .find({ action: "Unlink Character", target: nameMatch(name), snapshot: { $ne: null } })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  return entries.find((entry) => entry.snapshot?.character?.scores?.length) ?? entries[0] ?? null;
}

// Every score a name ever recorded in a finalized week. For someone who left and came back, or who was
// unlinked longer ago than a restore can reach, this is the only surviving record of their history:
// the character's own scores went with the character.
async function historyFromWeeks(name) {
  const weeks = await weekSchema
    .find({ finalized: true, "scores.name": nameMatch(name) }, { week: 1, scores: 1 })
    .lean();

  return weeks
    .map((record) => ({
      date: record.week,
      score: record.scores.find((entry) => entry.name?.toLowerCase() === name.toLowerCase())?.score,
    }))
    .filter((entry) => typeof entry.score === "number")
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function correctInWeek(week, name, score) {
  const record = await weekSchema.findOne({ week }, { scores: 1, submitted: 1 }).lean();
  if (!record) return false;

  const scores = (record.scores ?? []).map((entry) => ({ name: entry.name, score: entry.score }));
  const existing = scores.find((entry) => entry.name?.toLowerCase() === name.toLowerCase());
  if (existing) existing.score = score;
  else scores.push({ name, score });

  // Kept in the order finalize wrote it in.
  scores.sort((a, b) => b.score - a.score);

  // `submitted` is finalize's own count and its definition belongs to finalize, so it is only nudged
  // when this genuinely adds a scoring row that was not counted before. Editing an existing score
  // leaves it alone.
  const update = { scores };
  if (!existing && score > 0) update.submitted = (record.submitted ?? 0) + 1;

  // Written with an explicit update rather than save(), which cannot be trusted on a document that
  // was fetched with a projection.
  await weekSchema.updateOne({ week }, { $set: update });
  return true;
}

// ⎯⎯ link ⎯⎯ //

async function link(interaction) {
  const nameOption = interaction.options.getString("character");
  const userOption = interaction.options.getUser("discord_user");
  const memberSinceOption = interaction.options.getString("member_since");
  const override = interaction.options.getBoolean("override") ?? false;

  if (!VALID_NAME.test(nameOption)) {
    return interaction.reply(
      `Error - **${nameOption}** is not a valid character name. Names are 2-13 letters and numbers, nothing else`
    );
  }

  const joined = dayjs(memberSinceOption);
  if (!joined.isValid()) {
    return interaction.reply(
      `Error - The date **${memberSinceOption}** is not valid. Make sure that it is properly formatted (ex: April 28 2023 or 04-28-2023)`
    );
  }
  // A join date in the future or before the game existed quietly breaks every tenure calculation
  // that reads it later.
  if (joined.isAfter(dayjs())) {
    return interaction.reply(`Error - The date **${memberSinceOption}** is in the future`);
  }
  if (joined.isBefore(dayjs(GAME_LAUNCH))) {
    return interaction.reply(`Error - The date **${memberSinceOption}** is before MapleStory existed`);
  }

  const joinDate = joined.format("MMM DD, YYYY");

  // Deferred because the rankings lookup below is an external call to Nexon, and a slow one used to
  // outlive the three seconds Discord allows before the interaction is dropped.
  await interaction.deferReply();

  // Resolved first, so the duplicate check and the write both use the same name. Checking the typed
  // name and then inserting the ranked one meant a difference in casing slipped past the check.
  const resolvedName = await resolveName(interaction, nameOption, override, "link");
  if (!resolvedName) return;

  if (await isLinked(resolvedName)) {
    return interaction.editReply(`Error - The character **${resolvedName}** is already linked to a user`);
  }

  // Somebody who left and came back still has a history worth offering back rather than silently
  // throwing away. Two places hold it, and the unlink snapshot is the better one where it exists: it
  // keeps weeks that were never finalized, along with their join date and graph colour. Finalized week
  // snapshots are the fallback, and the only source once an unlink has aged past its 90 days.
  const archived = await latestSnapshot(resolvedName);
  const archivedScores = archived?.snapshot?.character?.scores ?? [];
  const history = archivedScores.length ? archivedScores : await historyFromWeeks(resolvedName);
  const source = archivedScores.length ? "archive" : "weeks";

  let character = { name: resolvedName, memberSince: joinDate, graphColor: "255,189,213", scores: [] };

  if (history.length) {
    const dates = history.map((entry) => entry.date).sort((a, b) => a.localeCompare(b));
    const span = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} and ${dates[dates.length - 1]}`;
    const pick = await choose(
      interaction,
      `**${resolvedName}** has history in the guild: ${plural(history.length, "scored week")} ` +
        `${dates.length === 1 ? "on" : "between"} ${span}.\n` +
        `-# From ${
          source === "archive"
            ? `an unlink on ${dayjs(archived.timestamp).format("MMM DD, YYYY")}`
            : "past finalized weeks"
        } · bring it back, or start them from scratch?`,
      [
        { id: "link_history", label: `Restore ${plural(history.length, "week")}`, style: ButtonStyle.Success },
        { id: "link_fresh", label: "Start fresh", style: ButtonStyle.Primary },
      ]
    );
    if (!pick) return;

    // The archive carries the whole character, so its own join date and colour come back with it.
    if (pick === "link_history") {
      character = archivedScores.length
        ? { ...archived.snapshot.character, name: resolvedName, memberSince: joinDate }
        : { ...character, scores: history };
    }
  }

  const scores = character.scores ?? [];

  await culvertSchema.findOneAndUpdate(
    { _id: userOption.id },
    { _id: userOption.id, $addToSet: { characters: character } },
    { upsert: true }
  );

  await logAction({
    action: "Link Character",
    target: userOption.username,
    details:
      `Linked character ${resolvedName} to user ${userOption.username} | User: ${userOption.username} | Character: ${resolvedName}` +
      (scores.length ? ` | Restored ${scores.length} week(s) of history` : ""),
    category: "create",
    actorId: String(interaction.user.id),
  });

  await interaction.editReply({
    content:
      `Linked **${resolvedName}** to ${userOption}${override ? " (override)" : ""}\nMember since: ${joinDate}` +
      (scores.length ? `\nRestored ${scores.length} week${scores.length === 1 ? "" : "s"} of past scores` : ""),
    components: [],
  });

  // Let the lab rat be tested on secretly...
  if (resolvedName.toLowerCase() === "druu") return;

  // Fetched rather than read off the cache, and guarded: an uncached channel used to throw here after
  // the link had already succeeded and been reported.
  const culvertChannel = await interaction.client.channels.fetch(CHANNELS.CULVERT).catch(() => null);
  if (!culvertChannel) return;

  await culvertChannel
    .send(
      `Welcome to Saku, ${userOption}! Your character **${resolvedName}** has just been linked to Saku's official discord bot.\n\nIn the ${culvertChannel} channel, you can view your culvert progression with various commands, such as \`/profile\` and \`/graph\`.\n\nSubmit your weekly scores with the \`/gpq\` command if you wish to view your stats early, otherwise they will be automatically submitted by the end of the week.\n\nTo learn more, use the \`/help\` command.`
    )
    .catch((error) => console.error("Error - Could not post the welcome message:", error?.message ?? error));
}

// ⎯⎯ unlink ⎯⎯ //

async function unlink(interaction) {
  const nameOption = interaction.options.getString("character");

  // One query instead of a separate existence check followed by a lookup: between the two, the owner
  // could come back undefined and the update then ran against no id at all.
  const owner = await findOwner(nameOption);

  if (!owner) {
    return interaction.reply(`Error - The character **${nameOption}** is not linked to any user`);
  }

  // Already a plain object: findOwner reads lean, so this goes into the snapshot as-is.
  const character = owner.characters[0];
  const scoreCount = character.scores?.length ?? 0;

  const proceed = await confirm(
    interaction,
    `Unlink **${character.name}** (<@${owner._id}>)?\n` +
      `-# Member since ${character.memberSince ?? "unknown"} · ${plural(scoreCount, "score")} will be ` +
      `deleted · restorable with \`/character restore\` for ${RESTORE_WINDOW_DAYS} days`,
    "Unlink"
  );
  if (!proceed) return;

  // Captured before anything is removed, so a mistake can be undone rather than merely regretted.
  const exceptions = await exceptionSchema.find({ name: nameMatch(character.name) }).lean();

  const updated = await culvertSchema.findByIdAndUpdate(
    owner._id,
    { $pull: { characters: { name: nameMatch(character.name) } } },
    { new: true }
  );

  // Delete the user document entirely if they have no more characters
  if (updated && updated.characters.length === 0) await culvertSchema.deleteOne({ _id: owner._id });

  // Remove any exceptions tied to this character name
  await exceptionSchema.deleteMany({ name: nameMatch(character.name) });

  await logAction({
    action: "Unlink Character",
    target: String(character.name),
    details: `Removed ${scoreCount} score(s) from ${character.name} (owner ${owner._id})`,
    category: "delete",
    actorId: String(interaction.user.id),
    snapshot: { ownerId: String(owner._id), character, exceptions },
  });

  await interaction.editReply({
    content: `Unlinked and removed all of **${character.name}** (<@${owner._id}>)'s scores from the database`,
    components: [],
  });
}

// ⎯⎯ restore ⎯⎯ //

async function restore(interaction) {
  const nameOption = interaction.options.getString("character");

  // The same picker link uses, so an unlink of an emptied character cannot shadow the richer one
  // underneath it here either.
  const entry = await latestSnapshot(nameOption);

  if (!entry?.snapshot?.character) {
    return interaction.reply(
      `Error - No restorable record of **${nameOption}**. Unlinks are only kept for ${RESTORE_WINDOW_DAYS} days, and anything unlinked before restore existed has no snapshot`
    );
  }

  const { ownerId, character, exceptions = [] } = entry.snapshot;

  if (await isLinked(character.name)) {
    return interaction.reply(`Error - **${character.name}** is already linked, so there is nothing to restore`);
  }

  const scoreCount = character.scores?.length ?? 0;
  const when = dayjs(entry.timestamp).format("MMM DD, YYYY");

  const proceed = await confirm(
    interaction,
    `Restore **${character.name}** to <@${ownerId}>?\n` +
      `-# Unlinked ${when} · ${plural(scoreCount, "score")}, member since ${
        character.memberSince ?? "unknown"
      }${exceptions.length ? ` · ${exceptions.length} scan exception(s)` : ""}`,
    "Restore",
    ButtonStyle.Success
  );
  if (!proceed) return;

  await culvertSchema.findOneAndUpdate(
    { _id: ownerId },
    { _id: ownerId, $addToSet: { characters: character } },
    { upsert: true }
  );

  // The exceptions went with the character, so they come back with it.
  for (const exception of exceptions) {
    await exceptionSchema
      .findOneAndUpdate(
        { name: exception.name, exception: exception.exception },
        { name: exception.name, exception: exception.exception },
        { upsert: true }
      )
      .catch(() => {});
  }

  await logAction({
    action: "Restore Character",
    target: String(character.name),
    details: `Restored ${character.name} to ${ownerId} with ${scoreCount} score(s), unlinked ${when}`,
    category: "create",
    actorId: String(interaction.user.id),
  });

  await interaction.editReply({
    content: `Restored **${character.name}** to <@${ownerId}> with ${plural(scoreCount, "score")}`,
    components: [],
  });
}

// ⎯⎯ rename ⎯⎯ //

async function rename(interaction) {
  const oldNameOption = interaction.options.getString("old_name");
  const newNameOption = interaction.options.getString("new_name");
  const override = interaction.options.getBoolean("override") ?? false;

  if (!VALID_NAME.test(newNameOption)) {
    return interaction.reply(
      `Error - **${newNameOption}** is not a valid character name. Names are 2-13 letters and numbers, nothing else`
    );
  }

  // One lookup, reused for the existence check, the cased name and the update. This used to be three
  // separate queries all matching the same character.
  const owner = await findOwner(oldNameOption);
  if (!owner) {
    return interaction.reply(`Error - The character **${oldNameOption}** is not linked to any user`);
  }
  const oldName = owner.characters[0].name;

  // Renaming a character to the name it already has matched the "already linked" check against itself
  // and then reported a successful rename that changed nothing.
  if (oldName === newNameOption) {
    return interaction.reply(`Error - **${oldName}** is already their name`);
  }

  // Somebody else holding the name is a conflict; the character holding its own name is not, which is
  // what makes a capitalisation fix possible.
  const taken = await findOwner(newNameOption);
  if (taken && taken.characters[0].name.toLowerCase() !== oldName.toLowerCase()) {
    return interaction.reply(`Error - The character **${newNameOption}** is already linked to a user`);
  }

  await interaction.deferReply();

  const resolvedName = await resolveName(interaction, newNameOption, override, "rename");
  if (!resolvedName) return;

  // Checked again after resolving, not just against what was typed. Renaming Druu to "druu" gets the
  // real capitalisation back from the rankings, which lands on the name it already had — so the write
  // changed nothing and it still announced a successful rename.
  if (resolvedName === oldName) {
    return interaction.editReply(`Error - **${oldName}** is already their name`);
  }

  await culvertSchema.findOneAndUpdate(
    { "characters.name": nameMatch(oldName) },
    { $set: { "characters.$.name": resolvedName } }
  );

  // The scan exceptions and the finalized week snapshots both point at the old name, so they follow
  // it. Without the snapshots, every week before the rename keeps the dead name and /scan reports the
  // character as renamed or unlinked against its own history.
  await exceptionSchema.updateMany({ name: nameMatch(oldName) }, { $set: { name: resolvedName } });
  const weeksTouched = await renameInWeeks(oldName, resolvedName);

  await logAction({
    action: "Rename Character",
    target: String(oldName),
    details: `Renamed from ${oldName} to ${resolvedName} | ${weeksTouched} week snapshot(s) updated`,
    category: "rename",
    actorId: String(interaction.user.id),
  });

  await interaction.editReply(
    `${oldName}'s name has been changed to **${resolvedName}**${override ? " (override)" : ""}`
  );
}

// ⎯⎯ changeid ⎯⎯ //

async function changeid(interaction) {
  const oldUser = interaction.options.getUser("old_user");
  const newUser = interaction.options.getUser("new_user");

  if (oldUser.id === newUser.id) {
    return interaction.reply("Error - Those are the same user");
  }

  const [oldCulvert, oldLevels] = await Promise.all([
    culvertSchema.findById(oldUser.id).lean(),
    userSchema.findById(oldUser.id).lean(),
  ]);

  if (!oldCulvert && !oldLevels) {
    return interaction.reply(`Error - The user **${oldUser.username}** does not have any data to move`);
  }

  if (oldCulvert && (await culvertSchema.exists({ _id: newUser.id }))) {
    return interaction.reply(
      `Error - The user **${newUser.username}** already has culvert data. Please unlink their characters first or choose a different user.`
    );
  }

  // Everything that keys off a Discord id, not just the culvert record. Moving only the culvert data
  // meant somebody who remade their account silently lost their level, EXP, birthday and every
  // starboard post they had ever made.
  const [authored, given] = await Promise.all([
    starboardSchema.countDocuments({ authorId: oldUser.id }),
    starboardSchema.countDocuments({ starrers: oldUser.id }),
  ]);
  const characters = (oldCulvert?.characters ?? []).map((character) => character.name);

  const moving = [
    characters.length ? `${characters.length} character(s): ${characters.join(", ")}` : null,
    oldLevels ? `level ${oldLevels.level} (${oldLevels.exp} EXP)` : null,
    authored ? `${authored} starboard post(s)` : null,
    given ? `${given} star(s) given` : null,
  ].filter(Boolean);

  const proceed = await confirm(
    interaction,
    `Move all of **${oldUser.username}**'s data to **${newUser.username}**?\n` +
      moving.map((line) => `-# · ${line}`).join("\n") +
      `\n-# ${oldUser.username}'s own records are deleted afterwards.`,
    "Move data"
  );
  if (!proceed) return;

  // Written before anything is touched, so a failure part way through still leaves a complete copy of
  // what was there rather than an unrecoverable half-move.
  await logAction({
    action: "Transfer Account",
    target: String(oldUser.username),
    details: `Moving data from ${oldUser.id} to ${newUser.id}: ${moving.join(" | ") || "nothing"}`,
    category: "transfer",
    actorId: String(interaction.user.id),
    snapshot: { from: oldUser.id, to: newUser.id, culvert: oldCulvert, levels: oldLevels },
  });

  try {
    if (oldCulvert) {
      // Inserted through the driver rather than the model so optional fields that were never set on
      // the old document do not get filled in with defaults on the new one.
      await culvertSchema.collection.insertOne({ ...oldCulvert, _id: newUser.id });
      try {
        await culvertSchema.findByIdAndDelete(oldUser.id);
      } catch (error) {
        // Compensating action: the copy exists but the original could not be removed, which would
        // leave the same characters linked to two accounts. Undo the copy rather than allow that.
        await culvertSchema.collection.deleteOne({ _id: newUser.id }).catch(() => {});
        throw error;
      }
    }

    if (oldLevels) {
      const { _id, ...levels } = oldLevels;
      await userSchema.findOneAndUpdate({ _id: newUser.id }, { _id: newUser.id, ...levels }, { upsert: true });
      await userSchema.findByIdAndDelete(oldUser.id);
    }

    if (authored) await starboardSchema.updateMany({ authorId: oldUser.id }, { $set: { authorId: newUser.id } });
    if (given) await starboardSchema.updateMany({ starrers: oldUser.id }, { $set: { "starrers.$": newUser.id } });

    for (const name of characters) {
      await logAction({
        action: "Transfer Character",
        target: String(name),
        details: `Owner updated from ${oldUser.username} to ${newUser.username}`,
        category: "transfer",
        actorId: String(interaction.user.id),
      });
    }

    await interaction.editReply({
      content:
        `Moved **${oldUser.username}**'s data to **${newUser.username}**\n` +
        moving.map((line) => `-# · ${line}`).join("\n"),
      components: [],
    });
  } catch (error) {
    console.error("Error - Could not change user ID:", error);
    await interaction.editReply({
      content:
        `Error - The move failed part way through. Nothing was lost: a full copy of **${oldUser.username}**'s data ` +
        "was written to the action log before anything was touched, so it can be put back by hand.",
      components: [],
    });
  }
}

// ⎯⎯ correct ⎯⎯ //

async function correct(interaction) {
  const nameOption = interaction.options.getString("character");
  const dateOption = interaction.options.getString("date");
  const weekOption = interaction.options.getString("week");
  const scoreOption = interaction.options.getInteger("score");

  if (!dateOption && !weekOption) {
    return interaction.reply("Error - Pick a `week`, or give an exact `date`");
  }
  if (dateOption && weekOption) {
    return interaction.reply("Error - Pick either a `week` or a `date`, not both");
  }

  // Choosing the week saves working out which Wednesday it was, which is where most of the
  // "must be a Wednesday" errors came from.
  const { reset, lastReset } = getResetDates();
  const date = weekOption === "this_week" ? reset : weekOption === "last_week" ? lastReset : dateOption;

  if (dateOption) {
    // Check if the date is valid (formatted properly)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOption)) {
      return interaction.reply(
        `Error - The date **${dateOption}** is not valid. Make sure that it follows the 'YYYY-MM-DD' format`
      );
    }

    // Check if the date is valid (lands on a Wednesday)
    if (dayjs(dateOption).day() !== 3) {
      return interaction.reply(
        `Error - The date **${dateOption}** is not valid. Make sure that the day lands on a Wednesday`
      );
    }

    // A week that has not happened yet cannot have a score in it.
    if (dayjs(dateOption).isAfter(dayjs(reset))) {
      return interaction.reply(`Error - The week of **${dateOption}** hasn't happened yet`);
    }
  }

  // One lookup. `findCharacter` already returns the character with its real capitalisation on it, so
  // the separate `getCasedName` call was fetching the same document a second time for a field that was
  // already in hand.
  const owner = await findOwner(nameOption);
  if (!owner) {
    return interaction.reply(`Error - The character **${nameOption}** is not linked to any user`);
  }

  const character = owner.characters[0];
  const characterNameCased = character.name;
  const existing = character.scores?.find((score) => score.date === date);

  if (existing) {
    await culvertSchema.updateOne(
      { "characters.name": nameMatch(nameOption) },
      { $set: { "characters.$[nameElem].scores.$[dateElem].score": scoreOption } },
      { arrayFilters: [{ "nameElem.name": nameMatch(nameOption) }, { "dateElem.date": date }] }
    );
  } else {
    // $addToSet compared whole objects, so the same week could be inserted twice with two different
    // scores. There is only ever one score per week, so it is pushed once and set thereafter.
    await culvertSchema.updateOne(
      { "characters.name": nameMatch(nameOption) },
      { $push: { "characters.$[nameElem].scores": { score: scoreOption, date } } },
      { arrayFilters: [{ "nameElem.name": nameMatch(nameOption) }] }
    );
  }

  // A finalized week is served from its snapshot, so an edit that stops at the character never shows
  // up in /graph, the guild median or /weekly. Done quietly: it is part of correcting a score, not a
  // separate thing worth reporting.
  await correctInWeek(date, characterNameCased, scoreOption);

  await logAction({
    action: existing ? "Edit Score" : "Create Score",
    target: String(characterNameCased),
    details: existing
      ? `Score updated from ${Number(existing.score)} to ${scoreOption} for ${date}`
      : `Date: ${date} | Score: ${scoreOption}`,
    category: existing ? "edit" : "create",
    actorId: String(interaction.user.id),
  });

  await interaction.reply(
    existing
      ? `${characterNameCased}'s score has been updated to **${scoreOption}** for the week of ${date}`
      : `${characterNameCased}'s score of **${scoreOption}** has been created for the week of ${date}`
  );
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const SUBCOMMANDS = { link, unlink, restore, rename, changeid, correct };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("character")
    .setDescription("[BEE] Manage the culvert roster")
    .addSubcommand((sub) =>
      sub
        .setName("link")
        .setDescription("[BEE] Link a character to a Discord ID")
        .addStringOption((option) =>
          option.setName("character").setDescription("The character to be linked").setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("discord_user")
            .setDescription("The Discord user to be paired with the character")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("member_since")
            .setDescription("The date that the character joined the guild")
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option.setName("override").setDescription("Force link the character, even if not present on rankings")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlink")
        .setDescription("[BEE] Unlink and remove a character from the database")
        .addStringOption((option) =>
          option
            .setName("character")
            .setDescription("The character to be unlinked")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("restore")
        .setDescription("[BEE] Put back a character that was unlinked in the last 90 days")
        .addStringOption((option) =>
          option
            .setName("character")
            .setDescription("The character to restore")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("[BEE] Rename a character")
        .addStringOption((option) =>
          option
            .setName("old_name")
            .setDescription("The character to be renamed")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option.setName("new_name").setDescription("The new name to set for this character").setRequired(true)
        )
        .addBooleanOption((option) =>
          option.setName("override").setDescription("Force rename the character, even if not present on rankings")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("changeid")
        .setDescription("[BEE] Move a user's culvert, level and starboard data to another Discord account")
        .addUserOption((option) =>
          option.setName("old_user").setDescription("The current Discord user to change ID from").setRequired(true)
        )
        .addUserOption((option) =>
          option.setName("new_user").setDescription("The new Discord user to transfer data to").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("correct")
        .setDescription("[BEE] Edit or create a new score for a character")
        .addStringOption((option) =>
          option
            .setName("character")
            .setDescription("The character to be corrected")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("score")
            .setDescription("The new score to submit")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(MAX_SCORE)
        )
        .addStringOption((option) =>
          option
            .setName("week")
            .setDescription("Which week to correct, if it's a recent one")
            .addChoices({ name: "This week", value: "this_week" }, { name: "Last week", value: "last_week" })
        )
        .addStringOption((option) =>
          option.setName("date").setDescription("An exact week instead (YYYY-MM-DD, must be a Wednesday)")
        )
    ),

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  // Every subcommand that names an existing character offers them, so nobody types one from memory.
  // Restore reads the unlink log instead, since by then the character is gone from the roster.
  async autocomplete(interaction) {
    const names =
      interaction.options.getSubcommand() === "restore"
        ? await restorableNames(interaction.options.getFocused())
        : await linkedNames(interaction.options.getFocused());
    await interaction.respond(names.map((name) => ({ name, value: name }))).catch(() => {});
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      return await SUBCOMMANDS[sub](interaction);
    } catch (error) {
      console.error(`Error - /character ${sub} failed:`, error);
      const notice = { content: `Error - Could not complete \`/character ${sub}\``, flags: MessageFlags.Ephemeral };
      await (interaction.deferred || interaction.replied
        ? interaction.followUp(notice)
        : interaction.reply(notice)
      ).catch(() => {});
    }
  },
};
