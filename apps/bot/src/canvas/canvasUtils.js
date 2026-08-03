const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { request } = require("undici");

// Registered once for the whole process rather than once per canvas module.
GlobalFonts.registerFromPath(require.resolve("../assets/fonts/Quicksand-Regular.ttf"), "Quicksand");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Shared between the level card and the leaderboard: both draw a circular avatar, sanitize a display
// name and sit on a background image, and all three were written twice.

const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

// Discord renders these at roughly half their pixel size, so everything is drawn at 2x and scaled
// back down on the way out. Text that used to look soft comes out sharp for a slightly larger PNG.
const SCALE = 2;

function createHiDpiCanvas(width, height) {
  const canvas = createCanvas(width * SCALE, height * SCALE);
  const context = canvas.getContext("2d");
  context.scale(SCALE, SCALE);
  return { canvas, context };
}

// ⎯⎯ Asset loading ⎯⎯ //

// Backgrounds were re-read off disk and re-decoded on every single render. There are three of them
// and they never change, so each one is decoded once and the same image is reused forever.
const assets = new Map();
function loadAsset(absolutePath) {
  if (!assets.has(absolutePath)) assets.set(absolutePath, loadImage(absolutePath));
  return assets.get(absolutePath);
}

// Avatars are cached by URL, which is safe because a Discord avatar URL contains the image hash: a
// changed avatar is a different URL and misses the cache on its own. The promise is what gets stored,
// so ten rows asking for the same avatar at once share one download.
const AVATAR_CACHE_MAX = 100;
const avatars = new Map();

function loadAvatar(url) {
  const key = url ?? DEFAULT_AVATAR;
  if (avatars.has(key)) return avatars.get(key);

  const pending = (async () => {
    const { body } = await request(key);
    return loadImage(Buffer.from(await body.arrayBuffer()));
  })();

  avatars.set(key, pending);
  // A failed fetch must not be remembered as a permanent failure.
  pending.catch(() => avatars.delete(key));
  if (avatars.size > AVATAR_CACHE_MAX) avatars.delete(avatars.keys().next().value);
  return pending;
}

// Asking for the size actually drawn instead of the full-resolution original: the leaderboard draws
// avatars at 35px and was pulling down 1024px PNGs for every one of them.
const avatarUrlOf = (member, size) =>
  member?.avatarURL?.({ extension: "png", size }) ??
  member?.user?.displayAvatarURL?.({ extension: "png", size }) ??
  member?.displayAvatarURL?.({ extension: "png", size }) ??
  DEFAULT_AVATAR;

// Never rejects: a member who has left, a broken avatar or a network blip all fall back to the
// default avatar rather than taking the whole card down.
async function avatarFor(member, size) {
  try {
    return await loadAvatar(avatarUrlOf(member, size));
  } catch {
    return loadAvatar(DEFAULT_AVATAR).catch(() => null);
  }
}

// ⎯⎯ Text ⎯⎯ //

const STRIP_PARENS = /\s*\(.*?\)\s*/g;
const STRIP_EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

// `member.username` does not exist on a GuildMember, which is what this used to read: anyone without
// a server nickname produced undefined and the strip below threw. `displayName` is the real accessor
// and already resolves nickname, then global name, then username.
function displayNameOf(member, fallback = "Unknown") {
  const raw = String(member?.displayName ?? member?.nickname ?? member?.user?.username ?? "");
  const cleaned = raw.replace(STRIP_PARENS, " ").replace(STRIP_EMOJI, "").replace(/\s+/g, " ").trim();
  // An all-emoji nickname sanitizes down to nothing, which used to render as a blank row.
  return cleaned || raw.trim() || fallback;
}

// Names had no width limit at all, so a long one ran under the progress bar on the level card and
// straight into the level column on the leaderboard.
function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && context.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

// ⎯⎯ Shapes ⎯⎯ //

function drawCircularImage(context, image, x, y, size) {
  if (!image) return;
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
  context.closePath();
  context.clip();
  context.drawImage(image, x, y, size, size);
  context.restore();
}

// The corner radius is clamped to what the box can actually hold. The hand-rolled arcTo version drew
// a malformed blob once the filled width dropped below twice the radius, which is exactly what a
// nearly-empty progress bar looks like.
function fillRoundedRect(context, x, y, width, height, radius) {
  if (width <= 0 || height <= 0) return;
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
  context.fill();
}

module.exports = {
  DEFAULT_AVATAR,
  createHiDpiCanvas,
  loadAsset,
  loadAvatar,
  avatarUrlOf,
  avatarFor,
  displayNameOf,
  fitText,
  drawCircularImage,
  fillRoundedRect,
};
