# 09-snake-game

**Estado:** Aprobado
**Dependencias:** 05-asteroides-game, 06-leaderboard-supabase
**Fecha:** 2026-06-24
**Objetivo:** Integrar el juego Snake como entrada propia en la plataforma Arcade Vault, con canvas real, HUD React sincronizado (score, pausa, game over) y comida visual usando el atlas de sprites de frutas.

---

## Scope

### Dentro del scope

- `lib/games/snake.ts` — módulo TypeScript escrito desde cero; exporta `initSnake(canvas, callbacks): SnakeController`
- `components/games/SnakeGame.tsx` — Client Component que monta el canvas, llama a `initSnake`, y hace de puente entre el módulo y la play page
- `app/games/snake/play/page.tsx` — ruta estática, play page dedicada; incluye HUD React, botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con id `snake`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 800×800 px)
- Ranking en tiempo real / realtime
- Sonido
- Niveles explícitos (la velocidad sube internamente; no se expone como stat de plataforma)
- Modos de juego alternativos (paredes infinitas, multijugador)

---

## Data Model

### Interfaz del módulo (`lib/games/snake.ts`)

```ts
export interface SnakeCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SnakeController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initSnake(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeController;
```

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'snake',
  'SNAKE',
  'Comé frutas, crecé, no te choques.',
  'Guiá tu serpiente por la grilla y devorá frutas para crecer. Cada bocado suma puntos y acelera el ritmo. El juego termina cuando chocás con la pared o con vos mismo.',
  'ARCADE',
  'cover-snake',
  'green'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican.

---

## Plan de implementación

1. **`lib/games/snake.ts`** — escribir el módulo TypeScript desde cero:
   - Inlinear el atlas de sprites como constante ES (datos de `references/source-assets/snake-assets/sprites.js`)
   - Definir `const W = 800; const H = 800; const CELL = 20; const COLS = 40; const ROWS = 40;`
   - Estado del juego en variables de closure: `body` (array de `{x,y}`), `dir`, `nextDir`, `food`, `score`, `speed`, `accum`, `paused`, `dead`
   - Cargar `fruits.png` con `new Image()`; arrancar el loop RAF dentro del `onload`
   - Comida: celda aleatoria no ocupada por el cuerpo; fruta aleatoria del atlas
   - Loop RAF con acumulador: `accum += dt`; cuando `accum >= tickInterval` ejecutar un tick y resetear `accum`
     - `tickInterval` inicial = `1 / 8` s (8 celdas/s); se reduce 0.5 c/s cada 5 frutas comidas
     - En cada tick: mover serpiente, detectar colisión con pared o cuerpo, detectar comida
     - Al comer: `score += 10`, `onScoreChange(score)`, generar nueva comida, ajustar velocidad si corresponde
     - Al morir: `dead = true`, `onGameOver(score)`, no llamar `requestAnimationFrame` de nuevo
   - Listeners de teclado removibles:
     - `window.addEventListener('keydown', handler)`
     - `GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])` con `e.preventDefault()`
     - Actualizar `nextDir`; ignorar dirección opuesta (no permitir reversión de 180°)
   - Flag `paused` interno; `pause()` lo activa, `resume()` lo desactiva y resetea `lastTime = null`
   - `destroy()` cancela el RAF pendiente (`cancelAnimationFrame(rafId)`) y elimina el listener de teclado
   - Retornar `{ pause, resume, destroy }`

2. **`components/games/SnakeGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<SnakeGameHandle, Props>` con handle `{ pause: () => void; resume: () => void }`
   - Props: `callbacks: SnakeCallbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `SnakeController`
   - `useImperativeHandle` expone `pause()` y `resume()` al padre
   - `useEffect(() => { ... }, [])` — monta `initSnake(canvasRef.current!, callbacks)`, guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={800} height={800} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/snake/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia
   - `gameRef = useRef<SnakeGameHandle>(null)` para controlar pausa/resume
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<SnakeGame key={gameKey}>`)
   - `handleSave`: llama `saveScore('snake', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona estados `saving`/`saved`
   - HUD: score, botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<SnakeGame>` va dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/snake` muestra la ficha del juego con título SNAKE y botón JUGAR AHORA
- [ ] `/games/snake/play` carga sin errores y muestra el canvas con el juego corriendo
- [ ] El HUD de React muestra el score sincronizado con el estado interno del canvas
- [ ] Comer una fruta actualiza el score en el HUD de React en tiempo real
- [ ] Las flechas del teclado mueven la serpiente sin hacer scroll de página
- [ ] La serpiente no puede revertir 180° (ignorar dirección opuesta)
- [ ] Al chocar con la pared o con sí misma aparece el modal de game over con la puntuación final
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/snake` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego desde cero (score 0, serpiente inicial)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                         | Descartada                        | Razón                                                                                  |
| ------------------------ | ----------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/snake/play/page.tsx`        | Dinámica `[id]/play/page.tsx`     | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico      |
| Comunicación juego→React | Callbacks en `initSnake`                        | Custom DOM events                 | Los callbacks son tipados, no requieren `addEventListener` en el componente            |
| HUD externo              | Solo score                                      | Score + longitud de serpiente     | La longitud es visible en el canvas; duplicarla en el HUD no agrega valor              |
| Niveles                  | Sin nivel explícito (velocidad interna)         | `onLevelChange` callback          | Snake no tiene niveles narrativos; la dificultad es continua                           |
| Reinicio                 | Remontar `<SnakeGame>` via cambio de `key`      | Función `restart()` interna       | Estado limpio sin lógica extra en el módulo                                            |
| Guardado de score        | Solo Supabase (`saveScore`)                     | localStorage                      | Persistencia real; infraestructura ya existente (spec 06)                              |
| Dependencias externas    | Atlas inlineado como constante ES en `snake.ts` | Importar `sprites.js` como módulo | El `sprites.js` usa `window.SPRITE_ATLAS` (patrón vanilla); inlinear evita globals     |
| Comida visual            | Sprites de frutas del atlas                     | Cuadrado de color sólido          | Los assets ya existen y enriquecen visualmente el juego sin costo extra                |
| Sonido                   | Fuera de scope                                  | —                                 | Requiere manejo de assets en Next.js; complejidad no justificada para esta integración |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar el id de `requestAnimationFrame` y cancelarlo en `destroy()`.

- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin llamar `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.

- **Inicialización asíncrona:** `initSnake` arranca el loop dentro del `onload` de `fruits.png`; el controller se construye y retorna desde ahí. El componente React debe tolerar que el canvas no empiece a renderizar de inmediato. Mitigación: el `useEffect` no asume inicialización síncrona; el cleanup verifica que el controller exista antes de llamar `destroy()`.

- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/snake/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/snake/play` resuelve al archivo estático y que los demás juegos siguen resolviendo al placeholder dinámico.

- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 800×800 px. En pantallas más pequeñas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
