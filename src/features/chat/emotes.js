// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Everything about custom emotes in a reply: how often Saku is allowed one, catching a request for a
// channel before it reaches the model, and repairing a :name: the model half-remembered into a real
// one. None of it touches the model, the roster or the database, which is why it lives on its own.

// How many emote-free replies a person gets after Saku uses one. Custom emotes only: plain unicode
// emoji are governed by the prompt, not by this.
const EMOTE_RE = /<a?:\w+:\d+>/g;
const HAS_EMOTE = /<a?:\w+:\d+>/; // separate and non-global: .test() on a /g regex carries lastIndex
const EMOTE_GAP = 4;
const emoteCooldown = new Map();

// Asking for a channel has to be caught here, because a miss is not a small one: no roll gets put in
// front of the model, the guard further down then strips the channel it named anyway, and the person
// who asked a direct question gets a non-answer about luck instead. The old verb list missed real
// requests ("could you give me the real channel for pitched drops?" contains none of them, and
// "going" doesn't match \bgo\b), so any question mentioning a channel now counts.
const CHANNEL_WORD = /\bch(?:annel)?s?\b/i;
// Request words only. Topic words like "drop" or "pitched" belong to the question mark branch:
// putting them here made a plain statement ("i just got a drop on ch 12") look like a request, which
// is how Saku started volunteering channels at people who hadn't asked.
const CHANNEL_ASK =
  /\b(what|whats|which|good|best|where|try|go|going|use|using|lucky|luck|recommend|suggest|should|give|gimme|can|could|would|tell|pick|roll|need|want|any|real|another|other|different|next)\b/i;

// Discord renders a custom emote ONLY as <:name:id>. The model writes two near misses: the bare
// :name: that people type, and a half-formed <:name:> with the id dropped. Both ship as literal text.
// Repair whichever resolve to a real guild emote and DELETE the ones that don't, including names the
// model invented outright, because a stray ":sakuHammer:" sitting in a sentence reads worse than no
// emote at all. Exported for the regression suite: the model can't be made to misformat on demand.
// Edit distance, capped work: only used to rescue a near-miss emote name.
function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let corner = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, corner + (a[i - 1] === b[j - 1] ? 0 : 1));
      corner = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

// Deleting an emote that doesn't resolve leaves the sentence around it broken ("I'll give you a
// instead"), which is worse than the glitch it was meant to fix. Most misses are near misses, so the
// name is matched loosely first: case, punctuation, a dropped or added letter. Only a name with no
// plausible match at all is dropped.
function matchEmote(name, cache) {
  if (!cache) return null;
  const list = [...cache.values()];
  const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = flat(name);

  const exact = list.find((e) => e.name.toLowerCase() === name.toLowerCase()) ?? list.find((e) => flat(e.name) === want);
  if (exact) return exact;

  // Saku's own set only: a near miss should never land on some unrelated server emote.
  const own = list.filter((e) => /^saku/i.test(e.name));
  const shortest = (a, b) => a.name.length - b.name.length;

  const overlap = own.filter((e) => flat(e.name).startsWith(want) || want.startsWith(flat(e.name))).sort(shortest);
  if (overlap.length) return overlap[0];

  const near = own
    .map((e) => ({ e, d: editDistance(flat(e.name), want) }))
    .filter((x) => x.d <= 2)
    .sort((a, b) => a.d - b.d || shortest(a.e, b.e));
  return near.length ? near[0].e : null;
}

function repairEmotes(reply, guild) {
  const cache = guild?.emojis?.cache ?? null;
  const resolve = (name) => matchEmote(name, cache);

  return String(reply)
    // Anything in angle brackets is rebuilt from the real emote rather than trusted, because the id
    // is invented as readily as the name is, and Discord renders a wrong id as literal text too.
    // With no cache to check against, a well-formed tag is left alone and only broken ones go.
    .replace(/<a?:([A-Za-z0-9_]+):[^<>]*>/g, (whole, name) => {
      const hit = resolve(name);
      if (hit) return hit.toString();
      return !cache && /^<a?:[A-Za-z0-9_]+:\d+>$/.test(whole) ? whole : "";
    })
    // Bare :name:. Only saku* is touched, so "3:4:5" and clock times are left alone.
    .replace(/(?<!<):([A-Za-z0-9_]+):(?!\d)/g, (whole, name) =>
      /^saku/i.test(name) ? (resolve(name)?.toString() ?? "") : whole
    )
    .replace(/ {2,}/g, " ") // spaces only: collapsing \s would eat the line breaks
    .replace(/ +([,.!?])/g, "$1")
    .trim();
}

module.exports = {
  EMOTE_RE,
  HAS_EMOTE,
  EMOTE_GAP,
  emoteCooldown,
  CHANNEL_WORD,
  CHANNEL_ASK,
  matchEmote,
  repairEmotes,
};
