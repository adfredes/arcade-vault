# 06-leaderboard-supabase

**Estado:** Implementado
**Dependencias:** 04-supabase-setup, 05-asteroides-game
**Fecha:** 2026-06-19
**Objetivo:** Crear las tablas `games` y `scores` en Supabase, seedear con Asteroides,
y conectar toda la UI para leer y escribir scores de forma persistente, reemplazando
localStorage y eliminando `lib/data.ts` por completo. El único juego disponible es Asteroides.

---

## Scope

### Dentro del scope

- Supabase migration: tablas `games` y `scores` con RLS (anon puede leer ambas,
  anon puede insertar en `scores`)
- Supabase migration adicional: columnas `long` y `cover` en la tabla `games`
- Seed completo: 1 registro en `games` (asteroides) con todos los campos, ejecutado en la misma migration
- `lib/supabase/queries.ts` (nuevo) — helpers tipados: `getGame`, `getAllGames`,
  `getTopScores`, `saveScore`, `getGameStats`
- `components/GameCard.tsx` — usar tipo `Game` de `@/lib/supabase/queries`; eliminar campo `best` del display
- `app/games/asteroides/play/page.tsx` — reemplazar guardado en localStorage por
  `saveScore` vía Supabase browser client
- `app/games/[id]/page.tsx` — leer juego, top 10 scores y stats desde Supabase;
  eliminar uso de `lib/data.ts`
- `app/games/page.tsx` — convertir a Server Component; extraer filtro/búsqueda a
  `components/GamesGrid.tsx` (Client Component); leer juegos desde `getAllGames()`
- `app/page.tsx` — convertir a Server Component; extraer side-effects a
  `components/HomeReveal.tsx` (Client Component); leer juegos desde `getAllGames()`
  para el mini-rail; reemplazar `MiniCard.onClick(router)` por `<Link>`
- `app/hall-of-fame/page.tsx` — leer tabs desde tabla `games`, leer podio (top 3)
  y tabla (top 10) desde tabla `scores` filtrado por juego activo
- Eliminar `lib/data.ts` una vez que ningún archivo lo importe

### Fuera del scope

- Autenticación de usuarios
- Nuevos juegos (más allá de asteroides en la DB)
- DIFICULTAD en la ficha del juego
- Migración de scores previos de localStorage (se descartan; eran placeholder)
- Realtime / live updates (los datos se cargan al montar la página)
- Paginación del Salón de la Fama (top N fijo)

---

## Data Model

### Tabla `games`

```sql
CREATE TABLE games (
  id         text PRIMARY KEY,          -- e.g. 'asteroides'
  title      text NOT NULL,             -- e.g. 'ASTEROIDES'
  short      text,
  long       text,
  cat        text,
  cover      text,                      -- CSS class, e.g. 'cover-rocas'
  color      text,
  created_at timestamptz DEFAULT now()
);
```

### Tabla `scores`

```sql
CREATE TABLE scores (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     text NOT NULL REFERENCES games(id),
  player_name text NOT NULL CHECK (char_length(player_name) <= 10),
  score       integer NOT NULL CHECK (score >= 0),
  created_at  timestamptz DEFAULT now()
);
```

### RLS policies

- `games`: SELECT abierto a `anon`
- `scores`: SELECT abierto a `anon`; INSERT abierto a `anon` (sin restricción adicional)

### Seed completo (en migration)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'asteroides',
  'ASTEROIDES',
  'Pulveriza rocas en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge power-ups de triple disparo y sobrevive el mayor tiempo posible.',
  'SHOOTER',
  'cover-rocas',
  'yellow'
);
```

### `lib/supabase/queries.ts` (tipos relevantes)

```ts
export type Game = {
  id: string;
  title: string;
  short: string | null;
  long: string | null;
  cat: string | null;
  cover: string | null;
  color: string | null;
};

export async function getGame(id: string): Promise<Game | null>;
export async function getAllGames(): Promise<Game[]>;
export async function getTopScores(
  gameId: string,
  limit?: number,
): Promise<Score[]>;
export async function saveScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<void>;
export async function getGameStats(
  gameId: string,
): Promise<{ plays: number; best: number }>;
```

---

## Plan de implementación

> Los pasos 1–6 están implementados en la rama `spec-06-leaderboard-supabase`.

1. ~~**Supabase migration** — crear tablas `games` y `scores`, activar RLS, definir
   policies anon para SELECT/INSERT, ejecutar seed básico de asteroides.~~ ✅

2. ~~**`lib/supabase/queries.ts`** — implementar los helpers tipados.~~ ✅

3. ~~**`app/games/asteroides/play/page.tsx`** — reemplazar localStorage por
   `saveScore` + loading state.~~ ✅

4. ~~**`app/games/[id]/page.tsx`** — Server Component async; `Promise.all` de
   3 queries; pasar props a sub-componentes.~~ ✅

5. ~~**`app/hall-of-fame/page.tsx`** — Server Component async; tabs dinámicos;
   podio y tabla reales.~~ ✅

6. ~~**Verificar TypeScript** — `tsc --noEmit` sin errores.~~ ✅

7. **Supabase migration adicional** — agregar columnas `long` y `cover` a la tabla
   `games`; actualizar el registro de asteroides con los valores completos.

8. **Actualizar `lib/supabase/queries.ts`** — añadir `long` y `cover` al tipo `Game`
   y a los selects de `getGame` y `getAllGames`.

9. **`components/GameCard.tsx`** — importar tipo `Game` desde
   `@/lib/supabase/queries`; eliminar el campo `best` del display (era placeholder).

10. **`app/games/page.tsx`** — convertir a Server Component async; extraer
    búsqueda/filtro a `components/GamesGrid.tsx` (Client Component que recibe
    `games: Game[]` como prop); leer juegos con `getAllGames()`.

11. **`app/page.tsx`** — convertir a Server Component async; extraer el
    `useEffect` de IntersectionObserver a `components/HomeReveal.tsx` (Client
    Component de solo side-effect, sin UI propia); reemplazar `MiniCard.onClick`
    por `<Link>`; leer juegos con `getAllGames()` para el mini-rail.

12. **Eliminar `lib/data.ts`** — verificar que ningún archivo lo importe y borrar.

13. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [x] Las tablas `games` y `scores` existen en Supabase con RLS activado
- [x] La tabla `games` tiene exactamente 1 registro: `asteroides`
- [x] Al hacer game over en Asteroides, el score se guarda en Supabase (no en localStorage)
- [x] El modal de game over muestra estado loading mientras guarda y confirma al resolver
- [x] `/games/asteroides` muestra el top 10 de scores reales de Supabase en el panel lateral
- [x] `/games/asteroides` muestra PARTIDAS (COUNT) y MEJOR GLOBAL (MAX) calculados de Supabase
- [x] El Salón de la Fama muestra tabs de juegos desde la tabla `games` (solo ASTEROIDES por ahora)
- [x] El Salón de la Fama muestra podio (top 3) y tabla (top 10) con datos reales de Supabase
- [x] Cambiar el tab de juego en el Salón de la Fama actualiza el podio y la tabla
- [x] Un score guardado desde Asteroides aparece en el leaderboard lateral y en el Salón de la Fama al recargar la página
- [ ] La tabla `games` tiene columnas `long` y `cover` con datos de asteroides
- [ ] `GameCard` usa el tipo `Game` de `@/lib/supabase/queries` (sin `best`)
- [ ] `/games` muestra solo Asteroides, leyendo desde Supabase
- [ ] La home (`/`) muestra solo Asteroides en el mini-rail, leyendo desde Supabase
- [ ] `lib/data.ts` eliminado; ningún archivo lo importa
- [ ] `tsc --noEmit` sin errores
- [ ] `/games/asteroides` y la home (`/`) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                                   | Elegida                                                                       | Descartada                          | Razón                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| Fuente de datos UI                         | Supabase (seed desde `lib/data.ts`)                                           | `lib/data.ts` directo               | Persistencia real entre dispositivos                                              |
| Auth para scores                           | Anónimo (nombre libre, sin cuenta)                                            | Autenticación de usuarios           | Auth no implementada; no bloquea la entrega                                       |
| Guardado de scores                         | Solo Supabase                                                                 | Supabase + localStorage             | Evita duplicación; scores previos eran placeholder                                |
| Tabs del Salón de la Fama                  | Dinámicos desde tabla `games`                                                 | Hardcodeados en UI                  | Al agregar un juego en la DB aparece automáticamente                              |
| Scores mostrados                           | Top 10 en leaderboard lateral; top 3 podio + top 10 tabla en Salón de la Fama | Paginación                          | Suficiente para la experiencia actual                                             |
| Cambio de juego activo en Salón de la Fama | Search param `?game=`                                                         | Estado client-side                  | Permite compartir URL directa al juego; compatible con Server Components          |
| Eliminación de `lib/data.ts`               | Sí, eliminado                                                                 | Mantener como fallback              | El usuario confirmó que solo Asteroides está disponible; datos reales en Supabase |
| Side-effects en home page                  | `HomeReveal.tsx` Client Component de solo side-effect                         | Mantener home como Client Component | Permite home como Server Component con fetch de Supabase                          |
| `best` en GameCard                         | Eliminado del display                                                         | Derivado de scores                  | Evita N+1 queries en la lista; detalle de scores en la ficha del juego            |

---

## Riesgos identificados

- **RLS mal configurado:** Si la policy anon no incluye INSERT en `scores`, el guardado
  falla silenciosamente en producción. Mitigación: verificar desde el dashboard de Supabase
  que un INSERT anónimo en `scores` retorna 201 antes de cerrar la implementación.

- **Latencia en game over:** Guardar en Supabase es async; una red lenta podría dejar al
  usuario sin feedback. Mitigación: deshabilitar el botón de confirmación y mostrar loading
  hasta que la promesa resuelva (paso 3 del plan).

- **`app/games/[id]/page.tsx` es dinámico:** Si Next.js cachea esta página agresivamente,
  un score recién guardado podría no aparecer en el leaderboard lateral hasta que expire
  el caché. Mitigación: usar `revalidate = 0` en los fetches de scores.

- **Scores de localStorage descartados:** Los scores previos no se migran. Decisión
  acordada explícitamente — eran datos placeholder.
