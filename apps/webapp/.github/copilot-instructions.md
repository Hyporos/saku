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
| `react-router-dom` v6 | Client-side routing (`BrowserRouter`, `Routes`, `Route`, `Navigate`) |
| `tailwindcss` | Utility-first styling (see custom theme below) |
| `class-variance-authority` | Component variant definitions via `cva()` |
| `clsx` + `tailwind-merge` | Combined via the `cn()` helper in `src/lib/utils.tsx` |
| `recharts` | Charts — `AreaChart` used for culvert score graphs |
| `axios` | HTTP requests to the bot API and auth server |
| `dayjs` | Date formatting (extend `utc` and `updateLocale` as needed) |
| `express` + `express-session` + `cors` | Auth server in `src/server.js` (port 8000) |
| `react-icons` | Icon library — use the `Fa*` set (Font Awesome) |

## Project Structure

```
src/
├── App.tsx              # Root router: AuthProvider + BrowserRouter + Routes
├── main.tsx             # React DOM entry — mounts <App />
├── global.css           # Tailwind directives + global base styles
├── server.js            # Express auth server (port 8000) — OAuth2 + session
├── assets/              # Static images and icons
├── components/          # Reusable UI components (PascalCase.tsx)
├── context/
│   └── AuthContext.tsx  # AuthProvider + AuthContext (user, isLoading)
├── hooks/               # Custom React hooks (camelCase.tsx, must start with `use`)
│   ├── useAuth.tsx      # Reads from AuthContext
│   └── useCharacter.tsx # Fetches character data from the bot API
├── lib/
│   └── utils.tsx        # cn() helper and other pure utilities
└── pages/               # Page-level components
    ├── Dashboard.tsx    # Main culvert stats page (protected)
    ├── AdminPanel.tsx   # Database CRUD panel (bee role only)
    └── Login.tsx        # Discord OAuth2 login gate
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

## Authentication

The app uses Discord OAuth2 with server-side sessions. The flow is:

1. Unauthenticated users are redirected to `/login`.
2. Clicking "Login with Discord" hits `GET http://localhost:8000/auth/login` which redirects to Discord.
3. Discord returns to `GET http://localhost:8000/auth/callback` with the authorization code.
4. The server exchanges the code, fetches the user's guild member info, checks roles, and sets a session cookie.
5. The React app calls `GET /auth/me` (with credentials) on mount via `AuthProvider`.

**Role access rules:**
- **Guest** (role `720006084252663868`) → denied; redirected to `/login?error=guest`
- **Member** (guild member without guest/bee role) → dashboard access
- **Bee** (role `720001044746076181`) → dashboard + admin panel

**Key auth files:**
- `src/server.js` — OAuth2 endpoints: `/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`
- `src/context/AuthContext.tsx` — provides `{ user: AuthUser | null, isLoading: boolean }`
- `src/hooks/useAuth.tsx` — `useContext(AuthContext)` shorthand

**Always** pass `{ withCredentials: true }` to axios calls to `/auth/*` endpoints so the session cookie is sent cross-origin.

## Routing

React Router v6 (`BrowserRouter`). Routes:

| Path | Component | Protection |
|---|---|---|
| `/login` | `Login` | Public (redirects away if already authed) |
| `/` | `Dashboard` | Any authenticated guild member |
| `/admin` | `AdminPanel` | Bee role only |
| `*` | — | Redirects to `/` |

`ProtectedRoute` in `App.tsx` handles auth gating. Always use it for new protected routes.

## Admin Panel

The admin panel (`/admin`) is a detailed placeholder UI that will be wired to the bot's REST API at `http://localhost:3000/api/admin/**` once auth middleware is added to the bot.

Sections mirror the MongoDB schemas exactly:
- **Users** (`culvertSchema`) — graphColor, character list
- **Characters** (embedded in culvertSchema) — name, class, level, memberSince, avatar
- **Scores** (embedded in characters) — date, score
- **Events** (`eventSchema`) — mobcount
- **Exceptions** (`exceptionSchema`) — name, exception text

The edit/create drawer (`DrawerState`) is the single UI affordance for all writes. All write calls are stubbed with `console.log("TODO: ...")` until the bot's admin middleware is implemented.

## AppLayout

`AppLayout` in `App.tsx` uses `flex flex-col h-dvh` with `<div className="flex flex-1 min-h-0">` for the content slot. All page components must work within this flex container. Use `flex flex-1 min-h-0` on the outermost element of pages that should fill the remaining height (e.g. `AdminPanel`).

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
