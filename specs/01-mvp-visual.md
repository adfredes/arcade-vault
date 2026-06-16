# 01-mvp-visual

**Estado:** Approved
**Dependencias:** ninguna (primer spec del proyecto)
**Fecha:** 2026-06-16
**Objetivo:** Implementar las 5 pantallas visuales del MVP de Arcade Vault en Next.js App Router como componentes TypeScript, portando los templates JSX con routing por archivos, sin implementar ningún juego real.

---

## Scope

### Dentro del scope

- `lib/data.ts` — port TypeScript de data.jsx (tipos Game, CATS, PLAYERS, seededScores)
- `context/UserContext.tsx` — User type, UserProvider con localStorage, hook useUser
- `app/layout.tsx` — actualizar: fuentes (Press Start 2P, Courier Prime, JetBrains Mono), UserProvider, divs `.av-bg` / `.av-noise`, Nav, footer
- `components/Nav.tsx` — navbar sticky + menú mobile hamburger
- `app/page.tsx` — pantalla Biblioteca (hero, búsqueda, chips de categoría, grilla de cards)
- `components/GameCard.tsx` — tarjeta de juego con tilt 3D on-hover
- `app/games/[id]/page.tsx` — pantalla Detalle (cover CSS, stats, leaderboard lateral, CTAs)
- `app/games/[id]/play/page.tsx` — pantalla Reproductor (CRT con arena animada CSS placeholder, HUD, pause, modal game-over con guardado de score en localStorage)
- `app/auth/page.tsx` — pantalla Auth (tabs login/registro, formulario mock, jugar como invitado)
- `app/hall-of-fame/page.tsx` — pantalla Salón de la Fama (podio top-3, tabla completa, selector de juego por tabs)

### Fuera del scope

- Implementación de ningún juego real (canvas, lógica de gameplay)
- Backend o base de datos (auth real, scores persistidos en servidor)
- Botones de Google/GitHub (aparecen en UI pero sin funcionalidad)
- Página de error 404 / loading states personalizados
- Tests automatizados

---

## Data Model

### `lib/data.ts`

```ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string; // clase CSS: 'cover-bricks', 'cover-tetro', etc.
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  best: number;
  plays: string;
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export const GAMES: Game[] = [
  /* 8 juegos del template */
];
export const CATS: string[] = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'];
export const PLAYERS: string[] = [
  /* 18 nicks del template */
];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

### `context/UserContext.tsx`

```ts
export type User = { name: string };

// Provider: persiste en localStorage bajo la clave 'av_user'
// Hook: useUser() → { user: User | null, login(u: User): void, signOut(): void }
```

### localStorage (claves)

| Clave       | Contenido                                                          |
| ----------- | ------------------------------------------------------------------ |
| `av_user`   | `User` serializado como JSON o `null`                              |
| `av_scores` | `Array<{ game: string, score: number, name: string, at: number }>` |

---

## Plan de implementación

1. **`lib/data.ts`** — port TypeScript de data.jsx con tipos Game, ScoreRow, constantes GAMES, CATS, PLAYERS y función seededScores. Sin dependencias.

2. **`context/UserContext.tsx`** — UserProvider + hook useUser con localStorage. Marcar `'use client'`.

3. **`app/layout.tsx`** — agregar fuentes via next/font/google (Press Start 2P, Courier Prime, JetBrains Mono), envolver children en UserProvider, añadir divs `.av-bg` y `.av-noise`, Nav y footer. Exponer variables de fuente como CSS custom properties `--font-press-start`, `--font-jetbrains-mono`, `--font-courier-prime` para que globals.css las consuma.

4. **`components/Nav.tsx`** — navbar con logo, links desktop, coin counter, botón auth/signout, hamburger + panel mobile. Navegación via next/navigation (`useRouter`, `usePathname`). Marcar `'use client'`.

5. **`app/page.tsx`** + **`components/GameCard.tsx`** — pantalla Biblioteca completa: hero con flicker, buscador, chips de categoría, grilla de cards con tilt 3D. Todo client component.

6. **`app/games/[id]/page.tsx`** — pantalla Detalle: leer params con `await params` (Next.js 16), cover CSS, tags, título neon, descripción, stat-strip, botones JUGAR/VOLVER, leaderboard lateral con seededScores.

7. **`app/games/[id]/play/page.tsx`** — pantalla Reproductor: HUD (jugador, puntuación, vidas, nivel), CRT con arena CSS animada (grid-floor, player-ship, 3 enemies), botones pausa/fin/salir, modal game-over con input de iniciales y guardado en localStorage. Puntuación sube automáticamente via setInterval mientras no esté pausado ni terminado.

8. **`app/auth/page.tsx`** — pantalla Auth: tabs login/registro, campos usuario/email/password, botón submit (mock: llama login() y redirige a `/`), botón invitado, botones sociales decorativos.

9. **`app/hall-of-fame/page.tsx`** — pantalla Salón de la Fama: header, tabs por juego (chips), podio top-3 (gold/silver/bronze), tabla completa con animación rise, fila resaltada del usuario si está logueado.

---

## Criterios de aceptación

- [ ] `/` muestra hero con título flickering, buscador, 5 chips de categoría y las 8 game cards con cover CSS generado
- [ ] Filtrar por categoría o texto en buscador actualiza la grilla en tiempo real
- [ ] Hacer hover en una card activa el efecto tilt 3D
- [ ] Clicar una card o botón JUGAR navega a `/games/[id]`
- [ ] `/games/[id]` muestra cover CSS 16:10, tags, título neon, descripción, stat-strip (partidas / mejor global / dificultad) y leaderboard lateral con 10 filas seeded
- [ ] Botón "JUGAR AHORA" navega a `/games/[id]/play`
- [ ] Botón "VOLVER AL VAULT" navega a `/`
- [ ] `/games/[id]/play` muestra HUD con jugador, puntuación subiendo cada 220ms, vidas (♥ ♥ ♥) y nivel
- [ ] Botón PAUSA detiene el contador y muestra overlay "EN PAUSA"; REANUDAR lo reanuda
- [ ] Botón FIN abre modal game-over con puntuación final e input de iniciales
- [ ] Guardar puntuación persiste en `av_scores` en localStorage y muestra confirmación typewriter
- [ ] `/auth` muestra tabs LOGIN / CREAR CUENTA con los campos correctos por tab
- [ ] Submit en auth llama login(), guarda usuario en localStorage y redirige a `/`
- [ ] "JUGAR COMO INVITADO" cierra sesión (user null) y redirige a `/`
- [ ] Nav muestra nombre de usuario logueado o botón "Iniciar Sesión"
- [ ] `/hall-of-fame` muestra podio 3 slots (gold / silver / bronze) y tabla con 12 filas animadas
- [ ] Selector de tabs en Salón cambia el juego y regenera podio + tabla
- [ ] Si hay usuario logueado, aparece su fila resaltada en amarillo al final
- [ ] Nav es sticky, responsive; en mobile muestra hamburger que abre panel lateral
- [ ] Fondo con grid perspectiva + scanlines + noise visible en todas las rutas
- [ ] `tsc --noEmit` sin errores

---

## Decisiones tomadas y descartadas

| Decisión             | Elegida                                         | Descartada                  | Razón                                                                                 |
| -------------------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Routing              | Next.js App Router con rutas de archivo         | Hash routing del template   | Idiomático para Next.js 16; habilita SSR/RSC en el futuro                             |
| Estilos              | globals.css ya migrado + Tailwind para lo nuevo | Reescribir en Tailwind v4   | Evita reescribir 950 líneas de CSS ya funcional y bien diseñado                       |
| User state           | React Context + localStorage                    | Props drilling / Zustand    | Suficiente para MVP sin dependencias extra                                            |
| Pantalla Reproductor | Arena CSS animada copiada del template          | Placeholder estático        | Reserva el espacio visualmente para futuros juegos reales                             |
| Auth                 | Mock frontend-only                              | NextAuth / backend real     | Fuera del scope de MVP visual                                                         |
| Componentes          | Todos `'use client'` donde hay interacción      | Server Components para todo | Los 5 screens tienen estado local o eventos; no hay beneficio real de RSC en este MVP |

---

## Riesgos identificados

- **Next.js 16 async params:** En App Router de Next.js 16, `params` en rutas dinámicas es una Promise — se debe usar `await params` antes de acceder a `id`. Leer `node_modules/next/dist/docs/` antes de escribir las páginas dinámicas.

- **Fuentes Google en next/font:** Press Start 2P y Courier Prime deben estar disponibles en el catálogo de next/font/google. Si alguna no está, usar `next/font/local` con los archivos descargados manualmente.

- **CSS custom properties de fuentes:** globals.css referencia `var(--font-press-start)` etc. que next/font expone como variables CSS solo si se pasa `variable: '--font-press-start'` en la configuración de cada fuente en layout.tsx. Si se omite este paso, las fuentes no cargarán.
