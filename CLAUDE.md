# Saku — CLAUDE.md

Saku is a monorepo Discord bot + web dashboard for tracking MapleStory culvert scores in a guild.

---

## Project Structure

```
apps/
  bot/        Node.js Discord bot + Express API (port 25637)
  webapp/     React + TypeScript frontend + Express auth server (port 8000)
```

**Root scripts** (pnpm):
- `pnpm bot` — start bot
- `pnpm webapp` — start webapp (Vite :5173 + backend :8000)
- `pnpm deploy-commands` — register slash commands with Discord

---

## Bot (`apps/bot/`)

### Folder structure — follow it, don't invent alongside it

```
src/
  index.js            entry point: client, express, cron bootstrap
  deploy-commands.js  one-off slash command registration
  commands/<cat>/     one file per TOP-LEVEL command (culvert, event, fun, user, utility)
  events/             discord.js event handlers, auto-loaded
  schemas/            mongoose models, one per collection
  config/             ids.js (roles, channels, emojis), levels.js
  domain/             business logic with NO discord.js types — testable on its own
    culvert/          utils.js (reset dates, name matching), chart.js (graph building)
    starboard.js
    levels.js
  features/           self-contained features that own their whole pipeline
    chat/             Saku's AI: persona, tools, context, memory, usage
    scan/             OCR
  scheduling/         registry.js, jobs.js, health.js, latencyMonitor.js
  api/                the Express API the webapp consumes
  canvas/             image generation (@napi-rs/canvas)
  lib/                genuinely generic helpers only: pagination, checklist, transient
```

**Where new code goes:**

| It is… | Put it in |
|---|---|
| A slash command | `commands/<category>/<name>.js` — one file per top-level command |
| Logic about culvert/starboard/levels that doesn't touch `interaction` | `domain/` |
| A whole feature with its own prompt, API calls and state | `features/<name>/` |
| A cron job or health check | `scheduling/` |
| An HTTP route | `api/` |
| A helper used by 3+ unrelated places, with no domain knowledge | `lib/` |

**Rules that matter more than the layout:**

- **Don't create a folder for one file.** If it doesn't have siblings and isn't going to, it belongs in an existing folder. `lib/` is for genuinely shared things, not a second junk drawer.
- **`domain/` must not import discord.js.** That's the whole point — it stays testable without a client.
- **The command loaders read exactly one level deep.** `index.js`, `deploy-commands.js` and `/reload` all `readdirSync(commands/<cat>)`. Nesting deeper means files are silently ignored. Do not add subfolders under a command category.
- **One file per top-level command.** Subcommands live in that same file (see `character.js`, `starboard.js`), not as sibling files — a file with no `data`/`execute` export makes both loaders log a warning.
- **No `utils/`, `helpers/`, `types/`, `constants/` or `middleware/`.** Those names describe nothing; the folders above already have homes for all of it.

### Command access tiers

Access is declared **on the command module**, never in a list elsewhere:

```js
module.exports = {
  tier: "bee",              // "bee" | "owner" — omit for public
  culvert: true,            // subject to the Friends-role restriction
  tiers: { subtract: "bee" }, // per-subcommand, when only part of a command is restricted
  data: ..., execute: ...,
};
```

`events/interactionCreate.js` reads those and nothing else. It used to hold hardcoded name arrays, which silently drifted: `/weekly` was documented and described as bee but was never in the list, and `"subtract"` was listed but is a subcommand, so `commandName` never matched and the check could not fire. If you add or rename a command, the tier travels with it. `tests/permissions.js` asserts every `[BEE]`/`[OWNER]` description tag matches the enforced tier.

### Command Pattern

Every command exports exactly:
```js
module.exports = {
  data: new SlashCommandBuilder().setName(...).setDescription(...),
  async execute(interaction) { ... },
  async autocomplete(interaction) { ... }, // optional
};
```

- Long operations: `await interaction.deferReply()` first, then `interaction.editReply()`
- Errors returned to user as ephemeral replies when appropriate
- Bee/owner permission check: `interaction.member.roles.cache.has("720001044746076181") || interaction.user.id === "631337640754675725"`

### Key Schemas

| Schema | Key Fields |
|---|---|
| `weekSchema` | `week` (ISO date Wed), `finalized`, `scores: [{name, score}]`, `submitted`, `total` |
| `culvertSchema` | `_id` (Discord ID), `characters: [{name, memberSince, graphColor, scores: [{date, score}]}]` |
| `exceptionSchema` | `name` (correct), `exception` (OCR misread) |
| `actionLogSchema` | `action`, `target`, `details`, `category`, `actorId`, `timestamp` (TTL 90d) |

### Date / Reset Logic

- Culvert week resets **Thursday 12:00 AM UTC**
- Week is identified by its **Wednesday** date (day before reset)
- `getResetDates()` from `culvertUtils.js` returns `{ reset, lastReset, nextReset }` — `lastReset` is the Wednesday of last week
- Date format stored: `"YYYY-MM-DD"` (ISO) for weeks; `"MMM DD, YYYY"` for character `memberSince`
- Validate date option: `/^\d{4}-\d{2}-\d{2}$/.test(date)` + `dayjs(date).day() === 3` (Wednesday)
- Use `dayjs` for date math; DST offset stored in `data/dst-state.json`

### Routes

- Bot serves its own Express API at port **25637**
- Admin identity passed via `x-admin-user-id` request header
- Scan endpoint accepts ISO date strings; falls back to `lastReset` if not a valid date
- Historical week names queried from `weekSchema` for "renamed or unlinked" detection

### `/help` — read and update it whenever a command is touched

**Any change to a command is not finished until `/help` matches it.** Read `commands/utility/help.js` as part of the change, not after it, and update the entry in the same pass. This applies to every kind of edit, not just new commands:

| Change | What `/help` needs |
|---|---|
| New command or subcommand | A new entry in `COMMANDS` |
| Renamed command | The `name` field, using the spaced subcommand form (`"character rename"`) |
| Added / removed / renamed an option | The `params` string |
| Behaviour changed | The `desc` string — this is the one most often missed |
| Deleted command | Its entry removed |
| Access tier changed | The `bee` / `owner` flag |

`desc` is user-facing documentation, so it must describe what the command *actually does now*, including behaviour that isn't visible in the options: confirmation prompts, what gets validated and rejected, what else gets written or cleaned up, and any time limit. If a command silently touches another collection, say so.

Bee and owner commands also carry a `[BEE]` / `[OWNER]` prefix at the **start** of their `setDescription()` text, including on each subcommand (the parent's prefix isn't shown when Discord lists them). Discord caps a description at 100 characters — check the total after adding the prefix.

`help.js` is an interactive Components V2 panel driven by a single `COMMANDS` array (the one source of truth). Add one object to that array:

```js
{ name: "foo", cat: "Culvert", bee: true /* omit if public */, desc: "...", params: "`[arg]` - ..." }
```

The category dropdown, command dropdown, detail view, and autocomplete are all derived from it — no switches or embed fields to keep in sync. Use `"None"` for `params` when the command takes no arguments. `cat` must be one of `CATEGORIES` (Culvert / Fun / Utility). Access tiers: default = public, `bee: true` = bee/admin (hidden from members), `owner: true` = owner-only (hidden from everyone but the owner). Bee commands are tagged 🐝 in the dropdown / "Bee only" in detail; owner commands use the `sakuCop` emoji / "Owner only". `cat` must be one of `CATEGORIES` (Culvert / User / Fun / Utility). The command dropdown is category-scoped, so a single category must stay under 25 commands. The owner gets "View as Member / Bee / Owner" toggle buttons to preview each tier. Subcommands are documented as their own entries with a spaced name (e.g. `"user level"`).

---

## Webapp (`apps/webapp/`)

### Stack

- React 18 + TypeScript (strict: `noUnusedLocals`, `noUnusedParameters`)
- Vite + Tailwind CSS 3.4
- React Router v6 (protected routes via `ProtectedRoute`)
- Axios (credentials always included)
- API base resolved from `VITE_BOT_API_URL` env var via `config/apiBase.ts`

### Tailwind Theme

Custom colors: `background` (#292A30), `panel` (#222328), `tertiary` (#C2C2C2), `accent` (#FFC3C6 pink). Use these instead of raw hex values. Font: Karla.

### TypeScript Rules

- All types live in `features/admin/types.ts` for admin-area shapes
- Props interfaces defined in the same file as the component
- Strict mode — no unused imports/variables; fix TS errors before considering a change done
- ESLint must pass: `npm run lint` in `apps/webapp`

### DatePicker

`DatePicker` in `components/DatePicker.tsx` accepts:
- `allowedDays?: number[]` — restrict selectable days (0=Sun … 6=Sat). Wednesday = 3.
- `wednesdayOnly` — legacy single-day restriction (prefer `allowedDays={[3]}`)
- `compact`, `align="right"` — display options

### Scanner Tab Conventions

- `getCulvertWednesday(weekOffset = 0)` — returns ISO string for the culvert Wednesday; `weekOffset=-1` = last week
- `imageNotFoundNamesRef` — `Map<fingerprint, string[]>` tracks OCR names not found per image; used to target specific images when adding exceptions
- `historicalNames` — `Set<string>` built from `weekSchema` scores; drives the "renamed or unlinked" flag
- CoveragePanel is always visible (not gated on phase); use `items-stretch` + `flex-1` to match heights

### Week Range Display

When displaying a Wednesday date as a string, always pass `timeZone: "UTC"` to `toLocaleDateString` to prevent off-by-one-day shifts in UTC- timezones:
```ts
d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
```

---

## Code Style

- **Indentation**: 2 spaces
- **Strings**: Double quotes in JS; single or double in TS — follow the file's existing style
- **Sections**: Separate logical sections with the Unicode divider line `// ⎯⎯⎯⎯...⎯⎯⎯ //`
- **Comments**: Minimal. Only add when the WHY is non-obvious. No multi-line comment blocks.
- **No trailing summaries**: Do not add comments like `// Added for issue #123` or `// used by X`
- **Async/await** everywhere — no `.then()` chains
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `BEE_ROLE_ID`, `GRAPH_TEMPLATE`)
- **No unused imports**: TypeScript strict mode will flag them as errors
- **No backwards-compat hacks**: If something is unused, delete it outright

---

## Key IDs

| Constant | Value |
|---|---|
| Bee role | `720001044746076181` |
| Owner Discord ID | `631337640754675725` |
| Graph template (QuickChart) | `https://quickchart.io/chart/render/zm-c2f6cd67-0740-44d6-a023-649110e22db9` |
| Primary graph color (RGB) | `255,189,213` |

---

## Common Pitfalls

- **`/help` goes stale silently**: nothing fails when `help.js` drifts from reality — no error, no failing test, just wrong documentation shown to members. Treat reading and updating it as part of every command change, including edits to an existing command's behaviour or options. See "`/help` — read and update it whenever a command is touched".
- **help.js data source**: `/help` is data-driven — edit the `COMMANDS` array, not per-command switches or embed fields. The command dropdown is category-scoped; each category must stay under 25 commands (the select-menu cap).
- **Deploy vs restart**: renaming a command, changing its description, or adding/removing an option all need `pnpm deploy-commands`. Only the handler body is picked up by a restart alone.
- **ISO date fallback**: If the bot's `routes.js` does not recognize an ISO date string (old code), it silently falls back to `lastReset`. Always restart the bot after changes to routes.js.
- **Week date is Wednesday**: The culvert week is stored/referenced by its Wednesday date, not Thursday. `getResetDates().lastReset` returns the Wednesday of last week.
- **`dayjs().day() === 3`** checks for Wednesday. Day 4 = Thursday.
- **UTC rendering**: `new Date("YYYY-MM-DD")` parses as UTC midnight. Rendering it in a local UTC- timezone shifts the display by one day. Always use `timeZone: "UTC"` when formatting these dates.
- **Deploy commands**: Adding new slash commands requires running `pnpm deploy-commands` — the bot restart alone does not register new commands with Discord.
- **TypeScript build errors block deploys**: Run `npm run build` in `apps/webapp` to catch type errors before assuming webapp changes are safe.
