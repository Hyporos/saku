const { Schema, model, models } = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// One document per message that has reached the starboard, keyed by the ORIGINAL message id.
// This used to be a bare `new Map()` in memory, which meant a restart lost every link between a
// message and its starboard post. The consequences were live in the channel: three messages had been
// posted twice, each copy then drifting to a different count (28 and 25, 17 and 14, 31 and 30),
// because the second post was created by a bot that no longer knew the first existed.
const starboardSchema = new Schema(
  {
    _id: {
      // The original message's id
      type: String,
      required: true,
    },
    starboardId: {
      // The id of the post in the starboard channel, so it can be edited instead of duplicated
      type: String,
      required: true,
    },
    channelId: {
      // Where the original lives, needed to re-count stars long after the message left the cache.
      // Null for posts made by an older version of the bot, whose embeds carried no jump link: there
      // is no record anywhere of which channel those came from, so it must not be guessed.
      type: String,
      default: null,
    },
    authorId: {
      // Kept so the author's own star can be excluded without re-fetching the message
      type: String,
      default: null,
    },
    authorName: {
      // Their display name as it was. Rendering <@id> instead looked fine until someone left the
      // server, at which point Discord shows "@unknown-user" or the raw id, and the whole board is
      // full of people who are no longer here.
      type: String,
      default: null,
    },
    count: {
      // Stars at the last successful sync, author excluded
      type: Number,
      default: 0,
    },
    peakCount: {
      // The highest it ever reached. Stars come off over time, so the live number understates what a
      // post actually did, and "most starred ever" should not quietly demote itself.
      type: Number,
      default: 0,
    },
    starrers: {
      // Who starred it. Makes "you starred 40 of these" possible, and is the only way to tell a
      // genuinely popular message from one person brigading it with alts later on.
      type: [String],
      default: [],
    },
    content: {
      // The message text AS IT WAS when it hit the board. Discord is the source of truth for the
      // live message, but not for history: an edited message silently rewrote what the board showed,
      // and a deleted one took the record with it.
      type: String,
      default: "",
    },
    attachments: {
      // url + name of what was attached, same reasoning as content. Discord's CDN links expire, so
      // these are for the record rather than for re-display.
      type: [{ _id: false, url: String, name: String, isImage: Boolean }],
      default: [],
    },
    recoveredFromPost: {
      // The text was read back out of our own starboard embed because the original had been deleted.
      // Faithful to what the board showed, but not to the message, so it is marked rather than mixed
      // in with snapshots taken from the real thing.
      type: Boolean,
      default: false,
    },
    editedAt: {
      // Set when the original was edited after being starred, so the board can say so plainly
      type: Date,
      default: null,
    },
    starredAt: {
      // When it first crossed the threshold, for "on this day" style lookups later
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Reaching for a post by its starboard id happens when reconciling what is already in the channel.
starboardSchema.index({ starboardId: 1 });
// Leaderboards and "top starred" queries read this directly.
starboardSchema.index({ count: -1 });

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const name = "starboard";
module.exports = models[name] || model(name, starboardSchema, name);
