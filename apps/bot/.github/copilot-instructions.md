# Saku Bot — Copilot Instructions

## Overview

A Discord bot for the MapleStory guild *Saku*. It manages culvert score tracking, guild events, a leveling system, starboard, cron-based reminders, and an Express REST API that the webapp consumes.

## Language & Runtime

- **CommonJS** (`require` / `module.exports`) — do not use ESM (`import`/`export`) here.
- **Node.js** — rely on built-in modules (`fs`, `path`, `net`, `os`, `stream`) directly; do not install npm stubs for them.
- No TypeScript; plain `.js` files throughout.

## Key Dependencies

| Package | Purpose |
|---|---|
| `discord.js` v14 | Discord client, slash commands, embeds, builders |
| `mongoose` | MongoDB ODM — all DB access goes through schemas |
| `dayjs` | Date manipulation (always extend `utc`, `timezone`, or `updateLocale` as needed) |
| `cron` | Scheduled jobs via `CronJob` |
| `@napi-rs/canvas` | Canvas image generation (`createCanvas`, `loadImage`, `GlobalFonts`) |
| `undici` | HTTP requests inside canvas/image utilities |
| `axios` | HTTP requests in commands and routes |
| `express` | REST API served on port 25637. No `cors` — nothing in a browser calls this API |
| `@google/genai` | Gemini for Saku's chat (`features/chat/model.js`) |
| `@google/generative-ai` | Gemini for screenshot OCR (`features/scan/ocr.js`) |
| `dotenv` | Load `.env` — call `require("dotenv").config()` at entry points only |
| `timezone-support` | Timezone list for the birthday command |
| `acorn` (dev) | Scope analysis behind `pnpm test-symbols` |

## Project Structure

```
src/
├── index.js            # Entry point — client setup, Express, cron bootstrap, loaders
├── deploy-commands.js  # One-time slash command registration script
├── api/                # Express router the webapp consumes
├── canvas/             # Canvas image generators (@napi-rs/canvas)
├── commands/           # One file per TOP-LEVEL command; subcommands live in that same file
│   ├── culvert/  event/  fun/  user/  utility/
├── config/             # ids.js (roles, channels, emojis), levels.js
├── domain/             # Business logic, no discord.js types — testable on its own
│   ├── culvert/        # utils.js (reset dates, name matching), chart.js
│   ├── starboard.js
│   └── levels.js
├── events/             # discord.js event handlers, auto-loaded
├── features/           # Self-contained features owning their whole pipeline
│   ├── chat/           # Saku's AI: persona, tools, context, memory, usage
│   └── scan/           # OCR
├── lib/                # Genuinely generic helpers: pagination, checklist, transient
├── scheduling/         # registry.js, jobs.js, health.js, latencyMonitor.js
└── schemas/            # Mongoose models, one per collection
```

**Follow this layout; do not invent parallel folders.**

- No `utils/`, `helpers/`, `types/`, `constants/` or `middleware/` — every one of those has a home above. A folder named after a part of speech describes nothing.
- **Never create a folder for a single file.** If it has no siblings and won't get any, it belongs in an existing folder.
- **`domain/` must not import discord.js.** That is what makes it testable without a client.
- **The command loaders read exactly one level deep** (`index.js`, `deploy-commands.js`, `/reload`). Subfolders under a command category are silently ignored.
- **One file per top-level command.** A file under `commands/` without `data`/`execute` makes both loaders log a warning.

## Command Structure

Every command file exports an object with the shape:

```js
module.exports = {
  data: new SlashCommandBuilder()
    .setName("commandname")
    .setDescription("Description"),

  // Optional — only if the command has autocomplete options
  async autocomplete(interaction) { ... },

  async execute(interaction) { ... },
};
```

- Command files live in the appropriate category subfolder under `commands/`.
- Use `interaction.deferReply()` at the top of `execute` for any command that hits the database or does async work that may take > 3 s.
- Use `interaction.editReply()` after deferring; use `interaction.reply()` for instant responses.
- For error replies to the user, prefix the message with `Error - ` (matches the existing style).
- **Declare access on the command module, never in a list elsewhere:** `tier: "bee" | "owner"` (omit for public), `culvert: true` for the Friends restriction, and `tiers: { sub: "bee" }` when only one subcommand is restricted. `events/interactionCreate.js` reads these and nothing else — it used to hold hardcoded name arrays that silently drifted out of date. `tests/permissions.js` guards it.
- **Always read and update `commands/utility/help.js` when a command changes.** `/help` is driven by the `COMMANDS` array there and nothing detects drift — a stale entry just shows members the wrong thing. Update the entry in the same change, whether you added a command, renamed one, changed its options, or only changed what it does (`desc` is the one most often forgotten). Bee and owner commands also carry a `[BEE]` / `[OWNER]` prefix at the start of `setDescription()`, on each subcommand as well as the parent.

- **Import ids and permission checks, never re-derive them.** `isBee(member, userId)` and `isOwner(userId)`, plus every role/channel/user/emoji id, live in `config/ids.js`; `isBee` already counts the owner. Never read these from `process.env` — an unset variable makes `roles.cache.has(undefined)` a silent false, so a bee renders as a plain member with nothing logged. Never alias one to a local const either (`const BEE_ROLE_ID = ROLES.BEE` buys nothing).
- **After moving code between files, run `pnpm test-symbols`.** A moved block whose `require` did not follow it passes `node --check` and still loads; it only fails when that line runs, which may be inside a `catch` and therefore never visible. Splitting routes.js lost three imports exactly this way.

## Event Structure

```js
module.exports = {
  name: Events.SomeEvent, // from discord.js Events enum
  async execute(...args) { ... },
};
```

Events are auto-loaded by `index.js` — just drop the file in `src/events/`.

## Mongoose Schemas

- `_id` is always the Discord user ID (type `String`) — never use the default ObjectId.
- Sub-documents (e.g., `characters`, `scores`) set `_id: false`.
- Always pass `{ versionKey: false }` as schema options.
- Export pattern:

```js
const name = "schemaname";
module.exports = models[name] || model(name, schema);
```

## Shared Logic

`src/utility/` no longer exists — it had become a junk drawer of twelve unrelated files. Reusable
logic now goes to whichever of these fits, and each exported function carries JSDoc (`@param`,
`@returns`):

- `domain/culvert/utils.js` — reset dates, name matching and normalizing, the rankings URLs.
- `domain/culvert/chart.js` — score index, stats, QuickChart URLs.
- `domain/culvert/scanMatch.js` — turning a name read off a screenshot into a linked character.
- `domain/levels.js`, `domain/starboard.js` — levelling and starboard rules.
- `scheduling/health.js` — `createScheduledJob` wrapper around `CronJob`, crash detection.
- `scheduling/registry.js` — the cron job table and DST offset.
- `lib/pagination.js` — button-based pagination for embeds.
- `api/shared.js` — API validators plus `fail`, `objectId`, `getGuild`.

## Canvas Image Generation

- Use `@napi-rs/canvas` — **not** the `canvas` npm package.
- Canvas files live in `src/canvas/` and export an async generator function.
- Register fonts with `GlobalFonts.registerFromPath()` before drawing.
- Return an `AttachmentBuilder` wrapping the canvas `.toBuffer('image/png')`.

## Role & Channel IDs

These IDs are hardcoded and must remain consistent:

| Constant | ID |
|---|---|
| Guest role | `720006084252663868` |
| Bee (staff) role | `720001044746076181` |
| Ursus ping role | `835222431396397058` |
| Saku channel | `719788426022617142` |
| Announcements channel | `720002714683179070` |
| Reminders/scan channel | `1090002887410729090` |

## Cron / Scheduling

- Jobs are declared in the `JOB_DEFINITIONS` table in `scheduling/registry.js`, not created ad hoc.
  Repeating times for the same job are built from a helper (see `ursusJob`, `culvertReminder`) rather
  than written out per firing.
- `createScheduledJob(client, channelId, cronExpression, messageFn)` lives in `scheduling/health.js`.
- `cronExpression` uses standard cron syntax (5 fields).
- The DST offset is persisted in `data/dst-state.json` and toggled from the admin panel, not edited in
  code. `baseHour` in a job definition is the intended EST hour; the offset shifts the cron expression.

## Error Handling

- Always wrap database/API calls in `try/catch`.
- Log errors with `console.error(...)`.
- Swallow Discord interaction errors with code `10062` (unknown interaction — the user dismissed before the bot responded); re-throw anything else.
- Never let an unhandled rejection crash the process silently.

## Express API

- Runs on port **25637** alongside the bot process.
- Routes live one file per resource under `src/api/`, all mounted under `/api` by `api/index.js`.
- The shared-secret gate is applied **once** in `api/index.js` and covers every route, read ones
  included — `/getAll` alone returns every character and their full score history. Do not re-apply it
  per file.
- Catch blocks use `fail(res, error, "what was attempted")` from `api/shared.js`.
- Adding or renaming a route means updating the list in `tests/api.js` in the same change.
