require("dotenv").config();
const mongoose = require("mongoose");
const starboardSchema = require("../src/schemas/starboardSchema.js");
const { GUILD_ID, CHANNELS, EMOJI_IDS, isUnicodeStar } = require("../src/config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Walks the guild's entire message history and finds everything that ever earned enough stars.
//
// The starboard only ever knew about reactions that arrived while the bot was connected, and its
// memory of what it had already posted died with the process. Years of restarts mean there is a
// backlog: messages that crossed the threshold during downtime and were never posted at all, and
// posted ones whose row was never written.
//
// Reads only, unless you ask otherwise:
//   node scripts/starboardBackfill.js                  report what it finds, change nothing
//   node scripts/starboardBackfill.js --adopt          write rows for posts already in the channel
//   node scripts/starboardBackfill.js --post           also post the ones that were missed
//   node scripts/starboardBackfill.js --days 90        only look this far back (default: everything)
//   node scripts/starboardBackfill.js --channel <id>   restrict to one channel

const { Client, GatewayIntentBits, Partials } = require("discord.js");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const ADOPT = flag("adopt") || flag("post") || flag("snapshots") || flag("repair") || flag("starrers");
const POST = flag("post");
// Snapshot recovery is worth running on its own: it is the slowest part and the only one that has to
// reach messages years old, so it is the part most likely to need a second attempt.
const SNAPSHOTS_ONLY = flag("snapshots") || flag("repair") || flag("starrers");
// Recovers who starred each post, and locates originals whose channel was never recorded.
const STARRERS = flag("starrers");
// Re-reads every starboard post and fills in whatever a row is missing. Needed once because the
// first adoption pass could not read the author or the source channel off a post.
const REPAIR = flag("repair");
const DAYS = Number(value("days", 0)) || null;
const ONLY_CHANNEL = value("channel", null);
const THRESHOLD = Number(value("threshold", 10));

// Discord's own rate limits are the real constraint here, not us. A page of 100 messages is one
// request; only messages actually carrying stars cost a second one.
const PAGE_PAUSE_MS = 350;
const REACTION_PAUSE_MS = 300;
const POST_PAUSE_MS = 1200;

const cutoff = DAYS ? Date.now() - DAYS * 24 * 60 * 60 * 1000 : null;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel],
  });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise((r) => client.once("clientReady", r));

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();
  const board = await guild.channels.fetch(CHANNELS.STARBOARD);
  const { syncStarboard, starrersOf, snapshot, originalIdOf } = require("../src/utility/starboard.js");

  console.log(`Mode: ${POST ? "POST missing + adopt" : ADOPT ? "ADOPT existing only" : "DRY RUN (nothing will be written)"}`);
  console.log(`Threshold: ${THRESHOLD} stars${DAYS ? ` · last ${DAYS} days` : " · all history"}\n`);

  // ⎯⎯ 1. Adopt what is already in the starboard channel ⎯⎯
  const knownOriginals = new Set((await starboardSchema.find({}, { _id: 1 }).lean()).map((d) => d._id));
  const inChannel = new Map();
  let before = null;
  let scannedPosts = 0;
  for (;;) {
    const batch = await board.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    for (const post of batch.values()) {
      scannedPosts++;
      const originalId = originalIdOf(post);
      if (!originalId) continue;
      // Oldest wins: if the channel holds two copies, the first one posted is the real entry.
      inChannel.set(originalId, post);
    }
    before = batch.last().id;
    await new Promise((r) => setTimeout(r, PAGE_PAUSE_MS));
  }
  console.log(`Starboard channel: ${scannedPosts} posts, ${inChannel.size} with a readable original id`);

  // Everything an old post can still tell us about the message it was made from. The author is the
  // valuable part: their id is embedded in the avatar url, which is the only place it survives once
  // the original message is out of reach.
  function readPost(post) {
    const embed = post.embeds?.[0];
    if (!embed) return null;
    const icon = embed.author?.iconURL ?? embed.author?.icon_url ?? "";
    const jump = embed.description?.match(/channels\/\d+\/(\d+)\/\d+/);
    const content = (embed.description ?? "")
      .replace(/\[Jump to message\]\([^)]*\)/g, "")
      .replace(/^\*\*Attachment:\*\*.*$/gm, "")
      .replace(/^-# \*edited after.*$/gm, "")
      .trim();
    const image = embed.image?.url;
    return {
      // A jump link is the ONLY record of the original channel. Older posts have none, and guessing
      // the starboard itself is what put jump links on the board that pointed back at the board.
      channelId: jump?.[1] ?? null,
      authorId: icon.match(/avatars\/(\d+)\//)?.[1] ?? null,
      authorName: embed.author?.name ?? null,
      content,
      attachments: image ? [{ url: image, name: "attachment", isImage: true }] : [],
      count: Number(post.content?.match(/\*\*(\d+)\*\*/)?.[1] ?? 0),
    };
  }

  let adopted = 0;
  let repaired = 0;
  for (const [originalId, post] of inChannel) {
    const known = knownOriginals.has(originalId);
    const read = readPost(post);
    if (!read) continue;

    // REPAIR covers rows that were adopted before the author and channel could be read off the post.
    if (known && !REPAIR) continue;
    if (known) {
      const row = await starboardSchema.findById(originalId).lean();
      const fix = {};
      if (!row.authorId && read.authorId) fix.authorId = read.authorId;
      if (!row.authorName && read.authorName) fix.authorName = read.authorName;
      // A channelId equal to the starboard is the old bad default, never a real answer.
      if ((!row.channelId || row.channelId === board.id) && read.channelId) fix.channelId = read.channelId;
      if (row.channelId === board.id && !read.channelId) fix.channelId = null;
      if (!row.content && read.content) { fix.content = read.content; fix.recoveredFromPost = true; }
      if (!row.attachments?.length && read.attachments.length) fix.attachments = read.attachments;
      if (Object.keys(fix).length) {
        await starboardSchema.findByIdAndUpdate(originalId, { $set: fix });
        repaired++;
      }
      continue;
    }

    adopted++;
    if (!ADOPT) {
      // Still remember it for the scan below, or a dry run reports everything already on the board
      // as missing and the headline number is meaningless.
      knownOriginals.add(originalId);
      continue;
    }
    await starboardSchema.findByIdAndUpdate(
      originalId,
      {
        $set: {
          starboardId: post.id,
          channelId: read.channelId,
          authorId: read.authorId,
          authorName: read.authorName,
          count: read.count,
          ...(read.content ? { content: read.content, recoveredFromPost: true } : {}),
          ...(read.attachments.length ? { attachments: read.attachments } : {}),
        },
        $max: { peakCount: read.count },
        $setOnInsert: { starredAt: post.createdAt },
      },
      { upsert: true }
    );
    knownOriginals.add(originalId);
  }
  console.log(`${ADOPT ? "Adopted" : "Would adopt"} ${adopted} existing posts${REPAIR ? `, repaired ${repaired} incomplete rows` : ""}\n`);

  // ⎯⎯ 2. Walk history for messages that qualified but were never posted ⎯⎯
  const channels = SNAPSHOTS_ONLY
    ? []
    : [...guild.channels.cache.values()].filter(
        (c) => c.isTextBased?.() && !c.isThread?.() && c.id !== CHANNELS.STARBOARD && c.viewable && (!ONLY_CHANNEL || c.id === ONLY_CHANNEL)
      );
  if (!SNAPSHOTS_ONLY) console.log(`Scanning ${channels.length} channels...\n`);

  const missing = [];
  let scanned = 0;
  for (const channel of channels) {
    let cursor = null;
    let inChannelCount = 0;
    for (;;) {
      const batch = await channel.messages.fetch({ limit: 100, ...(cursor ? { before: cursor } : {}) }).catch(() => null);
      if (!batch?.size) break;
      scanned += batch.size;
      inChannelCount += batch.size;

      let pastCutoff = false;
      for (const message of batch.values()) {
        if (cutoff && message.createdTimestamp < cutoff) {
          pastCutoff = true;
          continue;
        }
        // Any star counts, and the largest is the one worth testing against the threshold.
        const star = [...message.reactions.cache.values()]
          .filter((r) => r.emoji.id === EMOJI_IDS.STAR || (!r.emoji.id && isUnicodeStar(r.emoji.name)))
          .sort((a, b) => b.count - a.count)[0];
        // The raw count includes the author, so look at anything within one of the bar.
        if (!star || star.count < THRESHOLD - 1) continue;
        if (knownOriginals.has(message.id)) continue;

        const starrers = await starrersOf(message);
        await new Promise((r) => setTimeout(r, REACTION_PAUSE_MS));
        if (starrers.length < THRESHOLD) continue;

        missing.push({ message, count: starrers.length, starrers });
        console.log(`  MISSING  ${starrers.length} stars  #${channel.name}  ${message.id}  ${(message.content ?? "").replace(/\s+/g, " ").slice(0, 60)}`);

        if (POST) {
          await syncStarboard(message, { reason: "backfill" });
          // syncStarboard writes the row, but it does not know the snapshot fields, so fill those in.
          await starboardSchema.findByIdAndUpdate(message.id, { $set: { starrers, ...snapshot(message) }, $max: { peakCount: starrers.length } });
          knownOriginals.add(message.id);
          await new Promise((r) => setTimeout(r, POST_PAUSE_MS));
        }
      }
      cursor = batch.last().id;
      if (pastCutoff && cutoff) break;
      await new Promise((r) => setTimeout(r, PAGE_PAUSE_MS));
    }
    if (inChannelCount) console.log(`#${channel.name}: ${inChannelCount} messages read`);
  }

  // ⎯⎯ 2b. Recover who starred each post ⎯⎯
  // Adoption could never fill this in: who starred a message lives on the message's reactions, and a
  // starboard post carries no trace of it. Without it "stars given" is zero for everybody.
  //
  // The message id is known for every row, but fetching a message needs its channel, and 309 rows
  // have none on record. So each unknown is probed against the channels these posts actually come
  // from, most common first: a hit is definitive and usually lands within a couple of tries, where
  // walking full history to find them would take hours.
  if (STARRERS) {
    const rows = await starboardSchema.find({}).lean();
    const byFrequency = [...rows.reduce((m, r) => (r.channelId ? m.set(r.channelId, (m.get(r.channelId) ?? 0) + 1) : m), new Map())]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    const candidates = [...new Set([...byFrequency, ...guild.channels.cache.filter((c) => c.isTextBased?.() && !c.isThread?.() && c.viewable && c.id !== board.id).keys()])];
    console.log(`\nRecovering starrers for ${rows.length} rows across ${candidates.length} candidate channels...`);

    let found = 0;
    let located = 0;
    let lost = 0;
    for (const row of rows) {
      let original = null;
      let channelId = row.channelId;

      if (channelId) {
        original = await guild.channels.cache.get(channelId)?.messages?.fetch(row._id).catch(() => null);
        await new Promise((r) => setTimeout(r, REACTION_PAUSE_MS));
      }
      if (!original) {
        for (const cid of candidates) {
          if (cid === row.channelId) continue; // already tried
          const channel = guild.channels.cache.get(cid);
          original = await channel?.messages?.fetch(row._id).catch(() => null);
          await new Promise((r) => setTimeout(r, 220));
          if (original) {
            channelId = cid;
            located++;
            break;
          }
        }
      }
      if (!original) {
        lost++;
        continue;
      }

      const starrers = await starrersOf(original);
      await new Promise((r) => setTimeout(r, REACTION_PAUSE_MS));
      await starboardSchema.findByIdAndUpdate(row._id, {
        $set: {
          starrers,
          channelId,
          ...(row.authorId ? {} : { authorId: original.author?.id ?? null }),
          ...(row.content ? {} : { ...snapshot(original) }),
        },
        $max: { peakCount: starrers.length },
      });
      if (starrers.length) found++;
    }
    console.log(`  starrers recovered for ${found} rows · ${located} originals located by probing · ${lost} could not be found anywhere`);
  }

  // ⎯⎯ 3. Fill in snapshots for rows adopted without one ⎯⎯
  // A row with no snapshot renders as "(no text)" everywhere, so this is what decides whether the
  // commands look populated or empty. Failures are counted by reason rather than swallowed, because
  // "63 of 340 worked" is useless without knowing whether the rest are deleted or just unreachable.
  let snapshotted = 0;
  let recovered = 0;
  const failures = { noChannel: 0, gone: 0, other: 0 };
  if (ADOPT) {
    const bare = await starboardSchema.find({ $or: [{ content: "" }, { content: { $exists: false } }] }).lean();
    console.log(`\nFilling in snapshots for ${bare.length} rows...`);
    for (const row of bare) {
      const channel = guild.channels.cache.get(row.channelId) ?? (await guild.channels.fetch(row.channelId).catch(() => null));
      if (!channel?.messages?.fetch) {
        failures.noChannel++;
        continue;
      }
      let original = null;
      try {
        original = await channel.messages.fetch(row._id);
      } catch (err) {
        // 10008 is Unknown Message: the original is genuinely gone and never coming back.
        if (err?.code === 10008) failures.gone++;
        else {
          failures.other++;
          if (failures.other <= 3) console.log(`  fetch failed for ${row._id}: ${String(err?.message ?? err).slice(0, 90)}`);
        }
      }
      if (!original) {
        // The original is gone, but the starboard post was BUILT from it and still carries the text
        // in its embed. That is the only surviving copy, so read it back out of our own post rather
        // than leaving the row blank forever.
        const post = inChannel.get(row._id) ?? (await board.messages.fetch(row.starboardId).catch(() => null));
        const embed = post?.embeds?.[0];
        if (embed?.description) {
          const content = embed.description
            .replace(/\[Jump to message\]\([^)]*\)/g, "")
            .replace(/^\*\*Attachment:\*\*.*$/gm, "")
            .replace(/^-# \*edited after.*$/gm, "")
            .trim();
          const image = embed.image?.url;
          await starboardSchema.findByIdAndUpdate(row._id, {
            $set: {
              content,
              attachments: image ? [{ url: image, name: "attachment", isImage: true }] : [],
              // Recorded so it is obvious this came from our own copy, not from Discord.
              recoveredFromPost: true,
            },
          });
          recovered++;
        }
        await new Promise((r) => setTimeout(r, REACTION_PAUSE_MS));
        continue;
      }
      await starboardSchema.findByIdAndUpdate(row._id, { $set: { ...snapshot(original), authorId: original.author?.id ?? null } });
      snapshotted++;
      await new Promise((r) => setTimeout(r, REACTION_PAUSE_MS));
    }
    console.log(
      `  from the original ${snapshotted} · rebuilt from our own post ${recovered} · unrecoverable ${failures.gone + failures.noChannel + failures.other - recovered}`
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Messages read           : ${scanned}`);
  console.log(`Existing posts adopted  : ${ADOPT ? adopted : `${adopted} (dry run)`}`);
  console.log(`Qualified but unposted  : ${missing.length}${POST ? " (posted)" : " (dry run)"}`);
  if (ADOPT) console.log(`Snapshots backfilled    : ${snapshotted}`);
  if (!POST && missing.length) console.log(`\nRe-run with --post to put those ${missing.length} on the board.`);

  await client.destroy();
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
