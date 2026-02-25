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
