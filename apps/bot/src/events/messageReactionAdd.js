const { Events } = require("discord.js");
const { syncStarboard, isStarEmoji, fetchFullReaction, starRejection, rejectStar, STARBOARD_CHANNEL_ID } = require("../utility/starboard.js");
const { recallTurn, formatTurnUsage, explainTurn, onCooldown } = require("../utility/sakuChat.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const EXPLAIN_EMOJI = "❓";
const RECEIPT_EMOJI = "💳";
const FORGOTTEN = "I don't have the working for that one any more, sorry. Ask me again and react to the new reply.";

// ❓ shows what a reply was built on, 💳 shows what it cost. Both only apply to Saku's own replies,
// and only to ones still in the turn memory, which is the recent few hundred.
async function handleSakuReaction(reaction, user) {
  const emoji = reaction.emoji.name;
  if (emoji !== EXPLAIN_EMOJI && emoji !== RECEIPT_EMOJI) return false;

  const message = reaction.message;
  if (message.author?.id !== reaction.client.user.id) return false;

  const record = recallTurn(message.id);
  if (!record) {
    await message.reply({ content: FORGOTTEN, allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  if (emoji === RECEIPT_EMOJI) {
    // Free: everything on the card was measured while the reply was being produced.
    await message.reply({ content: formatTurnUsage(record), allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  // Explaining costs a real request, so it shares the chat rate limit rather than being free to spam.
  if (onCooldown(user.id)) return true;
  await message.channel.sendTyping().catch(() => {});
  const explanation = await explainTurn(record);
  await message
    .reply({ content: explanation ?? "I couldn't put the working together just now, try again in a moment.", allowedMentions: { parse: [] } })
    .catch(() => {});
  return true;
}

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;
    // A reaction on a message that has aged out of the cache arrives partial, with no author to check.
    if (!(await fetchFullReaction(reaction))) return;

    try {
      if (await handleSakuReaction(reaction, user)) return;
    } catch (error) {
      console.error("Error - Saku reaction handler failed:", error);
      return;
    }
    if (!isStarEmoji(reaction.emoji)) return;

    // Guild only. A DM has no starboard to reach and no channel worth posting a notice into, and
    // reaction.message.guild is the thing that tells the two apart.
    const message = reaction.message;
    if (!message.guild) return;

    // Stars on the starboard's own copies aren't votes, so they're left alone rather than policed.
    if (message.channelId !== STARBOARD_CHANNEL_ID) {
      const why = starRejection(message, user.id);
      if (why) {
        await rejectStar(reaction, user, why);
        return;
      }
    }

    // A star landed. Everything past this point (counting, posting, editing, taking it down) is the
    // same code the remove handler and the startup catch-up run, so the number can only be produced
    // one way.
    await syncStarboard(message, { reason: "star added" });
  },
};
