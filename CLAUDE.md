# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## CRITICAL: Next.js version

This project runs **Next.js 16.2.9 + React 19**. Per `AGENTS.md`, this version has breaking changes vs. older Next.js. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code** (App Router lives under `01-app`). Do not rely on training-data conventions; heed deprecation notices.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm start` — serve production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)

No test runner is configured yet.

## Architecture

Arcade Vault: a platform to play games online and compete for high scores (early scaffold — `app/` still holds the default create-next-app page).

- **App Router** in `app/` (`layout.tsx` = root layout, `page.tsx` = routes). No `src/` or `pages/` dir.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (`postcss.config.mjs`); global styles in `app/globals.css`. No `tailwind.config` file — v4 is config-via-CSS.
- **TypeScript strict mode**; path alias `@/*` maps to the repo root.
- Fonts loaded through `next/font/google` (Geist) in the root layout.

## Workflow conventions

Per `README.md`, this project follows **Spec Driven Design** using the `/spec` and `/spec-impl` skills from `Klerith/fernando-skills`. Prefer writing/iterating a spec before implementation.
