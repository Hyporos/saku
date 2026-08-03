const { EmbedBuilder } = require("discord.js");
const starboardSchema = require("../schemas/starboardSchema.js");
const { CHANNELS, EMOJI_IDS, EMOJIS, isUnicodeStar } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Everything the starboard does, in one place. Adding a star, removing one, deleting the original and
// the startup catch-up all end up in syncStarboard, so a count can never be produced two different
// ways: the remove handler used to report reaction.count, which INCLUDES the author and any bots, so
// taking a star off a message could make its number go UP.

const STAR_EMOJI_ID = EMOJI_IDS.STAR;
const STAR_EMOJI = EMOJIS.STAR;
const STARBOARD_CHANNEL_ID = CHANNELS.STARBOARD;

// Stars needed to reach the board. The removal floor sits lower on purpose: with a single number, a
// message resting exactly on the threshold would be deleted and reposted every time one person
// toggled their star, and each repost pings the channel again. Two clear votes have to come off.
const THRESHOLD = 10;
const UNPOST_BELOW = 8;

// Discord's embed description limit is 4096; leave room for the attachment note and the jump link.
const DESCRIPTION_CAP = 3600;
const IMAGE_RE = /https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?/i;
const isImageAttachment = (a) => (a.contentType ?? "").startsWith("image/") || IMAGE_RE.test(a.url);

// A reaction is a star if it is the guild emote or any of the unicode stars the board has used.
const isStarReaction = (r) => isStarEmoji(r.emoji);
const isStarEmoji = (emoji) => emoji?.id === STAR_EMOJI_ID || (!emoji?.id && isUnicodeStar(emoji?.name));

// One place that knows the shape of a Discord message link, because three did: the embed built one,
// the catch-up parsed one back apart, and the command built its own from stored ids.
const messageUrl = (guildId, channelId, messageId) => `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;

// displayName covers the server nickname AND the global display name; reading .nickname alone fell
// through to the raw username for anyone who had never set a per-server nick.
const displayNameOf = (message, fallback = null) =>
  message.member?.displayName ?? message.author?.displayName ?? message.author?.username ?? fallback;

// channels/<guild>/<channel>/<message> out of a jump link, for reading a post back apart.
const JUMP_RE = /channels\/\d+\/(\d+)\/(\d+)/;

/**
 * Which original message a starboard post is about.
 *
 * The id used to be printed in the footer purely so this could find it, which is why every post made
 * before now still carries it there. It is also the last segment of the jump link in the description,
 * so the footer no longer has to spend itself on it. Both are read, and the footer is tried first, so
 * a channel holding a mix of old and new posts still adopts cleanly on boot.
 *
 * @param {Object} post - A message from the starboard channel.
 * @returns {string|null} The original message id, or null if this post isn't one of ours.
 */
function originalIdOf(post) {
  const footer = post.embeds?.[0]?.footer?.text?.split(" ")[0];
  if (/^\d{17,20}$/.test(footer ?? "")) return footer;
  return post.embeds?.[0]?.description?.match(JUMP_RE)?.[2] ?? null;
}

/**
 * Fills in a reaction that arrived partial, which most do: a star is usually added to, or taken off,
 * a message far older than the cache keeps. Reading emoji or guild straight off a partial payload is
 * what used to throw in the remove handler and silently stop the count updating.
 *
 * @param {Object} reaction - The raw reaction from the gateway event.
 * @returns {Promise<boolean>} false when the message is gone and there is nothing left to work with.
 */
async function fetchFullReaction(reaction) {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    return true;
  } catch {
    return false;
  }
}

// One sync at a time per message. Two people starring within the same moment produced two handlers
// that both looked up an empty cache and both posted, which is the other half of how duplicates got
// into the channel.
const inFlight = new Set();

// ⎯⎯ What can be starred ⎯⎯ //

// The board is a record of what the guild reacted to at the time, so stars close after a month.
// Without a window, anyone can trawl a year of history and vote up their own favourites long after
// the moment passed, which is a different thing from the channel reacting to something.
const STAR_WINDOW_DAYS = 30;
const STAR_WINDOW_MS = STAR_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// How long the "you can't do that" notice stays up. Long enough to read, short enough that a busy
// channel isn't left with a trail of them.
const NOTICE_MS = 12_000;

/**
 * Why this star can't land, or null if it can.
 *
 * The author rule already existed in a quieter form: starrersOf drops the author from the count, so
 * self-stars never counted, but the reaction sat there looking like it had worked. Saying so and
 * taking it back off is the same rule, just visible.
 *
 * @param {Object} message - The message being starred.
 * @param {string} userId - Who is trying to star it.
 * @returns {string|null} A sentence to tell them, or null when the star is fine.
 */
function starRejection(message, userId) {
  if (message.author?.id === userId) return "you can't star your own post.";
  if (Date.now() - message.createdTimestamp > STAR_WINDOW_MS) {
    return `that post is over ${STAR_WINDOW_DAYS} days old, so it's closed to new stars.`;
  }
  return null;
}

/**
 * Takes the star back off and says why.
 *
 * Told in the channel rather than a DM: plenty of people have DMs closed, so a DM would fail
 * silently and the removal would just read as the bot being broken. The notice deletes itself.
 *
 * @param {Object} reaction - The reaction that was added.
 * @param {Object} user - Who added it.
 * @param {string} why - The reason from starRejection.
 */
async function rejectStar(reaction, user, why) {
  await reaction.users.remove(user.id).catch(() => {});
  const notice = await reaction.message.channel
    .send({ content: `<@${user.id}> ${why}`, allowedMentions: { users: [user.id] } })
    .catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), NOTICE_MS);
}

// ⎯⎯ Counting ⎯⎯ //

// Who actually starred it, author and bots removed. Returns the ids rather than a bare number so
// the count and the record of who gave it can never disagree. Paginated because reactors come back
// 100 at a time and a popular message goes past that, which silently pinned the count at 100.
async function starrersOf(message) {
  // Both stars are counted and unioned by user id, so someone who used one of each is still one
  // person. Hundreds of older posts were earned entirely on the unicode star.
  const reactions = [...message.reactions.cache.values()].filter(isStarReaction);
  if (!reactions.length) return [];

  const seen = new Set();
  for (const reaction of reactions) {
    let after;
    for (let page = 0; page < 10; page++) {
      const batch = await reaction.users.fetch({ limit: 100, ...(after ? { after } : {}) });
      if (!batch.size) break;
      for (const user of batch.values()) {
        if (user.bot || user.id === message.author?.id) continue;
        seen.add(user.id);
      }
      if (batch.size < 100) break;
      after = batch.lastKey();
    }
  }
  return [...seen];
}

const countStars = async (message) => (await starrersOf(message)).length;

// What the message looked like at this moment, kept so the board still has a record once Discord's
// copy is edited or deleted.
const snapshot = (message) => ({
  content: message.content ?? "",
  attachments: [...message.attachments.values()].map((a) => ({ url: a.url, name: a.name, isImage: isImageAttachment(a) })),
});

// ⎯⎯ Rendering ⎯⎯ //

function buildEmbed(message, existing = null) {
  const images = [...message.attachments.values()].filter(isImageAttachment);
  const others = [...message.attachments.values()].filter((a) => !isImageAttachment(a));

  let body = (message.content ?? "").trim();
  if (body.length > DESCRIPTION_CAP) body = `${body.slice(0, DESCRIPTION_CAP)}...`;

  const notes = [];
  // Only the first image can be shown, so say plainly that there are more rather than hiding them.
  if (images.length > 1) notes.push(`*and ${images.length - 1} more image${images.length === 2 ? "" : "s"}*`);
  for (const a of others.slice(0, 3)) notes.push(`**Attachment:** [${a.name}](${a.url})`);
  if (others.length > 3) notes.push(`*and ${others.length - 3} more attachment${others.length === 4 ? "" : "s"}*`);

  // Said out loud rather than swapped in silently. The board is a record of what people starred, so
  // an author quietly rewriting it afterwards is exactly the thing worth surfacing.
  if (existing?.editedAt) notes.push(`-# *edited after it reached the starboard*`);

  const jump = `[Jump to message](${messageUrl(message.guildId, message.channelId, message.id)})`;
  const description = [body, notes.join("\n"), jump].filter(Boolean).join("\n\n");

  const embed = new EmbedBuilder()
    .setAuthor({
      name: displayNameOf(message, "unknown"),
      iconURL: message.author?.displayAvatarURL?.() ?? undefined,
    })
    .setColor(0xffc3c5)
    .setDescription(description)
    // A real timestamp renders the date and time in each viewer's own timezone. The old footer baked
    // in whatever timezone the bot host happened to be in, which was never anyone's, and later spent
    // itself printing the message id; originalIdOf reads that off the jump link instead.
    .setTimestamp(message.createdAt);

  const first = images[0]?.url ?? message.content?.match(IMAGE_RE)?.[0];
  if (first) embed.setImage(first);
  return embed;
}

const header = (count, channelId) => `${STAR_EMOJI} **${count}** <#${channelId}>`;

// ⎯⎯ The one path everything goes through ⎯⎯ //

// Re-counts the message and makes the starboard match: posts it, edits it, or takes it down. Safe to
// call for any message and any reason, including for one that was never on the board.
// allowRemoval is off for the startup sweep on purpose. Taking a post down is the right answer when
// somebody just removed a star in front of us, but doing it in bulk on boot, off a partial scan of
// history, risks deleting a chunk of the channel over a miscount nobody asked us to act on.
async function syncStarboard(message, { reason = "reaction", allowRemoval = true } = {}) {
  if (!message?.guild || message.channelId === STARBOARD_CHANNEL_ID) return;
  if (inFlight.has(message.id)) return;
  inFlight.add(message.id);

  try {
    const board = message.guild.channels.cache.get(STARBOARD_CHANNEL_ID);
    if (!board) return;

    const existing = await starboardSchema.findById(message.id).lean();
    const starrers = await starrersOf(message);
    const count = starrers.length;

    // Never posted and still short of the bar: nothing to do.
    if (!existing && count < THRESHOLD) return;

    if (existing) {
      if (count < UNPOST_BELOW) {
        if (!allowRemoval) {
          console.warn(`Starboard: ${message.id} is down to ${count} stars but removal is off for ${reason}, leaving it up`);
          return;
        }
        await board.messages.delete(existing.starboardId).catch(() => {});
        await starboardSchema.findByIdAndDelete(message.id);
        console.log(`Starboard: removed ${message.id}, down to ${count} stars (${reason})`);
        return;
      }
      if (count === existing.count) return; // nothing moved, don't spend an edit

      const post = await board.messages.fetch(existing.starboardId).catch(() => null);
      if (!post) {
        // Someone deleted the starboard post by hand. Forget it rather than editing a ghost forever,
        // and let it be posted fresh if it is still above the bar.
        await starboardSchema.findByIdAndDelete(message.id);
        if (count >= THRESHOLD) await syncStarboardFresh(message, board, starrers, reason);
        return;
      }
      await post.edit({ content: header(count, message.channelId), embeds: [buildEmbed(message, existing)] });
      await starboardSchema.findByIdAndUpdate(message.id, {
        $set: { count, starrers, updatedAt: new Date() },
        // peakCount only ever climbs, so a post that has since lost stars still records what it did.
        $max: { peakCount: count },
      });
      return;
    }

    await syncStarboardFresh(message, board, starrers, reason);
  } catch (err) {
    console.error(`Error - Starboard sync failed for ${message?.id}:`, err?.message ?? err);
  } finally {
    inFlight.delete(message.id);
  }
}

async function syncStarboardFresh(message, board, starrers, reason) {
  const count = starrers.length;
  const post = await board.send({ content: header(count, message.channelId), embeds: [buildEmbed(message)] });
  await starboardSchema.findByIdAndUpdate(
    message.id,
    {
      $set: {
        starboardId: post.id,
        channelId: message.channelId,
        authorId: message.author?.id ?? null,
        // Stored alongside the id so the board can name people who have since left the server,
        // where a mention would render as "@unknown-user" or a bare id.
        authorName: displayNameOf(message),
        count,
        starrers,
        updatedAt: new Date(),
        // Captured here, at the moment it earned its place, rather than read back from Discord later.
        ...snapshot(message),
      },
      $max: { peakCount: count },
      $setOnInsert: { starredAt: new Date() },
    },
    { upsert: true }
  );
  console.log(`Starboard: posted ${message.id} with ${count} stars (${reason})`);
}

// An edit to a message that is already on the board. The post is refreshed so the board is not
// showing text that no longer exists, and the change is recorded so the embed can admit to it.
async function trackEdit(message) {
  const entry = await starboardSchema.findById(message.id).lean().catch(() => null);
  if (!entry) return;
  if ((message.content ?? "") === (entry.content ?? "")) return; // an embed loading is not an edit

  await starboardSchema.findByIdAndUpdate(message.id, { $set: { editedAt: new Date(), updatedAt: new Date() } });
  const board = message.guild?.channels?.cache?.get(STARBOARD_CHANNEL_ID);
  const post = await board?.messages?.fetch(entry.starboardId).catch(() => null);
  if (!post) return;
  await post
    .edit({ content: header(entry.count, entry.channelId), embeds: [buildEmbed(message, { ...entry, editedAt: new Date() })] })
    .catch(() => {});
  console.log(`Starboard: ${message.id} was edited after being starred, post refreshed`);
}

// The original being deleted leaves a starboard post pointing at nothing, so take it down with it.
async function forgetStarred(messageId, client) {
  const entry = await starboardSchema.findById(messageId).lean().catch(() => null);
  if (!entry) return;
  const board = client.channels.cache.get(STARBOARD_CHANNEL_ID);
  await board?.messages?.delete(entry.starboardId).catch(() => {});
  await starboardSchema.findByIdAndDelete(messageId).catch(() => {});
  console.log(`Starboard: original ${messageId} was deleted, took its post down too`);
}

// ⎯⎯ Startup catch-up ⎯⎯ //

// Reaction events only arrive while the bot is connected, so anything starred during downtime is
// invisible: a message that crossed ten stars while Saku was off never got posted, and one that
// gained stars kept whatever number it had when the process died. This walks recent history once on
// boot and makes the board tell the truth again.
//
// Cheap by design. A channel's last hundred messages arrive in ONE request carrying their reaction
// counts, so only the handful already at or near the bar need a precise per-user count.
async function reconcileStarboard(client, { lookbackMessages = 100 } = {}) {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    const board = guild.channels.cache.get(STARBOARD_CHANNEL_ID);
    if (!board) return;

    // Adopt what is already in the channel, so a restart cannot post a second copy of anything.
    const known = new Set((await starboardSchema.find({}, { _id: 1 }).lean()).map((d) => d._id));
    const posts = await board.messages.fetch({ limit: 100 }).catch(() => null);
    let adopted = 0;
    const seenOriginals = new Map();
    for (const post of [...(posts?.values() ?? [])].reverse()) {
      const originalId = originalIdOf(post);
      if (!originalId) continue;
      if (seenOriginals.has(originalId)) {
        console.warn(`Starboard: ${originalId} appears twice in the channel (posts ${seenOriginals.get(originalId)} and ${post.id}), left alone for a human to pick`);
        continue;
      }
      seenOriginals.set(originalId, post.id);
      if (known.has(originalId)) continue;
      const jump = post.embeds?.[0]?.description?.match(JUMP_RE);
      const count = Number(post.content?.match(/\*\*(\d+)\*\*/)?.[1] ?? 0);
      await starboardSchema.findByIdAndUpdate(
        originalId,
        { $set: { starboardId: post.id, channelId: jump?.[1] ?? post.channelId, count }, $setOnInsert: { starredAt: post.createdAt } },
        { upsert: true }
      );
      adopted++;
    }

    // Now sweep live channels for stars that landed while nobody was listening.
    const channels = [...guild.channels.cache.values()].filter(
      (c) => c.isTextBased?.() && !c.isThread?.() && c.id !== STARBOARD_CHANNEL_ID && c.viewable
    );
    let checked = 0;
    let changed = 0;
    for (const channel of channels) {
      const recent = await channel.messages.fetch({ limit: lookbackMessages }).catch(() => null);
      if (!recent) continue;
      for (const message of recent.values()) {
        const star = [...message.reactions.cache.values()].filter(isStarReaction).sort((a, b) => b.count - a.count)[0];
        // The raw count includes the author, so anything at threshold-1 is worth a precise look.
        if (!star || star.count < THRESHOLD - 1) continue;
        checked++;
        const before = await starboardSchema.findById(message.id).lean();
        await syncStarboard(message, { reason: "startup catch-up", allowRemoval: false });
        const after = await starboardSchema.findById(message.id).lean();
        if (before?.count !== after?.count) changed++;
        await new Promise((r) => setTimeout(r, 250)); // gentle on the reaction endpoints
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`Starboard catch-up: adopted ${adopted} existing posts, checked ${checked} starred messages, corrected ${changed}`);
  } catch (err) {
    console.error("Error - Starboard catch-up failed:", err?.message ?? err);
  }
}

module.exports = {
  syncStarboard,
  forgetStarred,
  trackEdit,
  reconcileStarboard,
  starrersOf,
  snapshot,
  isStarEmoji,
  fetchFullReaction,
  originalIdOf,
  starRejection,
  rejectStar,
  messageUrl,
  STARBOARD_CHANNEL_ID,
  STAR_EMOJI,
  THRESHOLD,
  // Only the tests reach for these; nothing in the bot does.
  countStars,
  STAR_EMOJI_ID,
};
