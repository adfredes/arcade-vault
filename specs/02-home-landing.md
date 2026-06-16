# 02-home-landing

**Estado:** Implemented
**Dependencias:** 01-mvp-visual (lib/data.ts, components/Nav.tsx, globals.css)
**Fecha:** 2026-06-16
**Objetivo:** Convertir `/` en el landing page de Arcade Vault portando `home.jsx`,
mover la Biblioteca a `/games`, y actualizar la navegación.

---

## Scope

### Dentro del scope

- `app/page.tsx` — reemplazar con el Home landing (7 secciones del template)
- `app/games/page.tsx` — nuevo archivo; contenido actual de `app/page.tsx` (Biblioteca) movido aquí
- `components/Nav.tsx` — actualizar links: "Inicio" → `/`, "Biblioteca" → `/games`
- Sub-componentes inline en `app/page.tsx`: `FloatingSilhouettes`, `FeatureIcon`, `MiniCard`, `useReveal`
- Datos de actividad como constantes mock inline (no conectados a lib/data.ts)

### Fuera del scope

- `app/about/page.tsx` (queda pendiente para spec futuro)
- Actividad en vivo real (API, websockets, polling)
- Animación de contador numérico en la sección Stats
- Cualquier cambio a las demás rutas (`/games/[id]`, `/auth`, `/hall-of-fame`)

---

## Data Model

No se introducen estructuras nuevas. El Home consume datos existentes y constantes inline:

- `GAMES` de `lib/data.ts` — se usan los primeros 6 para el mini-rail de preview
- Constantes mock inline en `app/page.tsx` para la sección "Actividad en vivo":

```ts
const RECENT_SCORES = [
  { player: 'NEONFOX', game: 'Caída', score: 184220, time: 'hace 2 min', color: 'magenta' },
  { player: 'PX_KAI', game: 'Glotón', score: 96400, time: 'hace 5 min', color: 'yellow' },
  { player: 'Z3R0COOL', game: 'Invasores', score: 54190, time: 'hace 8 min', color: 'green' },
  { player: 'VAULT_07', game: 'Rocas', score: 41200, time: 'hace 12 min', color: 'cyan' },
  { player: 'GLITCHA', game: 'Bloque Buster', score: 28450, time: 'hace 18 min', color: 'cyan' },
  { player: 'ARKADYA', game: 'Serpentina', score: 7820, time: 'hace 24 min', color: 'green' },
  { player: 'CYBER_LU', game: 'Ranaria', score: 18900, time: 'hace 31 min', color: 'yellow' },
];

const TOP_PLAYERS = [
  { rank: 1, player: 'NEONFOX', score: 312840 },
  { rank: 2, player: 'PX_KAI', score: 248110 },
  { rank: 3, player: 'M00NRYU', score: 196720 },
  { rank: 4, player: 'VAULT_07', score: 154300 },
  { rank: 5, player: 'GLITCHA', score: 138900 },
];
```

---

## Plan de implementación

1. **Mover Biblioteca a `/games`** — copiar el contenido actual de `app/page.tsx`
   a `app/games/page.tsx` sin modificaciones. Verificar que la ruta `/games` renderiza
   correctamente antes de continuar.

2. **Actualizar `components/Nav.tsx`** — cambiar el href de "Biblioteca" de `/` a `/games`;
   actualizar la lógica `isActive` para que "Inicio" sea activo en `/` y "Biblioteca"
   sea activo en `/games` y `/games/[id]`.

3. **Crear `app/page.tsx` (Home)** — implementar las 7 secciones en orden:
   - Hero: `FloatingSilhouettes` (SVGs pixel inline), eyebrow con blink, título en 3 líneas,
     subtítulo, dos CTAs (`/games` y `/auth`), scroll hint
   - Why: 4 feature cards con `FeatureIcon` (SVGs pixel inline)
   - Games Preview: `MiniCard` rail con `GAMES.slice(0, 6)`, botón "VER TODOS" → `/games`
   - Stats: 3 bloques estáticos (12+ juegos / Miles de partidas / Global ranking)
   - Actividad en vivo: ticker de `RECENT_SCORES` + top list de `TOP_PLAYERS` (constantes inline)
   - Precios: price card decorativa + 3 FAQ items; CTA → `/auth`
   - Final CTA: título pixel + botón → `/games`

4. **Hook `useReveal`** — definir inline en `app/page.tsx` usando `IntersectionObserver`;
   aplicar clase `.reveal` a las secciones 2–7 y `.in` al entrar al viewport.

5. **Verificar TypeScript** — correr `tsc --noEmit`; asegurar que `GAMES` se importa con
   el tipo `Game` correcto y que los colores del template (`"cyan" | "magenta" | ...`)
   coinciden con los definidos en `lib/data.ts`.

---

## Criterios de aceptación

- [ ] `/` renderiza el Home landing con las 7 secciones visibles
- [ ] Hero muestra eyebrow con cursor parpadeante, título en 3 líneas, 2 CTAs y scroll hint
- [ ] Silhouettes flotantes (8 SVGs pixel) se muestran en el hero sin interferir con el texto
- [ ] Botón "EXPLORAR JUEGOS" navega a `/games`
- [ ] Botón "CREAR CUENTA" navega a `/auth`
- [ ] Sección Games Preview muestra exactamente 6 mini cards con título y categoría
- [ ] Click en mini card navega a `/games/[id]`
- [ ] Botón "VER TODOS LOS JUEGOS" navega a `/games`
- [ ] Sección Stats muestra los 3 bloques (12+, MILES, GLOBAL)
- [ ] Sección Actividad muestra 7 filas de scores recientes y 5 top jugadores
- [ ] Sección Precios muestra price card con $0 y 3 FAQ items; CTA → `/auth`
- [ ] CTA final "INSERTAR MONEDA" navega a `/games`
- [ ] Las secciones 2–7 tienen animación reveal al entrar al viewport
- [ ] `/games` renderiza la Biblioteca (idéntica a como era `/` antes)
- [ ] Nav "Inicio" está activo en `/`; "Biblioteca" está activo en `/games` y `/games/[id]`
- [ ] `tsc --noEmit` sin errores

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                  | Descartada                          | Razón                                                                                               |
| ------------------------ | ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Ruta Biblioteca          | `/games`                 | Mantener en `/` con home en `/home` | `/` como landing es el patrón estándar para un producto; Biblioteca queda indexable en `/games`     |
| Sub-componentes del Home | Inline en `app/page.tsx` | Archivos separados en `components/` | Solo se usan en esta página; extraer sería over-engineering prematuro                               |
| Datos de actividad       | Constantes mock inline   | `seededScores()` de `lib/data.ts`   | La actividad "en vivo" tiene estructura diferente (jugador + juego + tiempo); no encaja en ScoreRow |
| `useReveal`              | Inline en `app/page.tsx` | `lib/hooks.ts`                      | Hook de una sola pantalla; moverlo sería anticipar reuso que no existe aún                          |
| About page               | Fuera de scope           | Mismo spec                          | Agrega complejidad sin bloquear el landing; se especifica aparte cuando sea necesario               |

---

## Riesgos identificados

- **Colisión de rutas `/games`:** Al agregar `app/games/page.tsx`, coexistirá con
  `app/games/[id]/page.tsx`. Next.js App Router resuelve esto correctamente (ruta estática
  tiene precedencia sobre dinámica), pero conviene verificar que `/games` carga la Biblioteca
  y `/games/arkanoid` carga el Detalle tras el paso 1.

- **`isActive` en Nav:** La lógica actual marca activo cuando `pathname === "/"` para Inicio
  y cuando `pathname.startsWith("/games")` para Biblioteca. Si no se actualiza correctamente,
  ambos pueden aparecer activos a la vez en `/games/[id]`.
