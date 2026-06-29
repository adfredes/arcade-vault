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

To add skins to an **already implemented game**, use the project agent **`skin-designer`** (`.claude/agents/skin-designer.md`): it works on **one game at a time** (the one you name) and gives it at least 3 skins — **neon, retro, and clásico (default)** — that look good in dark mode. Unlike the spec-only agents, it **edits production code**: it refactors that game's hardcoded colors into parametrizable palettes in `lib/games/skins.ts`, adds a global runtime `SkinSelector` (persisted in `localStorage`), verifies each skin visually with Playwright, and records the completed game in `references/game-with-theme.md`. It never touches game logic or games you didn't ask for.

To make an **already implemented game** playable on mobile, use the project agent **`mobile-porter`** (`.claude/agents/mobile-porter.md`): it works on **one game at a time** (the one you name, typically a newly added one) and ports it to mobile following the canonical pattern of `specs/10-mobile-touch-controls.md` — `VirtualGamepad` (D-pad + A/B with a `GamepadConfig` mapped to the game's real keys), HUD hidden on mobile (`hidden md:flex`), CSS-scaled canvas, mobile footer with PAUSA + `SkinSelector` (`flex md:hidden`), and portrait/landscape support. It **edits production code** but only that game's play page (`app/games/<id>/play/page.tsx`) and `*Game.tsx`; it reads `lib/games/<id>.ts` solely to map keys and never touches game logic. It verifies on mobile viewports with Playwright and records the completed game in `references/mobile-ported.md`. It works **only on games' play pages** — never the rest of the site.

To **optimize the performance** of an already implemented game (FPS drops, jank, re-renders), use the project agent **`game-performance-booster`** (`.claude/agents/game-performance-booster.md`): it audits and fixes **one game at a time** against the checklist derived from `specs/12-frogger-performance.md` — logic extracted to `lib/games/<id>.ts`, HUD updated via `ref+DOM` (no `useState` in the hot path), imperative pause by ref, `shadowBlur` global or offscreen glow layer, clamped `dt`, `lastTime` reset on resume, and clean `destroy()`. It **edits production code** but never touches game logic (physics, scoring, collisions). It verifies ≥ 55 fps across all skins with Playwright and records the result in `references/performance-optimized.md`.

To implement an approved game spec **end to end** in one pass, use the project skill **`/spec-impl-game <NN-spec-name>`** (`.claude/skills/spec-impl-game/`): it's a wrapper around `/spec-impl` for **games**. It runs the canonical `/spec-impl` procedure as-is (reads the installed `~/.claude/skills/spec-impl/SKILL.md` — never duplicates its logic; the "Approved" status block is intentional) to implement the spec on branch `spec-NN-slug`, then **automatically chains two agents over the just-implemented game, one after the other, never in parallel**: first `skin-designer` (neon/retro/clásico), then `mobile-porter`. It derives the game `<id>` from the spec name (`specs/NN-<id>-game.md`) and confirms it against the real artifacts (`lib/games/<id>.ts`, `app/games/<id>/play/page.tsx`); if the spec isn't a game or the id is unclear, it asks before launching any agent. Result: one game implemented, skinned, and mobile-ready on the same branch ready for PR.

Always design UI with **`/frontend-design`**.

### Tooling

- A **PostToolUse hook** (`.claude/hooks/format-and-lint.mjs`) auto-runs Prettier (`--write`) and ESLint (`--fix`) on every file touched by Write/Edit/MultiEdit. No need to format manually.
- MCP servers configured (`.mcp.json` / session): **Supabase** (schema/SQL/migrations) and **Playwright**.
