# Saku Webapp — Copilot Instructions

## Overview

A React dashboard that displays culvert score stats and character profiles for the MapleStory guild *Saku*. It fetches data from the bot's Express API (`localhost:3000/api`).

## Language & Tooling

- **TypeScript** + **TSX** — all component and hook files must be typed.
- **Vite** as the build tool and dev server (port 5173 by default).
- **ESLint v9** with flat config (`eslint.config.js`) — no `.eslintrc` files.
- No server-side rendering; this is a pure client-side SPA.

## Key Dependencies

| Package | Purpose |
|---|---|
| `react` / `react-dom` v18 | UI framework |
| `tailwindcss` | Utility-first styling (see custom theme below) |
| `class-variance-authority` | Component variant definitions via `cva()` |
| `clsx` + `tailwind-merge` | Combined via the `cn()` helper in `src/lib/utils.tsx` |
| `recharts` | Charts — `AreaChart` used for culvert score graphs |
| `axios` | HTTP requests to the bot API |
| `dayjs` | Date formatting (extend `utc` and `updateLocale` as needed) |
| `express` | Thin API proxy server in `src/server.js` (runs on port 8000) |
| `react-icons` | Icon library — use the `Fa*` set (Font Awesome) |

## Project Structure

```
src/
├── App.tsx              # Root layout: Header + Dashboard + Footer
├── main.tsx             # React DOM entry — mounts <App />
├── global.css           # Tailwind directives + global base styles
├── server.js            # Express proxy server (port 8000)
├── assets/              # Static images and icons
├── components/          # Reusable UI components (PascalCase.tsx)
├── hooks/               # Custom React hooks (camelCase.tsx, must start with `use`)
├── lib/
│   └── utils.tsx        # cn() helper and other pure utilities
└── pages/               # Page-level components (Dashboard.tsx)
```

## Component Conventions

- **Functional components only** — no class components.
- Use arrow function syntax: `const MyComponent = () => { ... }`.
- Props interfaces are defined inline or directly above the component; prefix with the component name (e.g., `ChatMessageProps`).
- Export as named exports for components used across files; `default export` for page-level components.
- Keep components focused — extract sub-components when JSX exceeds ~80 lines.

## Styling

- **Tailwind CSS** exclusively — do not write plain CSS unless adding a global base style in `global.css`.
- Use the `cn()` helper (`src/lib/utils.tsx`) whenever classes are conditional or merged:
  ```ts
  import { cn } from "../lib/utils";
  <div className={cn("base-class", isActive && "active-class")} />
  ```
- **Custom colour tokens** (defined in `tailwind.config.js`) — always prefer these over raw Tailwind colours:

| Token | Usage |
|---|---|
| `bg-background` | Page/app background |
| `bg-panel` | Card and panel backgrounds |
| `bg-tertiary` | Subtle dividers, muted elements |
| `text-accent` | Highlighted values, scores, links |

- Use `class-variance-authority` (`cva`) for components that have multiple visual variants.

## Data Fetching

- All API calls go through custom hooks in `src/hooks/`.
- Follow the `useCharacter` pattern: `useState` for data, `useEffect` for fetching, `axios.get()` for requests.
- Base URL for the bot API: `http://localhost:3000/api`
- Always handle errors with `.catch((error) => console.error(...))` — do not swallow silently.
- Initialise state with sensible empty defaults (empty strings, `NaN` for numeric IDs, empty arrays) so the UI renders without crashing before data arrives.

## TypeScript

- Prefer explicit typing over `any` — use `unknown` when the type is genuinely unknown and narrow it.
- Type component props explicitly; avoid inferring them from usage alone.
- Type hook return values explicitly when the shape is non-trivial.
- Use `as SomeType` casts sparingly and only when TypeScript cannot infer correctly.

## Charts (Recharts)

- Use `ResponsiveContainer` to wrap every chart so it adapts to its parent's width.
- Custom tooltips should use `TooltipProps<ValueType, NameType>` from `recharts`.
- Import types from `recharts/types/...` where needed.

## Date Handling (dayjs)

- Always extend `utc` and `updateLocale` before using UTC-based or locale-dependent calculations.
- Culvert resets occur weekly — the week start day is Thursday (index 4), set via `dayjs.updateLocale`.
- Format dates as `"YYYY-MM-DD"` for internal comparisons, `"MM/DD"` for display labels.

## File & Export Naming

| Thing | Convention |
|---|---|
| Component files | `PascalCase.tsx` (e.g., `Graph.tsx`) |
| Hook files | `camelCase.tsx` with `use` prefix (e.g., `useCharacter.tsx`) |
| Utility files | `camelCase.tsx` |
| Page components | `PascalCase.tsx` in `pages/`, default export |
| Reusable components | `PascalCase.tsx` in `components/`, named export |

## What to Avoid

- Do not install `redux` or `@reduxjs/toolkit` — state is managed locally with `useState`/`useEffect`.
- Do not use the standalone `cva` package — import `cva` from `class-variance-authority`.
- Do not use `discord-oauth2` — auth is not implemented in this app.
- Do not add `--ext` flags to the ESLint script; ESLint v9 flat config handles file targeting.
