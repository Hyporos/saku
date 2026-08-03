require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("node:assert");
const starboardSchema = require("../src/schemas/starboardSchema.js");
const { syncStarboard, forgetStarred, trackEdit, countStars, STAR_EMOJI_ID, STARBOARD_CHANNEL_ID } = require("../src/utility/starboard.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// The starboard's failures were all state failures: a count produced two different ways, a cache that
// died with the process, two handlers racing to post the same message. None of them show up in a
// single manual test, so the board is driven here against a stubbed Discord and the real database.
//
// Run: node tests/starboard.js

const TEST_MESSAGE = "990000000000000001";
const TEST_CHANNEL = "111111111111111111";
const AUTHOR = "222222222222222222";

// Minimal stand-ins for the discord.js shapes the module actually touches.
const collection = (entries) => ({
  size: entries.length,
  values: () => entries.values(),
  find: (fn) => entries.find(fn),
  lastKey: () => entries[entries.length - 1]?.id,
});

// A board that records what it was asked to do instead of doing it.
function stubBoard() {
  const board = { sent: [], edits: [], deletes: [], posts: new Map(), nextId: 1 };
  board.send = async (payload) => {
    const id = `post${board.nextId++}`;
    board.sent.push({ id, ...payload });
    board.posts.set(id, {
      id,
      edit: async (p) => { board.edits.push({ id, ...p }); return true; },
    });
    return board.posts.get(id);
  };
  board.messages = {
    fetch: async (id) => board.posts.get(id) ?? Promise.reject(new Error("Unknown Message")),
    delete: async (id) => { board.deletes.push(id); board.posts.delete(id); },
  };
  return board;
}

// `reactors` is the raw list including the author and any bots, exactly as Discord returns it.
function stubMessage(reactors, { id = TEST_MESSAGE, content = "a starred message", channelId = TEST_CHANNEL, board } = {}) {
  const star = {
    emoji: { id: STAR_EMOJI_ID },
    count: reactors.length,
    users: {
      fetch: async ({ after } = {}) => {
        const from = after ? reactors.findIndex((u) => u.id === after) + 1 : 0;
        return collection(reactors.slice(from, from + 100));
      },
    },
  };
  return {
    id,
    content,
    channelId,
    guildId: "719788426022617138",
    createdAt: new Date("2026-07-01T12:00:00Z"),
    author: { id: AUTHOR, username: "starred", displayName: "Starred", displayAvatarURL: () => "https://example.invalid/a.png" },
    member: { displayName: "Starred" },
    attachments: new Map(),
    reactions: { cache: collection([star]) },
    guild: { channels: { cache: { get: (cid) => (cid === STARBOARD_CHANNEL_ID ? board : undefined) } } },
  };
}

const people = (n, prefix = "u") => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, bot: false }));

let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`pass  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const clean = () => starboardSchema.findByIdAndDelete(TEST_MESSAGE).catch(() => {});
  await clean();

  await check("the author's own star does not count", async () => {
    const board = stubBoard();
    // 9 others plus the author: that is 9, one short, so nothing should be posted.
    const msg = stubMessage([...people(9), { id: AUTHOR, bot: false }], { board });
    assert.strictEqual(await countStars(msg), 9);
    await syncStarboard(msg);
    assert.strictEqual(board.sent.length, 0, "posted a message that was one star short");
  });

  await check("bots do not count", async () => {
    const board = stubBoard();
    const msg = stubMessage([...people(9), { id: "botty", bot: true }], { board });
    assert.strictEqual(await countStars(msg), 9);
  });

  await check("reaching the threshold posts once", async () => {
    await clean();
    const board = stubBoard();
    const msg = stubMessage(people(10), { board });
    await syncStarboard(msg);
    assert.strictEqual(board.sent.length, 1, "expected exactly one post");
    assert.match(board.sent[0].content, /\*\*10\*\*/);
    const row = await starboardSchema.findById(TEST_MESSAGE).lean();
    assert.ok(row, "nothing was written to the database");
    assert.strictEqual(row.count, 10);
  });

  // The bug that put three duplicates in the live channel: the link survived only in memory.
  await check("a restart does not create a second post", async () => {
    const board = stubBoard();
    // Simulate the restart by pointing a FRESH board at the row the previous run wrote.
    await starboardSchema.findByIdAndUpdate(TEST_MESSAGE, { $set: { starboardId: "post1", count: 10 } });
    board.posts.set("post1", { id: "post1", edit: async (p) => { board.edits.push({ id: "post1", ...p }); return true; } });
    const msg = stubMessage(people(12), { board });
    await syncStarboard(msg);
    assert.strictEqual(board.sent.length, 0, "posted a duplicate after the restart");
    assert.strictEqual(board.edits.length, 1, "did not edit the existing post");
    assert.match(board.edits[0].content, /\*\*12\*\*/);
  });

  await check("removing a star lowers the number instead of raising it", async () => {
    const board = stubBoard();
    await starboardSchema.findByIdAndUpdate(TEST_MESSAGE, { $set: { starboardId: "post1", count: 12 } });
    board.posts.set("post1", { id: "post1", edit: async (p) => { board.edits.push({ id: "post1", ...p }); return true; } });
    // 11 real starrers plus the author. The old handler reported reaction.count (12) here, so taking
    // a star off could make the displayed number go UP.
    const msg = stubMessage([...people(11), { id: AUTHOR, bot: false }], { board });
    await syncStarboard(msg);
    assert.match(board.edits[0].content, /\*\*11\*\*/, "count did not fall to 11");
  });

  await check("an unchanged count spends no edit", async () => {
    const board = stubBoard();
    await starboardSchema.findByIdAndUpdate(TEST_MESSAGE, { $set: { starboardId: "post1", count: 11 } });
    board.posts.set("post1", { id: "post1", edit: async (p) => { board.edits.push({ id: "post1", ...p }); return true; } });
    await syncStarboard(stubMessage(people(11), { board }));
    assert.strictEqual(board.edits.length, 0, "edited when nothing had changed");
  });

  await check("falling well below the threshold takes the post down", async () => {
    const board = stubBoard();
    await starboardSchema.findByIdAndUpdate(TEST_MESSAGE, { $set: { starboardId: "post1", count: 11 } });
    board.posts.set("post1", { id: "post1", edit: async () => true });
    await syncStarboard(stubMessage(people(7), { board }));
    assert.deepStrictEqual(board.deletes, ["post1"], "did not delete the post");
    assert.strictEqual(await starboardSchema.findById(TEST_MESSAGE), null, "left a stale database row");
  });

  await check("one star short of the threshold is not posted", async () => {
    await clean();
    const board = stubBoard();
    await syncStarboard(stubMessage(people(9), { board }));
    assert.strictEqual(board.sent.length, 0);
  });

  await check("two simultaneous stars still post only once", async () => {
    await clean();
    const board = stubBoard();
    const msg = stubMessage(people(10), { board });
    await Promise.all([syncStarboard(msg), syncStarboard(msg)]);
    assert.strictEqual(board.sent.length, 1, `raced into ${board.sent.length} posts`);
  });

  await check("a hand-deleted starboard post is reposted, not edited forever", async () => {
    await clean();
    // A row pointing at a post that no longer exists, which is what happens when someone clears the
    // channel by hand. The old code fetched it, threw, and gave up every single time.
    await starboardSchema.findByIdAndUpdate(
      TEST_MESSAGE,
      { $set: { starboardId: "gone", channelId: TEST_CHANNEL, count: 10 } },
      { upsert: true }
    );
    const board = stubBoard();
    await syncStarboard(stubMessage(people(11), { board }));
    assert.strictEqual(board.sent.length, 1, "did not repost after the post was deleted by hand");
    const row = await starboardSchema.findById(TEST_MESSAGE).lean();
    assert.notStrictEqual(row.starboardId, "gone", "database still points at the deleted post");
  });

  await check("more than 100 reactors are all counted", async () => {
    await clean();
    const board = stubBoard();
    // The old single fetch() returned one page, so anything this popular froze at 100.
    await syncStarboard(stubMessage(people(137), { board }));
    assert.match(board.sent[0].content, /\*\*137\*\*/, `expected 137, got: ${board.sent[0].content}`);
  });

  await check("deleting the original takes its starboard post with it", async () => {
    await clean();
    const board = stubBoard();
    await syncStarboard(stubMessage(people(10), { board }));
    const posted = board.sent[0].id;
    const client = { channels: { cache: { get: (id) => (id === STARBOARD_CHANNEL_ID ? board : undefined) } } };
    await forgetStarred(TEST_MESSAGE, client);
    assert.deepStrictEqual(board.deletes, [posted], "left the post behind");
    assert.strictEqual(await starboardSchema.findById(TEST_MESSAGE), null);
  });

  await check("a message inside the starboard itself is ignored", async () => {
    await clean();
    const board = stubBoard();
    await syncStarboard(stubMessage(people(20), { board, channelId: STARBOARD_CHANNEL_ID }));
    assert.strictEqual(board.sent.length, 0, "starred a starboard post back onto the starboard");
  });

  // ⎯⎯ snapshot, starrers, peak, edits, self-stars ⎯⎯ //

  await check("the message is snapshotted when it reaches the board", async () => {
    await clean();
    const board = stubBoard();
    const msg = stubMessage(people(10), { board, content: "the original wording" });
    await syncStarboard(msg);
    const row = await starboardSchema.findById(TEST_MESSAGE).lean();
    assert.strictEqual(row.content, "the original wording", "did not store the text");
    assert.deepStrictEqual(row.starrers.sort(), people(10).map((p) => p.id).sort(), "did not store who starred it");
    // Without the name, anyone who later leaves the server renders as @unknown-user on the board.
    assert.strictEqual(row.authorName, "Starred", "did not store the author's display name");
    assert.strictEqual(row.channelId, TEST_CHANNEL, "channel must be the original's, never the starboard's");
  });

  await check("peak survives losing stars", async () => {
    const board = stubBoard();
    await starboardSchema.findByIdAndUpdate(TEST_MESSAGE, { $set: { starboardId: "post1", count: 10 }, $max: { peakCount: 10 } });
    board.posts.set("post1", { id: "post1", edit: async () => true });
    await syncStarboard(stubMessage(people(14), { board })); // up to 14
    await syncStarboard(stubMessage(people(9), { board })); // back down to 9
    const row = await starboardSchema.findById(TEST_MESSAGE).lean();
    assert.strictEqual(row.count, 9, "live count wrong");
    assert.strictEqual(row.peakCount, 14, "peak should remember the high water mark");
  });

  await check("editing a starred message is recorded and refreshes the post", async () => {
    await clean();
    const board = stubBoard();
    await syncStarboard(stubMessage(people(10), { board, content: "before" }));
    const edited = stubMessage(people(10), { board, content: "after" });
    await trackEdit(edited);
    const row = await starboardSchema.findById(TEST_MESSAGE).lean();
    assert.ok(row.editedAt, "edit was not recorded");
    assert.ok(board.edits.length >= 1, "post was not refreshed");
    assert.match(board.edits.at(-1).embeds[0].data.description, /edited after it reached the starboard/);
  });

  await check("an embed loading later does not count as an edit", async () => {
    await clean();
    const board = stubBoard();
    await syncStarboard(stubMessage(people(10), { board, content: "same text" }));
    const editsBefore = board.edits.length;
    await trackEdit(stubMessage(people(10), { board, content: "same text" }));
    const row = await starboardSchema.findById(TEST_MESSAGE).lean();
    assert.strictEqual(row.editedAt, null, "flagged an edit when the text was identical");
    assert.strictEqual(board.edits.length, editsBefore, "spent an edit on an unchanged message");
  });

  await clean();
  console.log(failed ? `\n${failed} failed` : "\nall passed");
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
