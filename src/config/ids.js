// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Every Discord id the bot depends on, in one place.
//
// They used to be literals spread across sixteen files, with the bee role written out in four of
// them and the owner's id in five. Nothing enforced that the copies agreed, so a role change meant
// finding every one of them, and a missed copy fails silently: the check just stops matching and
// whoever it guarded quietly loses or gains access.
//
// The colour swatch emojis in commands/culvert/graphColor.js are deliberately NOT here. Each one is
// paired with the rgb value it represents in a single table, and splitting that table in half would
// make it harder to keep straight, not easier.

const GUILD_ID = "719788426022617138";

const ROLES = {
  BEE: "720001044746076181", // guild admins
  MEMBER: "750000646345719899",
  FRIEND: "720006084252663868", // no access to culvert commands
  URSUS: "835222431396397058", // opt-in ping for the 2x Ursus windows
  MONSTER_PARK: "962201169588019221", // opt-in ping for the Sunday box reminder
};

const USERS = {
  OWNER: "631337640754675725", // Brian (dissatisfied), the developer
  DANNIS: "146055470442872833",
  MICHE: "139062876080963584", // guild leader until June 2026
  WRIGNT: "106111034804142080", // alex (wrignt), current guild leader, the unfiltered banter
  RIGGED_ROLL: "109101024282685440", // Katie, /dannis always favours her
};

const CHANNELS = {
  STARBOARD: "1069832131938897950",
  SAKU_YAPS: "1532571112469299220", // the one channel members may @mention Saku in
  SAKU: "719788426022617142", // general, also where anniversaries and birthdays post
  CULVERT: "1090037019557769256",
  REMINDERS_SCAN: "1090002887410729090", // scan reminders and the checklist
  ANNOUNCEMENTS: "720002714683179070",
  CRASH_LOG: "1288222696731054120",
  LATENCY: "1463623492015620137",
  EVENT: "1533969784855593040",
  MEMBER_LOG: "804899301632770078", // joins, leaves and nickname changes
  INTRODUCTIONS: "720002479005237258", // also where new members are welcomed
};

// Channels that earn no levelling XP: bot spam, admin rooms, and anywhere chat is not conversation.
// A Set because the only thing ever asked of it is whether one channel is in it.
const NO_XP_CHANNELS = new Set([
  "761406523950891059", // bot-spam
  CHANNELS.CULVERT,
  "807320077951172659", // bees-pls
  "1178171097858973746", // dannis-fan-club
  "913840369001709608", // karuta
  CHANNELS.REMINDERS_SCAN,
  "1147319860481765500", // dev
  "733468367653961760", // inactive
  CHANNELS.INTRODUCTIONS,
  "720004340558856222", // admin-channel
  "821763840559153174", // admin-channel
  "1302748524110418011", // admin-channel
  "720118849155891302", // admin-channel
  "776872035754180610", // admin-channel
  "788477119000084501", // admin-channel
]);

// Raw ids where a bare id is wanted (message.react takes one), and the rendered <:name:id> form
// where the emote goes into text. Discord only renders the second form.
const EMOJI_IDS = {
  STAR: "1318229624890593355", // star_saku, the starboard reaction
  THUMB_SHADOW: "1236258713153568879", // reaction on every logged score
  STONKS: "1134552911033139381", // reaction on a personal best
};

// The starboard ran on plain unicode stars for years before star_saku existed, and it went through
// more than one of them. Hundreds of older posts were earned entirely on these, so all of them count:
// history stays readable, and nobody's star silently stops working because they reached for the one
// on their keyboard.
const STAR_UNICODE = ["⭐", "💫", "✨", "🌟"];
const isUnicodeStar = (name) => STAR_UNICODE.includes(name);

const EMOJIS = {
  STAR: `<:star_saku:${EMOJI_IDS.STAR}>`,
  SAKU_SMUG: "<:sakuSmug:1113503249534820445>",
  SAKU_COP: "<:sakuCop:1112235079364788345>",
  UPTREND: "<:uptrend:1532546386497765416>",
  DOWNTREND: "<:downtrend:1532546371712848013>",
  NAV: {
    first: "<:doubleleftchevron:1193783344996024350>",
    prev: "<:singleleftchevron:1375242927634120804>",
    next: "<:singlerightchevron:1375242928787689693>",
    last: "<:doublerightchevron:1193783935071682591>",
  },
};

// The two permission checks that appear all over the command tree, written once. `member` may be
// null in a DM, which is why every call is optional-chained rather than assumed.
//
// The owner counts as a bee everywhere, so `isBee` folds that in rather than leaving each caller to
// remember the `|| userId === OWNER` half — which is exactly the half that kept getting dropped.
const isBee = (member, userId) => Boolean(member?.roles?.cache?.has(ROLES.BEE)) || userId === USERS.OWNER;
const isOwner = (userId) => userId === USERS.OWNER;

module.exports = { GUILD_ID, ROLES, USERS, CHANNELS, NO_XP_CHANNELS, EMOJI_IDS, EMOJIS, isUnicodeStar, isBee, isOwner };
