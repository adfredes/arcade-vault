# 05-asteroides-game

**Estado:** IMplementado
**Dependencias:** 01-mvp-visual (globals.css, clases CSS), 02-home-landing (GAMES, rutas /games)
**Fecha:** 2026-06-17
**Objetivo:** Integrar el juego Asteroides como entrada propia en la plataforma Arcade Vault,
con canvas real, HUD doble (canvas interno + React externo) y sincronización bidireccional
de estado (score, vidas, nivel, pausa, game over) entre el módulo de juego y React.

---

## Scope

### Dentro del scope

- `lib/data.ts` — agregar entrada nueva con `id: 'asteroides'` al array `GAMES`
- `lib/games/asteroids.ts` — módulo TypeScript adaptado de `game.js`; exporta
  `initAsteroids(canvas, callbacks): AsteroidsController`
- `app/games/asteroides/play/page.tsx` — ruta estática, play page dedicada para
  este juego; incluye HUD de React (score, vidas, nivel), botón pausa y modal de
  game over con guardado en localStorage
- `components/games/AsteroidsGame.tsx` — Client Component que monta el canvas,
  llama a `initAsteroids`, y hace de puente entre el módulo de juego y la play page

### Fuera del scope

- La entrada `rocas` en `GAMES` no se modifica ni elimina
- `app/games/[id]/page.tsx` no se toca — la ruta `/games/asteroides` cae en ese
  handler dinámico y muestra la ficha del juego correctamente
- `app/games/[id]/play/page.tsx` (placeholder genérico) no se modifica
- Controles táctiles / mobile
- Guardado de puntajes en Supabase (localStorage únicamente en esta spec)
- Ranking en tiempo real
- Sonido (el `game.js` de referencia tampoco tiene)

---

## Data Model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: 'asteroides',
  title: 'ASTEROIDES',
  short: 'Pulveriza rocas en gravedad cero.',
  long: 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge power-ups de triple disparo y sobrevive el mayor tiempo posible.',
  cat: 'SHOOTER',
  cover: 'cover-rocas',
  color: 'yellow',
  best: 0,
  plays: '0',
}
```

### Interfaz del módulo (`lib/games/asteroids.ts`)

```ts
export interface AsteroidsCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initAsteroids(canvas: HTMLCanvasElement, callbacks: AsteroidsCallbacks): AsteroidsController;
```

### localStorage

Clave existente `av_scores`; se agrega entrada con `{ game: 'asteroides', score, name, at }`.
No se crea ninguna clave nueva.

---

## Plan de implementación

1. **Agregar entrada en `lib/data.ts`** — insertar el objeto `asteroides` en el array `GAMES`.

2. **Crear `lib/games/asteroids.ts`** — adaptar `game.js` al módulo TypeScript:
   - Reemplazar globals de canvas/ctx por parámetros recibidos en `initAsteroids`
   - Añadir parámetro `paused: boolean` interno; `pause()` / `resume()` lo modifican
   - Llamar `callbacks.onScoreChange(score)` cada vez que `score` cambia
   - Llamar `callbacks.onLivesChange(lives)` cada vez que `lives` cambia
   - Llamar `callbacks.onLevelChange(level)` cada vez que sube de nivel
   - Llamar `callbacks.onGameOver(score)` en lugar de mostrar overlay de reinicio;
     el loop se detiene (no llama a `requestAnimationFrame` de nuevo)
   - `destroy()` cancela el `requestAnimationFrame` pendiente y elimina los
     listeners de teclado
   - Retornar `{ pause, resume, destroy }`

3. **Crear `components/games/AsteroidsGame.tsx`** — Client Component:
   - Renderiza `<canvas width={800} height={600} />`
   - `useEffect` monta `initAsteroids(canvasRef.current, callbacks)` y guarda
     el controller en un ref
   - Expone `pause()` / `resume()` al padre via `useImperativeHandle`
   - Cleanup del `useEffect`: llama `controller.destroy()`

4. **Crear `app/games/asteroides/play/page.tsx`** — play page dedicada:
   - Estado React: `score`, `lives`, `level`, `paused`, `over`, `finalScore`,
     `playerName`, `saved`
   - Renderiza el HUD externo (score, vidas, nivel) + botón PAUSA + botón SALIR
   - Renderiza `<AsteroidsGame>` pasando los callbacks que actualizan el estado React
   - Al recibir `onGameOver`: setea `over = true`, `finalScore`; el juego ya detuvo
     su loop
   - Botón PAUSA llama a `controller.pause()` / `controller.resume()` y actualiza
     `paused`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar
     en localStorage, botón JUGAR DE NUEVO (remonta el componente via key), botón
     VOLVER AL VAULT

5. **Verificar TypeScript** — `tsc --noEmit` sin errores

---

## Criterios de aceptación

- [ ] `/games/asteroides` muestra la ficha del juego con título ASTEROIDES y botón JUGAR AHORA
- [ ] `/games/asteroides/play` carga sin errores y muestra el canvas con el juego corriendo
- [ ] El HUD de React muestra score, vidas y nivel sincronizados con el estado interno del canvas
- [ ] Destruir un asteroide actualiza el score en el HUD de React en tiempo real
- [ ] Perder una vida actualiza el contador de vidas en el HUD de React
- [ ] Subir de nivel actualiza el contador de nivel en el HUD de React
- [ ] El botón PAUSA detiene el loop del juego; el botón REANUDAR lo reanuda
- [ ] Al morir con 0 vidas aparece el modal de game over con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en localStorage
- [ ] Tras guardar, `localStorage['av_scores']` contiene la entrada con `game: 'asteroides'`
- [ ] JUGAR DE NUEVO reinicia el juego desde cero (score 0, vidas 3, nivel 1)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] `tsc --noEmit` sin errores
- [ ] Navegar a `/games/rocas` sigue funcionando (no se rompe el juego existente)

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                                           | Descartada                                 | Razón                                                                                  |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/asteroides/play/page.tsx`                     | Dinámica `[id]/play/page.tsx`              | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico      |
| Comunicación juego→React | Callbacks en `initAsteroids`                                      | Custom DOM events                          | Los callbacks son tipados, no requieren `addEventListener` en el componente ni casting |
| HUD                      | Doble (canvas interno + React externo)                            | Solo React                                 | El canvas dibuja información de juego clásica; React dibuja la capa de plataforma      |
| Pausa                    | Controlada desde React, aplicada al loop vía `controller.pause()` | Tecla del teclado dentro del juego         | El botón de la plataforma es el punto de control; consistente con otros juegos futuros |
| Reinicio                 | Remontar `<AsteroidsGame>` via cambio de `key`                    | Función `restart()` interna                | Garantiza estado limpio sin lógica extra en el módulo; React hace el trabajo           |
| Game over overlay        | Modal de React, loop detenido                                     | Overlay en canvas + ESPACIO para reiniciar | Permite guardar puntaje con nombre; consistente con la UX de la plataforma             |
| ID del juego             | `asteroides` (nuevo)                                              | Reutilizar `rocas`                         | Son entidades distintas; `rocas` es placeholder sin canvas real                        |
| Guardado                 | localStorage (`av_scores`)                                        | Supabase                                   | Supabase para scores queda para spec posterior; no bloquea esta entrega                |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela correctamente el `requestAnimationFrame`
  pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo.
  Mitigación: guardar el id retornado por `requestAnimationFrame` y cancelarlo en
  `destroy()` antes de retornar.

- **Listeners de teclado huérfanos:** El módulo agrega listeners a `window`. Si el
  componente se desmonta sin llamar `destroy()`, siguen activos y capturan teclas en
  otras páginas. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.

- **Conflicto de rutas estática vs dinámica:** Next.js App Router da prioridad a la
  ruta estática `app/games/asteroides/play/page.tsx` sobre la dinámica
  `app/games/[id]/play/page.tsx`. Verificar que `/games/asteroides/play` resuelve al
  archivo estático y que `/games/rocas/play` sigue resolviendo al placeholder dinámico.

- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 800×600.
  En pantallas < 800px desborda. Está fuera de scope pero conviene documentarlo para
  una spec futura de responsive/scaling.
