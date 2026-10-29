# Cull list

Last updated: 2026-10-29

Things to cut or simplify, from a whole-bot review on 2026-10-29. Nothing here has been done yet.

**Reviewed up to commit `5afe99b`.** When picking this back up, first review everything added since:
`git log 5afe99b..HEAD` and `git diff 5afe99b..HEAD -- src scripts tests`, against the same question
(dead, or not worth what it costs: upkeep, per-message or background work, paid model calls, Mongo
writes, fragility, overlap). Add anything new here, then move the "Reviewed up to" commit forward.

## Open questions for Brian

1. Do all the clear cuts?
2. Which of the bigger tradeoffs to take?
3. Is the `/event` mob-count event over? If so, `/event`, `eventSchema` and `CHANNELS.EVENT` go too.
4. Who owns admin edits (scan, finalize, character link/rename/correct/changeid, wall of shame): the Discord commands or the webapp? Retire the other half.

## Clear cuts (nothing of value lost)

- **`/guildprofile`** (`commands/culvert/guildprofile.js`): every number and guild is hardcoded fake data; footer points to a nonexistent `/guildrankings`. Also remove from `tests/permissions.js`.
- **`/reload`** (`commands/utility/reload.js`): commands re-register on every boot, and a restart does more. Remove from `/help`.
- **`/finalize`** (`commands/culvert/finalize.js`): an older copy of `api/scanner.js` finalize that has drifted (no `finalizedAt`, no action log, no backup).
- **Chat number guard** (`features/chat/index.js`: `unsupportedNumbers`, `COUNTED_RE`, `countedNearby`, `PERCENT_RE`, `HEDGED_RE`, `numberTokens`, the `facts` field): stores up to 400 numbers per user, rewritten every turn, and only ever logs a warning. Keep the name guard (it actually fixes replies). Update `tests/guardUnit.js` and `tests/chatModules.js`.
- **Gemini out-of-credits fallback** (`features/chat/gemini.js`, Gemini branch in `features/scan/ocr.js`, `creditsOut`/`benchCredits` in `lib/transient.js`, Gemini prices): ~140 lines that only run at a zero balance. Turn on auto-reload on the Anthropic account instead. Drops the `@google/genai` dependency.
- **Small dead bits:** `EMOJIS.SAKU_SMUG`, `EMOJIS.SAKU_COP` (`config/ids.js`); the unused Haiku price in `chat/usage.js` (unless chat moves to Haiku below); `toRequest`/`toMessage` exports in `gemini.js`; `isBee` re-export from chat `index.js` (import from `config/ids.js` in `commands/fun/chat.js`).
- **Repo clutter:** `.vs/` is tracked (untrack and ignore); `apps/bot` and `apps/webapp` hold only `node_modules`; `tests/birthdays.js`, `emoteRepair.js`, `guardUnit.js` have no npm script (wire up or delete).
- **`scripts/starboardBackfill.js`**: a one-off backfill, if it has been run. Removing it orphans `starrersOf`, `snapshot`, `originalIdOf` in `domain/starboard.js` and `recoveredFromPost` in `starboardSchema.js`.

## Bigger tradeoffs

- **XP and levels** (`events/messageCreate.js`, `commands/user/user.js`, `canvas/userLevelCanvas.js`, `canvas/userRankingsCanvas.js`, `domain/levels.js`, `config/levels.js`): a DB read and write per user per minute on every message, plus "reached level N" posts in whatever channel. ~550 lines, unrelated to culvert, nothing depends on it. Keep `userSchema` (birthdays use it). If kept, at least stop posting the level-up in-channel.
- **❓ and 💳 reactions** (`events/messageReactionAdd.js`, chat `index.js` ~1479-1547): anyone can trigger a paid Opus call (❓) whose answer posts publicly; 💳 posts costs publicly; keeps a 300-entry turn store. Make owner-only or cut.
- **Chat model cost** (`features/chat/model.js`, prompt blocks in chat `index.js`): Opus first with a ~9k-token fixed prompt; in a quiet guild most turns pay a fresh cache write, ~4-5¢ each. Move `summarize()` and `explainTurn()` to Haiku; consider Sonnet as chat primary; trim `MAPLE_KNOWLEDGE` into the on-demand `GAME_REFERENCE`.
- **Per-person personas** (chat `index.js` ~337-416: owner/Dannis/no-filter/Miche rules): hardcoded user ids, each splits the prompt cache, and one gives a member an uncensored swearing mode. Replace with a small map of user id to a one-line tone note.
- **Manual daylight-saving toggle** (`scheduling/registry.js` offset and `dst-state.json`, `PATCH /dst` in `api/scheduledTasks.js`): has to be flipped twice a year or Ursus reminders are an hour off. Ursus times are fixed in UTC, so schedule those jobs in UTC and delete the toggle (~60 lines). Check which other jobs use the offset first.
- **Starboard catch-up on restart** (`reconcileStarboard`, `domain/starboard.js` ~333-390): reads the last 100 messages from every channel (~150 requests) each boot. Limit to the last day or a few channels. Possibly cut `/starboard top/user/random`.
- **`/help`** (`commands/utility/help.js`, 379 lines): hand-written copy of every command; drifts. Generate it from each command's `data` and `tier`.

## Smaller simplifications

- **Roster data top-up during chat** (`warmCharacterMeta` in chat `index.js`): the daily `refreshRosterMeta` with a 7-day TTL already covers it, and Nexon 403s on bursts. Drop the per-turn top-up.
- **Channel-luck joke** (`emotes.js` `CHANNEL_WORD`/`CHANNEL_ASK`, chat `index.js` ~2469-2484): the sentence stripper can replace a whole answer with a stock line. Drop the stripper or the bit.
- **Usage ledger** (`features/chat/usage.js`): two Mongo upserts per model request and a hand-kept price table. Keep one daily counter; make the `getUsage` chat tool owner-only or drop it.
- **Nickname-change log** (`events/guildMemberUpdate.js`): duplicates Discord's audit log.
- **Crash reporter** (`scheduling/health.js`): hardcoded `/home/container/.apollo/crashes` path and `DESKTOP-15LSGET` hostname check; only reports a crash that lands near the same hour. Simplify to "post the newest crash file if newer than the last boot", or cut.
- **Score API routes** (`api/scores.js`): two addressing schemes for the same edits (`/:character/:date` and `/by-id/:scoreId`). Check which one the webapp uses; drop the other.
- **`searchMapleStory` tool description** says it searches the web; it only searches the wiki. Fix the wording.

## Keep

Culvert commands (`/gpq`, `/profile`, `/graph`, `/rankings`, `/culvertping`, `/export`, `/wos`), birthdays and anniversaries, screenshot OCR, chat memory summaries, wiki search, emote repair, recent channel context, member join/leave and welcome.
