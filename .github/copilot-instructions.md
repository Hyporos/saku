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
| `express` + `cors` | REST API served on port 3000 |
| `@google/generative-ai` | Gemini AI used in `culvertping` and `scan` commands |
| `dotenv` | Load `.env` — call `require("dotenv").config()` at entry points only |
| `timezone-support` | Timezone list for the birthday command |

## Project Structure

```
src/
├── index.js               # Entry point — client setup, Express, cron jobs, event loader
├── deploy-commands.js     # One-time slash command registration script
├── canvas/                # Canvas image generators (userLevelCanvas, userRankingsCanvas)
├── commands/
│   ├── culvert/           # Score tracking, profiles, rankings, scan, export, etc.
│   ├── event/             # Guild event add/subtract/leaderboard/mobcount
│   ├── fun/               # 8ball, roll, dannis
│   ├── user/              # Level card, rankings, user profile
│   └── utility/           # Birthday, help, ping, reload, say
├── config/
│   └── levels.js          # XP thresholds for the leveling system
├── events/                # discord.js event handlers
├── routes/
│   └── routes.js          # Express router (getAll, character/:name, rankings/:name)
├── schemas/               # Mongoose schemas: culvert, event, exception, user
├── services/
│   └── latencyMonitor.js  # Writes latency data to JSON
└── utility/               # Shared helpers: botUtils, cronUtils, culvertUtils, userUtils, pagination, starboardCache
```

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

## Utility Functions

- All reusable logic lives in `src/utility/`.
- Document every exported function with JSDoc (`@param`, `@returns`).
- `culvertUtils.js` — character lookups, score queries, reset date calculation.
- `userUtils.js` — Discord user queries.
- `botUtils.js` — `createScheduledJob` wrapper around `CronJob`, crash detection.
- `cronUtils.js` — birthday and anniversary cron job setup.
- `pagination.js` — button-based pagination for embeds.

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

- Use `createScheduledJob(client, channelId, cronExpression, messageFn)` from `botUtils.js`.
- `cronExpression` uses standard cron syntax (5 fields).
- The `dstOffset` constant in `index.js` must be adjusted manually (0 = standard time, 1 = DST).

## Error Handling

- Always wrap database/API calls in `try/catch`.
- Log errors with `console.error(...)`.
- Swallow Discord interaction errors with code `10062` (unknown interaction — the user dismissed before the bot responded); re-throw anything else.
- Never let an unhandled rejection crash the process silently.

## Express API

- Runs on port **3000** alongside the bot process.
- All routes are mounted under `/api` (defined in `routes/routes.js`).
- The webapp and bot share this server — keep routes RESTful and stateless.
