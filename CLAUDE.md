# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## CRITICAL: Next.js version

This project runs **Next.js 16.2.9 + React 19**. Per `AGENTS.md`, this version has breaking changes vs. older Next.js. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code** (App Router lives under `01-app`). Do not rely on training-data conventions; heed deprecation notices.

## Styles

Usa siempre /frontend-design para diseñar la interfaz de usuario.

## Architecture

Arcade Vault: a platform to play canvas games online and compete for high scores. Playable games: **Asteroides, Tetris, Arkanoid, Snake and more**. (see references/implemented-games.md when you need to check are implemented and how to implement new ones)

- **App Router** in `app/` (`layout.tsx` = root layout, `page.tsx` = routes). No `src/` or `pages/` dir.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (`postcss.config.mjs`); global styles in `app/globals.css` (incl. CRT shell `.crt*` and `.cover-*` game cover classes). No `tailwind.config` file — v4 is config-via-CSS.
- **TypeScript strict mode**; path alias `@/*` maps to the repo root.
- Fonts loaded through `next/font/google` (Geist) in the root layout.
- **Supabase** (`@supabase/ssr`) for leaderboards. Browser client `lib/supabase/client.ts`, server client `lib/supabase/server.ts`. Tables `games` + `scores`. Env in `.env.local` (`.env.template` documents keys). `lib/data.ts` is empty — leaderboard data comes from Supabase, not local data.
- **Resend** for the `/about` contact form (`app/api/contact/route.ts`).

### Routes

- `/` home landing, `/games` grid, `/games/[id]` game detail + leaderboard, `/hall-of-fame`, `/about`, `/auth`.
- Each game has a **static** play route `app/games/<id>/play/page.tsx` (takes priority over the dynamic `app/games/[id]/play/page.tsx` placeholder).

### Game integration pattern (canvas vanilla → React)

1. `lib/games/<id>.ts` — TS module adapted from vanilla `game.js`; exports `init<Game>(canvas, callbacks): <Game>Controller` (`{ pause, resume, destroy }`). State in closures, removable `window` keyboard listeners, RAF loop with dt clamp, callbacks for `onScoreChange`/`onGameOver`/etc.
2. `components/games/<Game>Game.tsx` — `'use client'` component, `forwardRef` exposing `pause`/`resume`, mounts canvas + calls `init<Game>` in `useEffect`, calls `controller.destroy()` on cleanup.
3. `app/games/<id>/play/page.tsx` — `'use client'` play page: React HUD, pause/exit buttons, restart via `key` remount, game-over modal saving via `saveScore` (`lib/supabase/saveScore.ts`).

Leaderboard helpers live in `lib/supabase/queries.ts` (`getAllGames`, `getGame`, `getTopScores`, `getGameStats`); writes in `lib/supabase/saveScore.ts`.

## Workflow conventions

Per `README.md`, this project follows **Spec Driven Design** using the `/spec` and `/spec-impl` skills from `Klerith/fernando-skills`. Prefer writing/iterating a spec before implementation. Specs live in `specs/NN-<name>.md`.

To decide **which** game to add next, use the project agent **`game-planner`** (`.claude/agents/game-planner.md`): it analyzes the current catalog, proposes the next game with justification, and keeps a persistent suggestions TODO at `references/game-suggetions-todo.md` (so it never re-suggests an idea). It writes only that memory file — no production code — and hands off to `/nuevo-juego`.

To add a new game, use the project skill **`/nuevo-juego <source>`** (`.claude/skills/nuevo-juego/`): it inspects a vanilla `game.js` (from `references/started-games/`) and generates a `specs/NN-<id>-game.md` ready for `/spec-impl`. It writes only the spec — no production code.

To explore variants of a **game you already chose**, use the project agent **`game-jam`** (`.claude/agents/game-jam.md`): given a provided game (name, brief description, or a `references/started-games/` folder) it generates 2-3 complete **alternative variant** specs (different mechanics/scoring/difficulty) under `specs/game-jam/<game-id>/`, in the style of `specs/07-09`, for you to review and pick one for `/spec-impl`. It does **not** pick the game. It writes only specs inside `specs/game-jam/` — no production code, no SQL.

Always design UI with **`/frontend-design`**.

### Tooling

- A **PostToolUse hook** (`.claude/hooks/format-and-lint.mjs`) auto-runs Prettier (`--write`) and ESLint (`--fix`) on every file touched by Write/Edit/MultiEdit. No need to format manually.
- MCP servers configured (`.mcp.json` / session): **Supabase** (schema/SQL/migrations) and **Playwright**.
