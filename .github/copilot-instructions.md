# Saku — Copilot Instructions

## Project Overview

Saku is a **pnpm monorepo** consisting of two apps:

- **`apps/bot`** — A Discord bot for the MapleStory guild *Saku*, built with discord.js. Handles culvert score tracking, guild events, leveling, starboard, cron-based announcements, and exposes a small Express REST API backed by MongoDB.
- **`apps/webapp`** — A React dashboard that displays culvert stats and character profiles by consuming the bot's Express API.

## Monorepo Structure

```
/
├── .github/
├── apps/
│   ├── bot/          # Discord bot (CommonJS, Node.js)
│   └── webapp/       # React dashboard (TypeScript, Vite)
├── package.json      # Workspace root — dev scripts only
└── pnpm-workspace.yaml
```

**Package manager:** pnpm (workspaces). Never use `npm` or `yarn`.

| Script | Command |
|---|---|
| Run bot | `pnpm bot` |
| Run webapp | `pnpm webapp` |
| Install all | `pnpm i` (from root) |

## General Conventions

- **Indentation:** 2 spaces everywhere (enforced by `.editorconfig`).
- **Line endings:** LF.
- **Trailing whitespace:** trimmed; blank lines between logical blocks for readability.
- **Section dividers:** Long `⎯` divider lines (copy from existing files) are used to visually separate major sections within a file. Keep this style.
- **Comments:** Write comments that explain *why*, not *what*. Use JSDoc for utility functions.
- **Environment variables:** Never hard-code secrets. All secrets live in `.env` (see `.env.example` in each app). Access via `process.env.*`.
- **No unused dependencies:** Do not add a package unless it is actually imported and used.
- **Do not create summary or changelog markdown files** unless explicitly asked.

## Webapp Admin Panel Conventions

- **Primary source of admin state:** `apps/webapp/src/features/admin/context.tsx`.
	- Keep cross-tab behavior centralized here (navigation, back-trail, batch actions, modal actions).
	- When adding new admin navigation behavior, update context helpers first before patching individual tabs.

- **Back navigation behavior (detail pages):**
	- Use the context back-trail flow (`backTrail`, `goBackFromTrail`) rather than ad-hoc `navigate(-1)` or hardcoded paths.
	- Preserve smooth detail transitions by hydrating target detail state before navigating when possible.
	- Avoid introducing one-frame flashes by rendering detail pages route-aware in `apps/webapp/src/pages/AdminPanel.tsx`.

- **DatePicker clear button policy:**
	- `DatePicker` clear control is **opt-in** via `clearable` prop.
	- Use `clearable` only for true filters (e.g., Scores date filter, Character Detail range filter).
	- Do not enable clear buttons for edit/create form pickers unless explicitly requested.

- **Table empty-state behavior (admin tabs):**
	- If a table has no results, show icon + empty-state copy, not column headers.
	- Keep pagination visible where the UX expects persistent pagination controls (e.g., Character Detail score history).

- **Sorting behavior:**
	- Header sort interactions are 3-step: `asc -> desc -> none`.
	- Keep sort chevron transitions free of color flicker during fade-out.
	- Exceptions tab default sort should remain by character name descending (`field: "name", dir: "desc"`).

- **Data-fetching UX:**
	- Prefer cache-first hydration and background refresh for admin list data to reduce jitter.
	- Do not cache MapleStory rankings API responses unless explicitly requested.

## Naming Conventions

| Thing | Style |
|---|---|
| Files (bot) | `camelCase.js` |
| Files (webapp components) | `PascalCase.tsx` |
| Files (webapp hooks) | `camelCase.tsx`, prefixed with `use` |
| Variables / functions | `camelCase` |
| Constants | `camelCase` (SCREAMING_SNAKE_CASE only for true module-level magic values) |
| Mongoose schemas | `camelCase` variable, lowercase string model name |

## Git

- Commit messages: imperative mood, present tense (`Add`, `Fix`, `Remove`, not `Added`).
- Do not commit `.env` files, `node_modules/`, or build output (`dist/`).
