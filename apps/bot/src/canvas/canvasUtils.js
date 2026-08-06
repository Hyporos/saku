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
const AVATAR_TIMEOUT_MS = 6000;
// How long a URL that would not load is left alone for. Without this, an avatar that stalls costs the
// full timeout again on every single view of the page it is on.
const RETRY_AFTER_MS = 5 * 60 * 1000;

const avatars = new Map();
const unreachable = new Map();

function loadAvatar(url) {
  const key = url ?? DEFAULT_AVATAR;
  if (avatars.has(key)) return avatars.get(key);

  const failedAt = unreachable.get(key);
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.reject(new Error("avatar recently unreachable"));

  const pending = (async () => {
    // Bounded on purpose, three ways. undici waits five minutes by default, and every avatar on a page
    // is awaited together, so one download that stalls holds the entire card back long past the point
    // where anyone is still waiting for it — which is exactly how a page came to never appear at all.
    const { body } = await request(key, {
      headersTimeout: AVATAR_TIMEOUT_MS,
      bodyTimeout: AVATAR_TIMEOUT_MS,
      // A hard ceiling on the whole thing, whichever phase is the one that stalls.
      signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS),
    });
    return loadImage(Buffer.from(await body.arrayBuffer()));
  })();

  avatars.set(key, pending);
  pending.catch(() => {
    avatars.delete(key);
    unreachable.set(key, Date.now());
    if (unreachable.size > AVATAR_CACHE_MAX) unreachable.delete(unreachable.keys().next().value);
  });
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
  let raw = "";
  try {
    raw = String(member?.displayName ?? member?.nickname ?? member?.user?.username ?? "");
  } catch {
    // `displayName` is a getter that reads through to `this.user`, which a partial member may not
    // have. One row throwing here used to take the whole card down with it.
    raw = String(member?.nickname ?? member?.user?.username ?? "");
  }
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
  avatarFor,
  displayNameOf,
  fitText,
  drawCircularImage,
  fillRoundedRect,
};
