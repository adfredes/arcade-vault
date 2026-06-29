# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## CRITICAL: Next.js version

This project runs **Next.js 16.2.9 + React 19**. Per `AGENTS.md`, this version has breaking changes vs. older Next.js. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code** (App Router lives under `01-app`). Do not rely on training-data conventions; heed deprecation notices.

## Styles

Usa siempre /frontend-design para diseñar la interfaz de usuario.

## Architecture

Arcade Vault: a platform to play canvas games online and compete for high scores. Playable games: **Asteroides, Tetris, Arkanoid, Snake, Frogger**. (see `references/implemented-games.md` for the authoritative catalog of implemented games)

- **App Router** in `app/` (`layout.tsx` = root layout, `page.tsx` = routes). No `src/` or `pages/` dir.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (`postcss.config.mjs`); global styles in `app/globals.css` (incl. CRT shell `.crt*` and `.cover-*` game cover classes). No `tailwind.config` file — v4 is config-via-CSS.
- **TypeScript strict mode**; path alias `@/*` maps to the repo root.
- Fonts loaded through `next/font/google` (Geist) in the root layout.
- **Supabase** (`@supabase/ssr`) for leaderboards. Browser client `lib/supabase/client.ts`, server client `lib/supabase/server.ts`. Tables `games` + `scores`. Env in `.env.local` (`.env.template` documents keys). `lib/data.ts` is empty — leaderboard data comes from Supabase, not local data.
- **Resend** for the `/about` contact form (`app/api/contact/route.ts`).
- **Shared game components** in `components/games/`: `SkinSelector.tsx` (runtime skin switch, persisted in `localStorage` key `arcade-skin`, default `classic`) and `VirtualGamepad.tsx` (mobile touch controls — D-pad + A/B mapped via a per-game `GamepadConfig`). Skin palettes live in `lib/games/skins.ts`.

### Routes

- `/` home landing, `/games` grid, `/games/[id]` game detail + leaderboard, `/hall-of-fame`, `/about`, `/auth`.
- Each game has a **static** play route `app/games/<id>/play/page.tsx` (takes priority over the dynamic `app/games/[id]/play/page.tsx` placeholder).

### Game integration pattern (canvas vanilla → React)

1. `lib/games/<id>.ts` — TS module adapted from vanilla `game.js`; exports `init<Game>(canvas, callbacks): <Game>Controller` (`{ pause, resume, destroy }`). State in closures, removable `window` keyboard listeners, RAF loop with dt clamp, callbacks for `onScoreChange`/`onGameOver`/etc. (One naming exception: id `asteroides` → module `lib/games/asteroids.ts`.)
2. `components/games/<Game>Game.tsx` — `'use client'` component, `forwardRef` exposing `pause`/`resume`, mounts canvas + calls `init<Game>` in `useEffect`, calls `controller.destroy()` on cleanup.
3. `app/games/<id>/play/page.tsx` — `'use client'` play page: React HUD, pause/exit buttons, restart via `key` remount, game-over modal saving via `saveScore` (`lib/supabase/saveScore.ts`).

Leaderboard helpers live in `lib/supabase/queries.ts` (`getAllGames`, `getGame`, `getTopScores`, `getGameStats`); writes in `lib/supabase/saveScore.ts`.

## Workflow conventions

Per `README.md`, this project follows **Spec Driven Design** using the `/spec` and `/spec-impl` skills from `Klerith/fernando-skills`. Prefer writing/iterating a spec before implementation. Specs live in `specs/NN-<name>.md`.

Always design UI with **`/frontend-design`**.

### Project agents (`.claude/agents/`)

Each agent works on **one game at a time** and writes its own state file under `references/`. See the linked `.md` for full scope, constraints, and the files it touches.

- **game-planner** — decides which game to add next; analyzes the catalog, keeps the suggestions TODO `references/game-suggetions-todo.md`, hands off to `/nuevo-juego`. Spec-only, no code. → `.claude/agents/game-planner.md`
- **game-jam** — for a game you already chose, generates 2-3 complete **variant** specs under `specs/game-jam/<id>/`. Spec-only, no code. → `.claude/agents/game-jam.md`
- **skin-designer** — adds neon/retro/clásico skins to a game (palettes in `lib/games/skins.ts` + global `SkinSelector`); records in `references/game-with-theme.md`. Edits code. → `.claude/agents/skin-designer.md`
- **mobile-porter** — ports a game to mobile per `specs/10-mobile-touch-controls.md` (`VirtualGamepad`, scaled canvas, mobile footer); records in `references/mobile-ported.md`. Edits the play page + `*Game.tsx` only. → `.claude/agents/mobile-porter.md`
- **game-performance-booster** — optimizes a game's FPS against the `specs/12-frogger-performance.md` checklist (ref+DOM HUD, imperative pause, glow, dt clamp, clean `destroy()`); records in `references/performance-optimized.md`. Never touches game logic. → `.claude/agents/game-performance-booster.md`

### Project skills (`.claude/skills/`)

- **`/nuevo-juego <source>`** — inspects a vanilla `game.js` (from `references/started-games/`) and generates a `specs/NN-<id>-game.md` for `/spec-impl`. Spec-only, no code. → `.claude/skills/nuevo-juego/`
- **`/spec-impl-game <NN-spec-name>`** — implements an approved game spec end to end (wraps `/spec-impl`), then chains `skin-designer` → `mobile-porter` over the new game on the same branch. → `.claude/skills/spec-impl-game/`

### Tooling

- A **PostToolUse hook** (`.claude/hooks/format-and-lint.mjs`) auto-runs Prettier (`--write`) and ESLint (`--fix`) on every file touched by Write/Edit/MultiEdit. No need to format manually.
- MCP servers configured (`.mcp.json` / session): **Supabase** (schema/SQL/migrations) and **Playwright**.
