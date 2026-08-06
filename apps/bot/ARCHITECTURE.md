# Saku bot — architecture

How the bot is laid out, why, and the rules that keep it that way. Read this before moving a file or
adding a folder. `CLAUDE.md` at the repo root carries the same rules in shorter form; this file
explains the reasoning behind them.

---

## Layout

```
src/
  index.js            entry point: client, express, cron bootstrap, command/event loaders
  deploy-commands.js  one-off slash command registration

  commands/<cat>/     one file per TOP-LEVEL command (culvert, event, fun, user, utility)
  events/             discord.js event handlers, auto-loaded
  schemas/            mongoose models, one per collection
  config/             ids.js (roles, channels, emojis), levels.js

  domain/               business logic with NO discord.js types
    culvert/utils.js    reset dates, name matching/normalizing, the rankings URLs
    culvert/chart.js    score index, percentiles, QuickChart URLs
    culvert/scanMatch.js turning a name read off a screenshot into a linked character
    starboard.js
    levels.js

  features/           self-contained features that own their whole pipeline
    chat/             Saku's AI (see "The chat feature" below)
    scan/ocr.js       Gemini OCR: the reader, both prompts, attachment fetching

  scheduling/         registry.js (cron jobs + DST), jobs.js, health.js, latencyMonitor.js
  api/                the Express API the webapp consumes (see "The API" below)
  canvas/             image generation (@napi-rs/canvas)
  lib/                genuinely generic helpers: pagination, checklist, transient
```

### Where new code goes

| It is… | Put it in |
|---|---|
| A slash command | `commands/<category>/<name>.js` |
| Logic about culvert/starboard/levels that never touches `interaction` | `domain/` |
| A whole feature with its own prompt, external API and state | `features/<name>/` |
| A cron job or health check | `scheduling/` |
| An HTTP route | `api/` |
| A helper used by 3+ unrelated places with no domain knowledge | `lib/` |

### Rules

- **Never create a folder for one file.** If it has no siblings and won't get any, it belongs in an
  existing folder.
- **`domain/` must not import discord.js.** That is what makes it testable without a client.
- **No `utils/`, `helpers/`, `types/`, `constants/`, `middleware/`.** A folder named after a part of
  speech describes nothing, and every one of those has a home above. `utility/` used to exist and had
  become a junk drawer of twelve unrelated files — that is what this layout replaced.
- **The command loaders read exactly one level deep.** `index.js`, `deploy-commands.js` and `/reload`
  all `readdirSync(commands/<cat>)`. A subfolder under a command category is silently ignored.
- **One file per top-level command**, subcommands included. A file under `commands/` without
  `data`/`execute` makes both loaders log a warning at boot.

---

## Command access tiers

Access is declared **on the command module**, never in a list elsewhere:

```js
module.exports = {
  tier: "bee",                // "bee" | "owner" — omit entirely for public
  culvert: true,              // subject to the Friends-role restriction
  tiers: { subtract: "bee" }, // per-subcommand, when only part of a command is restricted
  data: ..., execute: ...,
};
```

`events/interactionCreate.js` reads those three fields and nothing else.

**Why it changed.** It used to hold three hardcoded arrays of command names. Nothing failed when they
drifted, and they had:

- `/weekly` was documented in `/help` as bee and its description said `[BEE]`, but it was never in
  `beeCommands` — so anyone could run it.
- `"subtract"` was listed, but it is a subcommand of `/event`. The gate matched on
  `interaction.commandName`, which is `"event"`, so that entry could never fire and `/event subtract`
  was open to everyone.

Both are fixed. `tests/permissions.js` asserts every command declares a valid tier and that every
`[BEE]`/`[OWNER]` description tag matches the tier actually enforced, so the two cannot drift again.

---

## The API (`src/api/`)

Was one 1,648-line `routes.js`. Now one file per resource:

| File | Serves |
|---|---|
| `index.js` | Mounts every resource router and applies the shared-secret gate **once** |
| `shared.js` | Validators (`isDiscordId`, `isIsoDate`…), `writeActionLog`, `getActorId`, constants |
| `scanCache.js` | The scanner's short-lived view of characters + exceptions |
| `public.js` | Read-only lookups the webapp renders from |
| `users.js` `characters.js` `scores.js` `weeks.js` `exceptions.js` | Admin CRUD, one resource each |
| `scanner.js` | OCR bulk entry: scan, log, finalize |
| `actionLog.js` `scheduledTasks.js` | Audit trail, cron status |

**`scanCache.js` exists because the split exposed a real dependency**: editing an exception must
invalidate the scanner's cache, and those two routes now live in different files. Shared mutable state
gets its own module rather than a circular import.

**The secret gate is applied once in `index.js`.** Every route needs it, not just the admin ones —
`/getAll` alone returns every character and their full score history. Do not re-apply it per file;
`tests/api.js` asserts no resource file does.

`tests/api.js` walks the mounted router tree and compares it against the 35 paths the single file
served. If you add or rename a route, update that list in the same change.

---

## The chat feature (`src/features/chat/`)

| File | Lines | Purpose |
|---|---|---|
| `model.js` | ~79 | Which models to try and in what order, thinking config, the Gemini client |
| `usage.js` | ~150 | Daily cost ledger: prices a request, tracks what the day has spent |
| `emotes.js` | ~103 | Emote rationing, the channel-request detector, `:name:` repair |
| `index.js` | ~2,527 | Everything else, including `askSaku` — the turn loop |

### Why `index.js` is still large, and why that is not simply a to-do

The file was 2,781 lines. Measuring the coupling before cutting showed it is **not** uniformly
tangled — it is a legitimate orchestrator with a few unrelated modules that had drifted into the same
file:

| Section | Lines | Symbols it needs from elsewhere |
|---|---|---|
| emote repair | 88 | **0** |
| usage ledger | 123 | 4 (all config) |
| persona + guardrails | 105 | 2 |
| channel context | 52 | 0 |
| `askSaku` (turn loop) | ~318 | ~45 |
| server context | 446 | 7, but 15 of its own are used elsewhere |

The three genuinely independent pieces were extracted. `askSaku` needing ~45 symbols is **correct** —
it is the orchestrator; assembling the prompt, tools, history, context and usage is its whole job.
Splitting it further would move the same graph behind more `require` calls without simplifying it.

`model.js` had to come out **before** `usage.js`: the ledger needs the client and the model chain to
price a request, and importing those from `index.js` would have been a cycle.
`tests/chatModules.js` asserts there are no cycles between these four files.

### What is genuinely still worth doing

`server context` (446 lines, 38 declarations, 15 used elsewhere) is the largest remaining candidate.
It is not a leaf, so it needs its consumers untangled first — a design change, not a file move.

### The trap this split has already sprung once

Moving a block into a new module and forgetting to export one symbol **passes `node --check`, and the
module still loads.** It only fails when that code path runs. `MAX_HISTORY` did exactly this and took
the chat regression from 11/11 to 0/11. `tests/chatModules.js` now checks that every export exists and
that the public surface (19 names) is unchanged.

**After touching anything in this folder, run `pnpm test-chat` — a load check is not enough.**

---

## Reading a screenshot (`domain/culvert/scanMatch.js`)

`/scan`, `/culvertping` and the webapp's scanner route all take a screenshot, read names off it, and
match them against linked characters. That logic existed **three times** and the three had drifted:

| | `/culvertping` | `/scan` | scanner route |
|---|---|---|---|
| folds confusable letters (l/1/I, o/0) | no | yes | yes |
| exact-match fast path | no | no | yes |
| I↔l retry | no | no | yes |
| re-read the exception table per name | yes | yes | no |

Whichever one you were reading, the other two were quietly worse at the same job. It is now one
module, and the three callers keep only what genuinely differs: how they turn a matched name into a
character (a `findOne` for the commands, an in-memory map for the route) and how they report results.

Nothing in `scanMatch.js` touches Discord, and only `loadScanRoster`/`loadExceptions` touch the
database, so the matching is testable directly — which is the point. `tests/scanMatch.js` covers it.

**Three bugs the unification fixed**, all confirmed against the real 202-character roster:

- An empty or `..`-only OCR line matched **whoever sorted first in the roster**. With no name to work
  from, the pattern became `^|$`, which matches every string there is.
- Regex metacharacters were interpolated raw, so `a+b` matched `abrese` and an unbalanced bracket
  threw mid-scan.
- Both commands re-queried the whole exception collection **once per scanned name** — a full guild
  list cost ~200 queries to answer a question that cannot change mid-scan.

A differential run over the real roster (994 realistic OCR inputs: clean reads, truncations, l/I and
o/0 swaps, case drift, junk) matched the old behaviour on 991 and differed only on those three, in
each case by correctly returning "no match" where the old code invented one.

---

## Name normalizing — one function, two callers

`domain/culvert/utils.js` exports `normalizeName`. It deliberately folds characters people confuse in
a name: `l`/`1`/`i` → `i`, and `o`/`0` → `o`.

The cached rankings metadata (`characterMetaSchema`) is **keyed by it**. Anything reading that
collection must key through the same function. A plain `toLowerCase()` missed **73 of 202** linked
characters — `Adeldruu` is stored as `adeidruu`, `Rally` as `raiiy` — which silently emptied the
`/rankings` class filter for a third of the roster.

It lives in `domain/` and both `features/chat` and `commands/culvert/rankings.js` import it. Do not
copy it; that duplication is what caused the bug.

---

## Testing

| Suite | Guards |
|---|---|
| `pnpm test-symbols` | **Every identifier is declared, imported, or a real global** |
| `pnpm test-api` | All 35 API routes still mounted, secret gate applied once |
| `pnpm test-permissions` | Every command's tier, and tags matching enforcement |
| `pnpm test-scan-match` | Screenshot name matching: truncation, confusables, junk input |
| `pnpm test-chat-modules` | Chat exports exist, no import cycles, public surface intact |
| `pnpm test-chat` | Live model behaviour: fabrication guards, tone, tool use |
| `pnpm test-canvas` | Level card + leaderboard rendering, stall handling |
| `pnpm test-graph` `test-birthday` `test-starboard` | Week clamping, birthday timing, starboard |

`test-chat` calls the real model, so a run costs a little and one network-flaky case can fail on its
own; re-run before assuming a break.

### `test-symbols` is the one to run after moving code

Splitting a file breaks in a way nothing else catches: the code moves, the `require` at the top does
not follow, and **`node --check` passes and the module still loads**. The failure waits until that one
line runs — and if it sits inside a `catch`, possibly never, visibly.

Splitting `routes.js` did this three times and none of it surfaced for weeks:

| File | Lost | What it looked like |
|---|---|---|
| `api/characters.js` | `axios` | Renames silently stopped picking up a character's real capitalisation — the `ReferenceError` landed in a `catch {}` whose comment said "fallback to requested name" |
| `api/actionLog.js` | `writeActionLog` | `POST /admin/action-log` answered 500 |
| `api/exceptions.js` | `mongoose` | Editing or deleting an exception answered 500 |

`tests/undefinedSymbols.js` walks every file's scopes with acorn and reports any identifier that is
neither declared, imported, nor a Node/JS global. That is why `acorn` is a devDependency.

---

## Things that look wrong but are deliberate

- **`/rankings` and `/profile` rank from live characters, not finalized week snapshots.** The
  snapshots include everyone who has since left; placing a current member behind departed ones is not
  a rank anyone wants. `/weekly` and `/graph`'s rank/median views *do* read snapshots, so historical
  guild totals don't shrink as members leave. A finalized week can therefore show slightly different
  numbers in `/rankings` than in `/weekly`, and that is correct.
- **`/character link` never restores history.** It always starts a character at zero; putting an old
  history back is `/character restore`'s job.
- **The unlink snapshot expires after 90 days; finalized week history never does.** They are different
  stores with different purposes — one is an undo button, the other is the guild's permanent record.
- **`canvas/userRankingsCanvas.js` does not use `canvasUtils`' cached `avatarFor`, and must not.** A
  page of thirty rows is a different problem from the level card's single avatar. Routing it through
  the shared cache, or raising its 1500 ms deadline to match, was tried and reverted: every version
  that shared the machinery ended with real members rendering as "Unknown Member". Only the default
  avatar URL is shared, because a second copy of that literal is just a second thing to get wrong.
  Its member lookups are one-at-a-time for the same reason.

---

## Where IDs and shared values live

| Thing | Home |
|---|---|
| Any Discord role, channel, user or emoji id | `config/ids.js` |
| The MapleStory rankings URLs | `domain/culvert/utils.js` |
| The OCR prompts, the reader, attachment fetching | `features/scan/ocr.js` |
| API validators, `fail`, `objectId`, `getGuild` | `api/shared.js` |
| Pagination chevrons | `EMOJIS.NAV` in `config/ids.js` |

**Read role and channel ids from `config/ids.js`, not from `process.env`.** Both `api/users.js` and
`api/actionLog.js` read `process.env.BEE_ROLE_ID`/`OWNER_ID`, and an unset variable makes
`roles.cache.has(undefined)` a silent false — every bee rendered in the admin panel as a plain member.
It fails as "wrong answer", never as "misconfigured".

**Do not alias a config value to a local constant** (`const BEE_ROLE_ID = ROLES.BEE`). Three files did
it and it buys nothing; use `ROLES.BEE`, or `isBee(member, userId)` where the check is what you want.
