# 01-dig-dug-clasica

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-29
**Objetivo:** Integrar Dig Dug clásico fiel en Arcade Vault: cavás túneles en un grid de tierra, inflás Pookas y Fygars con la bomba hasta reventarlos o los aplastás con rocas, avanzando por rondas hasta perder tus 3 vidas.

---

## Scope

### Dentro del scope

- `lib/games/digdug.ts` — módulo TypeScript escrito desde cero; exporta `initDigDug(canvas, callbacks): DigDugController`
- `components/games/DigDugGame.tsx` — Client Component que monta el canvas, llama a `initDigDug`, y expone `pause`/`resume` al padre
- `app/games/digdug/play/page.tsx` — ruta estática; HUD React con score, vidas, ronda, botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con `id: 'digdug'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 560×640 px)
- Ranking en tiempo real / realtime
- Sonido
- Crear la regla CSS `cover-digdug` en `app/globals.css` (no existe una clase `cover-*` libre que represente el cavar/rocas; Dig Dug requiere una nueva — ver "Riesgos"; el INSERT la referencia pero la regla la añade otra spec)
- Modos alternativos (oleadas / roca-puzzle — ver variantes 02 y 03)
- 2 jugadores

---

## Data Model

### Interfaz del módulo (`lib/games/digdug.ts`)

```ts
export interface DigDugCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onRoundChange: (round: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface DigDugController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initDigDug(
  canvas: HTMLCanvasElement,
  callbacks: DigDugCallbacks,
): DigDugController;
```

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'digdug',
  'DIG DUG',
  'Cavá túneles, inflá enemigos y aplastalos con rocas.',
  'Cavás tu propio laberinto bajo tierra mientras Pookas y Fygars te persiguen. Inflalos con tu bomba hasta que revienten o dejá caer rocas sobre ellos. Limpiá cada ronda para avanzar; perdés cuando se acaban tus tres vidas.',
  'ARCADE',
  'cover-digdug',
  'yellow'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican.

---

## Plan de implementación

1. **`lib/games/digdug.ts`** — escribir el módulo TypeScript desde cero:
   - Constantes: `const COLS = 14; const ROWS = 16; const CELL = 40; const W = 560; const H = 640;`
   - Grid de tierra: matriz `dirt[ROWS][COLS]` de booleanos (`true` = tierra sólida, `false` = túnel cavado). Una franja de cielo en la fila 0 (sin tierra) donde aparece el jugador.
   - Estado en closures: `player` (`{ x, y, dir, alive }` en coordenadas de píxel + dirección), `enemies` (array de `{ x, y, type: 'pooka'|'fygar', state: 'normal'|'ghost'|'inflating', inflate: 0-4, ghostTimer }`), `rocks` (array de `{ col, row, state: 'rest'|'wobble'|'falling', fallY }`), `harpoon` (`{ active, x, y, dir, length }` o null), `score`, `lives` (inicial 3), `round` (inicial 1), `enemiesLeft`, `paused`, `dead`, `lastTime`, `rafId`
   - **Cavar:** cuando el jugador se mueve hacia una celda con `dirt = true`, la convierte a `false` (cava). El movimiento es continuo (px) pero alineado a un eje (4 direcciones); cavar consume la celda destino.
   - **Bomba/arpón** (`Space`): dispara un arpón en la dirección actual del jugador; si alcanza un enemigo, este pasa a `state: 'inflating'`; mantener `Space` incrementa `inflate` (0→4). Al llegar a 4 el enemigo revienta y se elimina. Si se suelta `Space`, el enemigo se desinfla gradualmente y vuelve a `normal`.
   - **Rocas:** una roca cae si la celda inmediatamente debajo se cava (queda sin soporte): pasa `rest`→`wobble` (≈0.5 s)→`falling`. Mientras cae, aplasta a cualquier enemigo o al jugador en su columna. Al terminar de caer, desaparece (consumida).
   - **IA de enemigos:** persecución simple por túneles (moverse hacia el jugador por celdas cavadas). Tras un tiempo sin alcanzar al jugador, un enemigo entra en `state: 'ghost'`: atraviesa la tierra en línea recta hacia el jugador; al volver a un túnel retoma `normal`. Fygar puede, además, escupir fuego horizontal en línea recta (animación de 3 frames) que mata al jugador si lo toca.
   - **Scoring (tabla clásica por profundidad de la fila donde muere el enemigo):**
     | Capa (fila) | Pooka inflado | Fygar inflado (horizontal) |
     | ----------- | ------------- | -------------------------- |
     | 1 (arriba) | 200 | 400 |
     | 2 | 300 | 600 |
     | 3 | 400 | 800 |
     | 4 (abajo) | 500 | 1000 |

     - Aplastar con roca: 1000 (×N en cadena si una roca aplasta varios a la vez: 1000, 2500, 4000, 6000…)
     - Bonus vegetal: aparece una hortaliza en el centro del nivel tras cavar cierto número de celdas; recogerla suma según ronda (zanahoria 400, … hasta 5000).

   - **Fin de ronda:** cuando `enemiesLeft === 0`, `round++`, `onRoundChange(round)`, regenerar grid/enemigos (más enemigos y más rápidos cada ronda).
   - **Muerte del jugador:** al ser tocado por enemigo `normal`/`ghost`, fuego de Fygar, o roca: `lives--`, `onLivesChange(lives)`; si `lives > 0` reiniciar posiciones de la ronda actual; si `lives === 0` → `dead = true`, `onGameOver(score)`.
   - **Loop RAF con clamp de dt:** `loop(ts)`: `dt = Math.min((ts - lastTime) / 1000, 0.1)`; `lastTime = ts`; si `!paused && !dead` actualizar lógica; siempre dibujar; si `!dead` `rafId = requestAnimationFrame(loop)`.
   - **Listeners de teclado removibles:** `window.addEventListener('keydown'/'keyup', handler)`; `GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '])` con `e.preventDefault()` para evitar scroll. Flechas fijan dirección/movimiento; `Space` dispara/infla.
   - **Render** (`drawScene(ctx)`): `ctx.clearRect`; dibujar capas de tierra (degradado por profundidad), túneles cavados en oscuro, rocas, hortaliza, enemigos (Pooka redondo, Fygar dragón), arpón, jugador. `shadowBlur` global para el glow neón coherente con el shell CRT.
   - `pause()` → `paused = true`; `resume()` → `paused = false`, `lastTime = performance.now()` (evita spike de dt).
   - `destroy()` → `cancelAnimationFrame(rafId)` + remover listeners de teclado.
   - Retornar `{ pause, resume, destroy }`.

2. **`components/games/DigDugGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<DigDugGameHandle, Props>` con handle `{ pause(): void; resume(): void }`
   - Props: `callbacks: DigDugCallbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `DigDugController`
   - `useImperativeHandle` expone `pause` y `resume`
   - `useEffect(() => { ... }, [])` — monta `initDigDug(canvasRef.current!, callbacks)`, guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={560} height={640} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/digdug/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `lives` (inicial 3), `round` (inicial 1), `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])`: `onScoreChange`, `onLivesChange`, `onRoundChange`, `onGameOver`
   - `gameRef = useRef<DigDugGameHandle>(null)` para pausa/resume
   - HUD: `SCORE <score>`, `VIDAS <lives>`, `RONDA <round>`; botón PAUSA; botón SALIR
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<DigDugGame key={gameKey}>`)
   - `handleSave`: `saveScore('digdug', playerName, finalScore)` de `@/lib/supabase/saveScore`; estados `saving`/`saved`
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<DigDugGame>` dentro de `crt-content`
   - Modal de game over: "FIN DE LA EXCAVACIÓN", score final, input nombre (max 10 chars, mayúsculas), botón GUARDAR, JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`**: ejecutar el INSERT vía `mcp__supabase__execute_sql`.

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/digdug` muestra la ficha del juego con título DIG DUG y botón JUGAR AHORA
- [ ] `/games/digdug/play` carga sin errores y muestra el canvas con el grid de tierra y el jugador
- [ ] El jugador cava túneles al moverse hacia celdas de tierra con las flechas
- [ ] El HUD de React muestra score, vidas y ronda sincronizados con el estado del canvas
- [ ] `Space` dispara el arpón; mantenerlo infla al enemigo alcanzado hasta reventarlo
- [ ] El score por enemigo reventado depende de la profundidad (tabla por capa) y del tipo (Pooka/Fygar)
- [ ] Cavar bajo una roca la hace caer; aplastar enemigos con una roca suma el bonus (con cadena si aplasta varios)
- [ ] Los enemigos persiguen al jugador por los túneles y entran en modo ghost atravesando la tierra tras inactividad
- [ ] El Fygar puede escupir fuego horizontal que mata al jugador si lo toca
- [ ] Recoger la hortaliza del centro suma el bonus vegetal según la ronda
- [ ] Al limpiar todos los enemigos avanza la ronda (más enemigos / más rápidos)
- [ ] Perder todas las vidas abre el modal de game over con la puntuación final
- [ ] Las teclas de juego (flechas / espacio) no hacen scroll de la página
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda sin spike de dt
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/digdug` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia desde la ronda 1 con 3 vidas y score 0
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail y `/games` lo muestra en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                                 | Descartada                     | Razón                                                                                                               |
| ------------------------ | ------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/digdug/play/page.tsx`               | Dinámica `[id]/play/page.tsx`  | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico                                   |
| Comunicación juego→React | Callbacks en `initDigDug`                               | Custom DOM events              | Los callbacks son tipados y no requieren `addEventListener` en el componente                                        |
| Grid de tierra           | Matriz de booleanos `dirt[ROWS][COLS]`                  | Tilemap multi-estado por celda | Sólo se necesita "hay tierra / es túnel"; las rocas/enemigos viven en listas aparte                                 |
| Inflado de enemigo       | Mantener `Space` (0→4) revienta                         | Un solo disparo mata           | Fidelidad a la mecánica núcleo de Dig Dug; el riesgo de mantener el botón cerca del enemigo es el corazón del juego |
| Scoring por profundidad  | Tabla por capa (200–500 Pooka, 400–1000 Fygar)          | Score plano por enemigo        | Recompensa cavar profundo y enfrentar enemigos abajo, como el arcade original                                       |
| Bonus de roca en cadena  | 1000 / 2500 / 4000 / 6000…                              | 1000 fijo por enemigo          | Premia el juego de posicionamiento de rocas, distintivo de Dig Dug                                                  |
| Render glow              | `shadowBlur` global coherente con el shell CRT          | Sin glow / glow por sprite     | Coherencia visual con el resto del catálogo neón y rendimiento estable                                              |
| Enfoque de esta variante | Clásico fiel: rondas infinitas, 3 vidas, ambas matanzas | Oleadas en arena / Roca-puzzle | Variante de entrada canónica; reglas reconocibles para quien ya conoce Dig Dug y primer leaderboard de referencia   |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar `rafId` y `cancelAnimationFrame(rafId)` en `destroy()`.
- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **`lastTime` al reanudar pausa:** Si `resume()` no resetea `lastTime`, el primer frame tras la pausa acumula todo el tiempo pausado como dt y los enemigos/rocas saltan. Mitigación: `resume()` reasigna `lastTime = performance.now()`.
- **Conflicto ruta estática vs dinámica:** Next.js prioriza `app/games/digdug/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/digdug/play` resuelve al archivo estático y que los demás juegos siguen usando el placeholder dinámico.
- **Canvas fuera de pantalla en viewports pequeños:** Canvas fijo 560×640 px. En pantallas chicas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
- **Falta de la clase `cover-digdug`:** El INSERT referencia `cover-digdug`, que no existe en `app/globals.css` (ninguna `cover-*` libre representa el cavar/rocas; `cover-rocas` ya la usa Asteroides). Fuera de scope de este spec: la regla CSS debe añadirse por separado. Si no se añade, la ficha mostrará un cover sin estilo (degrada con elegancia, no rompe).
- **IA de ghost atrapando al jugador injustamente:** Un enemigo en modo ghost que aparece justo encima del jugador puede matar sin reacción posible. Mitigación: cooldown mínimo entre que un enemigo entra en ghost y puede colisionar, y no permitir que materialice dentro de la celda exacta del jugador.
- **Complejidad de la IA + rocas en el mismo frame:** Resolver colisiones jugador↔enemigo↔roca↔fuego en un solo tick puede producir muertes ambiguas. Mitigación: orden de resolución fijo y documentado (rocas → fuego → contacto enemigo) por frame.
