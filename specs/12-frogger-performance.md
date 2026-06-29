# 12-frogger-performance

**Estado:** Implementado
**Dependencias:** spec más reciente con Frogger (el juego fue implementado junto con el spec 11)
**Fecha:** 2026-06-29
**Objetivo:** Eliminar los re-renders de React que degradan el FPS de Frogger extrayendo toda la lógica del juego a `lib/games/frogger.ts` y convirtiendo `FroggerGame.tsx` en un wrapper `forwardRef` delgado que sigue el patrón de Asteroides/Tetris/Arkanoid/Snake.

---

## Scope

### Dentro del scope

- **`lib/games/frogger.ts`** — nuevo módulo que contiene toda la lógica actual de `FroggerGame.tsx` (estado, update, draw, input). Exporta `initFrogger(canvas, callbacks): FroggerController` donde `FroggerController = { pause, resume, destroy, setSkin }`.
- **`components/games/FroggerGame.tsx`** — reducido a wrapper `'use client'` con `forwardRef`; monta el canvas, llama `initFrogger` en `useEffect`, expone `pause`/`resume` vía `useImperativeHandle`.
- **`app/games/frogger/play/page.tsx`** — elimina prop `paused` a `FroggerGame`; controla pausa vía `ref.current.pause()`/`resume()`; controla skin vía `ref.current.setSkin(id)`; elimina `skin` del `key`; mantiene `gameKey` solo para restart explícito.

### Fuera del scope

- Lógica de juego (velocidades, colisiones, scoring, niveles) — sin cambios.
- `VirtualGamepad`, `SkinSelector`, HUD de la play page — sin cambios.
- Otros juegos (Asteroides, Tetris, Arkanoid, Snake) — no se tocan.
- Sistema de skins (`lib/games/skins.ts`) — sin cambios.
- Base de datos / Supabase — sin cambios.
- Optimizaciones de canvas (offscreen canvas, shadowBlur caching) — fuera de scope; el refactor estructural es suficiente para resolver el problema de FPS.

---

## Data Model

### `FroggerController` (retorno de `initFrogger`)

```ts
export interface FroggerController {
  pause(): void;
  resume(): void;
  destroy(): void; // cancela RAF, remueve listener de keydown
  setSkin(id: SkinId): void; // actualiza la paleta en caliente sin resetear estado
}
```

### `FroggerCallbacks` (segundo argumento de `initFrogger`)

```ts
export interface FroggerCallbacks {
  onScoreChange(score: number): void;
  onLivesChange(lives: number): void;
  onLevelChange(level: number): void;
  onGameOver(finalScore: number): void;
}
```

### `FroggerGameHandle` (ref expuesto por `FroggerGame`)

```ts
export interface FroggerGameHandle {
  pause(): void;
  resume(): void;
}
```

> Todas las interfaces internas (Lane, Entity, Frog, GameState, etc.) permanecen en `lib/games/frogger.ts` como tipos no exportados. No se introducen tablas ni cambios en Supabase.

---

## Plan de implementación

1. **Crear `lib/games/frogger.ts`**
   - Mover todo el contenido del `useEffect` principal de `FroggerGame.tsx` (constantes, tipos, helpers, `buildLanes`, `createState`, `update`, `draw`, listener de `keydown`, loop RAF) a este módulo.
   - Firma: `initFrogger(canvas: HTMLCanvasElement, callbacks: FroggerCallbacks, initialSkin: SkinId): FroggerController`.
   - Internamente guarda `let palette = FROGGER_SKINS[initialSkin]`; `setSkin(id)` solo reasigna esa variable — el próximo frame usa la nueva paleta.
   - `destroy()` cancela RAF y remueve el listener `keydown` de `window`.
   - Sin imports de React.

2. **Reescribir `components/games/FroggerGame.tsx`**
   - `forwardRef<FroggerGameHandle, FroggerGameProps>`.
   - Props: `{ onScoreChange, onLivesChange, onLevelChange, onGameOver, skin }`. Sin `paused`.
   - `useEffect([])` llama `initFrogger` y guarda el controlador en ref interno.
   - `useEffect([skin])` llama `ctrlRef.current?.setSkin(skin)` en caliente.
   - `useImperativeHandle` expone `{ pause, resume }`.
   - Cleanup llama `ctrlRef.current?.destroy()`.
   - Retorna solo `<canvas>` con los mismos atributos de tamaño actuales.

3. **Actualizar `app/games/frogger/play/page.tsx`**

   useState que se mantiene:
   - `over`, `playerName`, `saved`, `saving`, `gameKey`, `skin`.

   Pasan a useRef + DOM directo:
   - `score`, `lives`, `level` → `scoreRef`, `livesRef`, `levelRef` + spans con ref propio; callbacks actualizan `.textContent` directamente.
   - `paused` → `pausedRef`; `togglePause` llama `gameRef.current.pause()/resume()` y actualiza `.textContent` del botón de pausa vía `pauseBtnRef`.
   - `finalScore` → `finalScoreRef`; se asigna en `onGameOver` antes de `setOver(true)`.

   Otros cambios:
   - `key={gameKey}` (sin `skin`).
   - `onGameOver` guarda en `finalScoreRef.current` y llama `setOver(true)` — único `setState` en el hot path del juego.
   - Los spans del HUD reciben `ref` en lugar de leer estado React.

4. **Verificar TypeScript**: `npx tsc --noEmit` sin errores.

5. **Verificación manual**:
   - DevTools → Performance → grabar 10 s de juego activo; confirmar que React no aparece como cuello de botella en el flame graph.
   - Cambiar skin en caliente: paleta cambia sin reiniciar partida.
   - Pausar/reanudar: juego se detiene y retoma correctamente.
   - Restart: `gameKey` incrementa, juego arranca desde cero.
   - Guardar capturas en `.playwright-screenshots/`.

---

## Criterios de aceptación

- [ ] `lib/games/frogger.ts` existe y exporta `initFrogger` + las interfaces `FroggerController` y `FroggerCallbacks`.
- [ ] `FroggerGame.tsx` usa `forwardRef` y no tiene prop `paused`.
- [ ] Cambiar skin en el `SkinSelector` actualiza la paleta del canvas sin reiniciar la partida (score, vidas y nivel se conservan).
- [ ] Pausar y reanudar funciona correctamente via `ref.current.pause()/resume()`.
- [ ] Restart (`gameKey++`) reinicia el juego desde cero.
- [ ] El HUD de la play page (score, vidas, nivel, botón pausa) se actualiza sin disparar re-renders de React — verificable en DevTools → Components: ningún componente parpadea en el flame graph durante juego activo.
- [ ] `onGameOver` es el único `setState` llamado desde el hot path del juego.
- [ ] `npx tsc --noEmit` sin errores.
- [ ] Las capturas de Playwright en `.playwright-screenshots/` muestran el juego funcionando en desktop y móvil.

---

## Decisiones tomadas y descartadas

| Decisión                                         | Elegida                                             | Descartada                                     | Razón                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Arquitectura del módulo de juego                 | `lib/games/frogger.ts` + wrapper `forwardRef`       | Lógica inline en el componente (estado actual) | Elimina re-renders de React en el hot path; alinea Frogger con el patrón de los demás juegos                          |
| Estado de score/lives/level                      | `useRef` + DOM directo                              | `useState`                                     | Cambian hasta 60x/s; con `useState` cada cambio dispara reconciliación React                                          |
| Control de pausa                                 | `ref.current.pause()/resume()`                      | Prop `paused`                                  | El prop obliga a re-render del componente cada vez que cambia                                                         |
| Skin en caliente                                 | `setSkin()` en el controlador + `useEffect([skin])` | `skin` en el `key` (remount)                   | Remount destruye la partida en curso; `setSkin` solo reasigna la paleta                                               |
| Optimizaciones de canvas (shadowBlur, offscreen) | Fuera de scope                                      | Incluir en este spec                           | El bottleneck identificado es React, no el canvas; optimizaciones canvas son un spec separado si persiste el problema |
| Scope de otros juegos                            | Solo Frogger                                        | Refactor simultáneo de todos los juegos        | Frogger es el único que no sigue el patrón `lib/games/`; los demás ya lo respetan                                     |
