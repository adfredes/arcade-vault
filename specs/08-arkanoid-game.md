# 08-arkanoid-game

**Estado:** Implementado
**Dependencias:** 05-asteroides-game, 06-leaderboard-supabase
**Fecha:** 2026-06-24
**Objetivo:** Integrar el juego Arkanoid como entrada propia en la plataforma Arcade Vault, con canvas real, HUD doble (canvas interno + React externo) y sincronización de estado (score, vidas, nivel, pausa, game over) entre el módulo de juego y React.

---

## Scope

### Dentro del scope

- `lib/games/arkanoid.ts` — módulo TypeScript adaptado de `game.js`; exporta `initArkanoid(canvas, callbacks): ArkanoidController`
- `components/games/ArkanoidGame.tsx` — Client Component que monta el canvas, llama a `initArkanoid`, y hace de puente entre el módulo y la play page
- `app/games/arkanoid/play/page.tsx` — ruta estática, play page dedicada; incluye HUD React, botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con id `arkanoid`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 800×600 px)
- Ranking en tiempo real / realtime
- Sonido (`bounceSound`, `breakSound` del original — fuera de scope para esta integración)
- Control por mouse (la plataforma usa solo teclado; el `mousemove` no se porta)
- Selector de nivel en el overlay de pausa (feature del juego original; queda para spec futura)

---

## Data Model

### Interfaz del módulo (`lib/games/arkanoid.ts`)

```ts
export interface ArkanoidCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface ArkanoidController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initArkanoid(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
): ArkanoidController;
```

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'arkanoid',
  'ARKANOID',
  'Rompe todos los bloques antes de perder la pelota.',
  'Controla la paleta para mantener la pelota en juego y destruir todos los bloques del nivel. Cinco niveles con formaciones distintas y velocidad creciente. ¿Podés completar los cinco sin quedarte sin vidas?',
  'ARCADE',
  'cover-bricks',
  'cyan'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican.

---

## Plan de implementación

1. **`lib/games/arkanoid.ts`** — adaptar `game.js` al módulo TypeScript:
   - Copiar `levels.js` como módulo ES inline (constante `LEVELS` dentro del archivo)
   - Copiar las constantes y helpers de `assets/spritesheet.js` como módulo ES inline
     (`loadSpritesheet`, `drawSprite`, `drawFrame`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`)
   - Envolver toda la lógica en la factory `initArkanoid(canvas, callbacks)`
   - Reemplazar `document.getElementById('game')` y `canvas.getContext('2d')` por los parámetros recibidos
   - Definir `const W = 800; const H = 600;`
   - Estado del juego en variables de closure (no globales)
   - Listeners de teclado removibles:
     - Mover de `document.addEventListener` a `window.addEventListener`
     - Set `GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight'])` con `e.preventDefault()` en keydown
     - Eliminar el listener de `mousemove` (no se porta a la plataforma)
   - Flag `paused` interno; `pause()` lo activa, `resume()` lo desactiva y resetea `lastTime = null`
   - Loop RAF con clamp de dt (`Math.min(dt, 0.05)`)
   - Llamar callbacks cuando cambia el estado: `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`
   - Loop se auto-detiene en game over y en win (no llama `requestAnimationFrame` de nuevo)
   - Envolver el cuerpo de `initArkanoid` en `loadSpritesheet(() => { ... })`;
     el controller se construye y retorna desde dentro del callback
   - `destroy()` cancela el RAF pendiente (`cancelAnimationFrame(rafId)`) y elimina los listeners de teclado
   - Eliminar actualizaciones de HUD en canvas (`ctx.fillText` de score/nivel y sprites de vidas);
     reemplazar por llamadas a los callbacks
   - Retornar `{ pause, resume, destroy }`

2. **`components/games/ArkanoidGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<ArkanoidGameHandle, Props>` con handle `{ pause: () => void; resume: () => void }`
   - Props: `callbacks: ArkanoidCallbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `ArkanoidController`
   - `useImperativeHandle` expone `pause()` y `resume()` al padre
   - `useEffect(() => { ... }, [])` — monta `initArkanoid(canvasRef.current!, callbacks)`,
     guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={800} height={600} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/arkanoid/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `lives`, `level`, `paused`, `over`, `finalScore`,
     `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia
   - `gameRef = useRef<ArkanoidGameHandle>(null)` para controlar pausa/resume
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<ArkanoidGame key={gameKey}>`)
   - `handleSave`: llama `saveScore('arkanoid', playerName, finalScore)` de `@/lib/supabase/saveScore`;
     gestiona estados `saving`/`saved`
   - HUD: score, vidas, nivel, botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<ArkanoidGame>` va dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar
     (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/arkanoid` muestra la ficha del juego con título ARKANOID y botón JUGAR AHORA
- [ ] `/games/arkanoid/play` carga sin errores y muestra el canvas con el juego corriendo
- [ ] El HUD de React muestra score, vidas y nivel sincronizados con el estado interno del canvas
- [ ] Romper un bloque actualiza el score en el HUD de React en tiempo real
- [ ] Perder la pelota descuenta una vida y actualiza el contador de vidas en el HUD de React
- [ ] Avanzar de nivel actualiza el contador de nivel en el HUD de React
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda
- [ ] Al llegar a 0 vidas aparece el modal de game over con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/arkanoid` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego desde cero (score 0, vidas 3, nivel 1)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                   | Elegida                                                     | Descartada                              | Razón                                                                                    |
| -------------------------- | ----------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ruta del juego             | Estática `app/games/arkanoid/play/page.tsx`                 | Dinámica `[id]/play/page.tsx`           | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico        |
| Comunicación juego→React   | Callbacks en `initArkanoid`                                 | Custom DOM events                       | Los callbacks son tipados, no requieren `addEventListener` en el componente              |
| HUD                        | Doble (canvas interno + React externo)                      | Solo React                              | El canvas dibuja la capa de juego clásica; React dibuja la capa de plataforma            |
| Reinicio                   | Remontar `<ArkanoidGame>` via cambio de `key`               | Función `restart()` interna             | Estado limpio sin lógica extra en el módulo                                              |
| Guardado de score          | Solo Supabase (`saveScore`)                                 | localStorage                            | Persistencia real; infraestructura ya existente (spec 06)                                |
| Control de paleta          | Solo teclado (`ArrowLeft`/`ArrowRight`)                     | Mouse + teclado                         | El `mousemove` del original no es portable a la plataforma; consistente con otros juegos |
| Dependencias externas      | Inlineadas en `arkanoid.ts` (`levels.js`, `spritesheet.js`) | Importadas como módulos separados       | Evita crear archivos `.ts` adicionales para datos que solo usa este juego                |
| Selector de nivel en pausa | Fuera de scope                                              | Portar el overlay de pausa del original | Feature de debug/desarrollo; no aporta a la experiencia de plataforma                    |
| Sonido                     | Fuera de scope                                              | Portar `bounceSound`/`breakSound`       | Requiere manejo de assets en Next.js; complejidad no justificada para esta integración   |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar el id de `requestAnimationFrame` y cancelarlo en `destroy()`.

- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin llamar `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.

- **Inicialización asíncrona:** `initArkanoid` inicia el loop desde dentro del callback de `loadSpritesheet`; el controller se construye y retorna también desde ahí. El componente React debe tolerar que el canvas no empiece a renderizar de inmediato. Mitigación: el `useEffect` no asume inicialización síncrona; el cleanup verifica que el controller exista antes de llamar `destroy()`.

- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/arkanoid/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/arkanoid/play` resuelve al archivo estático y que los demás juegos siguen resolviendo al placeholder dinámico.

- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 800×600 px. En pantallas más pequeñas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
