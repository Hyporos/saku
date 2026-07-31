const { Events, MessageFlags } = require("discord.js");
const {
  askSaku,
  isBee,
  canChat,
  canMentionAnywhere,
  collectImages,
  onCooldown,
  MENTION_CHANNEL_ID,
  NOT_MEMBER_NOTICE,
  wrongChannelNotice,
} = require("../utility/sakuChat.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Pinging @Saku in a message triggers the same AI chat as /chat (shared brain + per-user memory).

// /chat gets Discord's own "Saku is thinking..." for free from deferReply, but a mention has no
// interaction to defer, and the typing indicator it used instead expires after about ten seconds. A
// turn that chains tool calls or goes out for news runs well past that and leaves the channel dead
// silent with nothing pending. So the indicator gets refreshed, and once a turn is visibly slow Saku
// says so out loud. The notice is edited into the real reply, so the usual two second turn never
// shows it and no placeholder is ever left sitting in the channel.
const TYPING_REFRESH_MS = 8000;
// Measured end to end, an inlined answer is about 3.2s and a news lookup about 4.3s, so anything
// under ~5s is just a normal turn and the typing indicator covers it. Only a tool chain or a wiki
// drill-down runs past this, which is exactly when a silent channel starts looking broken.
const THINKING_AFTER_MS = 6000;
const THINKING_NOTICE = "*Saku is thinking...*";

function thinkingIndicator(message) {
  const ping = () => message.channel.sendTyping().catch(() => {});
  let posting = null; // the promise, not the message: the reply can land while it's still sending
  let settled = false;

  const typing = setInterval(ping, TYPING_REFRESH_MS);
  const slow = setTimeout(() => {
    if (settled) return;
    // Pings them here rather than on the edit, so a slow turn notifies once, up front.
    posting = message.reply({ content: THINKING_NOTICE, allowedMentions: { repliedUser: true, parse: [] } }).catch(() => null);
  }, THINKING_AFTER_MS);

  return async (payload) => {
    settled = true;
    clearInterval(typing);
    clearTimeout(slow);
    const notice = posting ? await posting : null;
    if (notice) return notice.edit(payload).catch(() => {});
    return message.reply(payload).catch(() => {});
  };
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (message.mentions.everyone) return; // ignore @everyone / @here
    if (!message.mentions.users.has(message.client.user.id)) return; // must directly @Saku

    // Strip Saku's mention out of the text; ignore if there's nothing to say and nothing to look at
    const text = message.content.replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "").trim();
    if (!text && !message.attachments.size) return;

    if (onCooldown(message.author.id)) return;

    if (!canChat(message.member, message.author.id)) {
      await message.reply({ content: NOT_MEMBER_NOTICE, allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }

    // A mention is public, so for members it belongs in the one channel meant for it. Bees, the owner
    // and miche are unrestricted. Sent after the cooldown check on purpose, so someone pinging around
    // the server gets one pointer rather than a redirect in every channel they try.
    if (message.channelId !== MENTION_CHANNEL_ID && !canMentionAnywhere(message.member, message.author.id)) {
      await message.reply({ content: wrongChannelNotice(), allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }

    let settle = null;
    try {
      await message.channel.sendTyping().catch(() => {});
      const username = message.member?.displayName || message.author.username;
      const images = await collectImages(message.attachments);
      if (!text && !images.length) return; // attachments weren't anything readable

      // Started only once there's definitely a reply coming, so an ignored message leaves no timers.
      settle = thinkingIndicator(message);
      const reply = await askSaku({
        userId: message.author.id,
        username,
        message: text || "(no text, they just sent this image)",
        images,
        isBee: isBee(message.member, message.author.id),
        isPrivate: false, // public channel — no admin-only info here
        channel: message.channel,
        before: message.id,
        replyTo: message.reference?.messageId,
        guild: message.guild,
      });
      await settle({ content: reply, allowedMentions: { repliedUser: true, parse: [] }, flags: MessageFlags.SuppressEmbeds });
    } catch (err) {
      console.error("Error - Saku mention chat failed:", err);
      const notice = { content: "Saku's brain short-circuited — try again in a moment.", allowedMentions: { parse: [] } };
      await (settle ? settle(notice) : message.reply(notice).catch(() => {}));
    }
  },
};
