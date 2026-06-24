# 01-frogger-clasica

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón de integración canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-24
**Objetivo:** Integrar Frogger en su forma arcade clásica: dos zonas de cruce (carretera con vehículos + río con troncos y tortugas), 5 ranas que llevar a casa por nivel, vidas y temporizador, con HUD React sincronizado y guardado en Supabase. Esta variante prioriza la fidelidad al arcade original y la mayor profundidad mecánica de las tres.

---

## Scope

### Dentro del scope

- `lib/games/frogger.ts` — módulo TypeScript escrito desde cero; exporta `initFrogger(canvas, callbacks): FroggerController`
- `components/games/FroggerGame.tsx` — Client Component que monta el canvas, llama a `initFrogger`, y hace de puente entre el módulo y la play page
- `app/games/frogger/play/page.tsx` — ruta estática, play page dedicada; incluye HUD React (score, vidas, nivel, timer, ranas en casa), botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con id `frogger`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 520×600 px)
- Ranking en tiempo real / realtime
- Sonido
- Sprites con assets externos (se dibuja con formas/colores del canvas; rana, autos, troncos y tortugas son rectángulos y óvalos estilizados acordes al shell neón CRT)
- Modos alternativos (cooperativo, time-attack puro)

---

## Data Model

### Interfaz del módulo (`lib/games/frogger.ts`)

```ts
export interface FroggerCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onTimerChange: (timerPct: number) => void; // 0..1, fracción de tiempo restante del cruce actual
  onHomesChange: (filled: number) => void; // ranas en casa este nivel (0..5)
  onGameOver: (finalScore: number) => void;
}

export interface FroggerController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initFrogger(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
): FroggerController;
```

> `onTimerChange` emite la fracción restante (0..1) para que React dibuje una barra; el módulo no conoce el DOM de la plataforma. `onHomesChange` permite al HUD mostrar las 5 ranuras de casa que se van llenando.

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frogger',
  'FROGGER',
  'Cruza la ruta y el río sin morir en el intento.',
  'Guiá a la rana a través de una carretera llena de vehículos y un río de troncos y tortugas hasta las cinco casas. Cada salto cuenta y el reloj corre: un descuido bajo las ruedas o un chapuzón en el agua y perdés una vida. Llevá las cinco ranas a casa para subir de nivel.',
  'ARCADE',
  'cover-rana',
  'green'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican. `cover-rana` ya existe en `globals.css` — no se agrega regla nueva.

---

## Plan de implementación

1. **`lib/games/frogger.ts`** — escribir el módulo TypeScript desde cero:
   - Definir geometría por grilla: `const COLS = 13; const CELL = 40; const ROWS = 15;` ⇒ canvas `W = 520`, `H = 600`. Filas de arriba a abajo: fila 0 = casas (5 ranuras), filas 1-5 = río, fila 6 = mediana segura, filas 7-12 = carretera, fila 13 = acera de inicio, fila 14 = HUD interno opcional (se omite; el HUD vive en React).
   - Estado en variables de closure (no globales): `frog {col, row, pxOffset}`, `lives`, `score`, `level`, `homes` (array de 5 booleans), `timer` (segundos restantes del cruce), `lanes` (config por fila), `paused`, `dead`, `farthestRow` (para bonus de avance).
   - **Carriles de carretera:** cada fila tiene `{ dir: ±1, speed, gap, cars[] }`. Los autos son rectángulos que se mueven horizontalmente; al salir por un borde reaparecen por el opuesto (wrap). Colisión auto↔rana = perder vida.
   - **Carriles de río:** cada fila tiene troncos (rectángulos largos) o filas de tortugas (grupos de óvalos, algunas se sumergen en ciclo). La rana **sobre** un tronco/tortuga se desplaza con él (suma su velocidad al movimiento de la rana). Estar en una fila de río **sin** plataforma debajo, o ser arrastrada fuera del canvas, = perder vida. Tortuga sumergida bajo la rana = perder vida.
   - **Movimiento de la rana:** discreto, un salto por pulsación (no holding). `ArrowUp/Down/Left/Right` mueven una celda. Avanzar a una fila nunca alcanzada antes suma `+10` (`farthestRow`).
   - **Casas (fila 0):** al llegar a una ranura libre, esa rana llega a casa: `homes[i] = true`, `+50` + bonus de timer (`floor(timer) * 2`), reset de la rana a la acera de inicio, reinicio del timer. Llegar a una ranura ya ocupada o fuera de ranura = perder vida.
   - **Fin de nivel:** las 5 casas llenas ⇒ `+1000` bonus de nivel, `level++`, `onLevelChange`, vaciar `homes`, subir dificultad (velocidades de carriles y menos tiempo de timer).
   - **Timer:** cuenta regresiva por cruce (ej. 30 s nivel 1, baja por nivel). Al llegar a 0 = perder vida y reset de la rana. Emite `onTimerChange(timer / timerMax)` cada frame.
   - **Vidas:** inicial 3. Cada muerte: `lives--`, `onLivesChange`, reset de la rana a la acera, reset del timer. `lives === 0` ⇒ `dead = true`, `onGameOver(score)`, el loop se auto-detiene.
   - Loop RAF con **clamp de dt** (`dt = Math.min(dt, 0.05)` s) para mover carriles/timer; el movimiento de la rana es por evento, no por dt.
   - Listeners de teclado removibles: `window.addEventListener('keydown', handler)`; `GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])` con `e.preventDefault()` para evitar scroll. Ignorar repetición de tecla sostenida (usar `e.repeat` o flag) para mantener el salto discreto.
   - Flag `paused` interno; `pause()` lo activa, `resume()` lo desactiva y resetea `lastTime = null`.
   - `destroy()` cancela el RAF pendiente (`cancelAnimationFrame(rafId)`) y elimina el listener de teclado.
   - Retornar `{ pause, resume, destroy }`.

2. **`components/games/FroggerGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<FroggerGameHandle, Props>` con handle `{ pause: () => void; resume: () => void }`
   - Props: `callbacks: FroggerCallbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `FroggerController`
   - `useImperativeHandle` expone `pause()` y `resume()` al padre
   - `useEffect(() => { ... }, [])` — monta `initFrogger(canvasRef.current!, callbacks)`, guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={520} height={600} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/frogger/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `lives`, `level`, `timerPct`, `homes`, `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia
   - `gameRef = useRef<FroggerGameHandle>(null)` para controlar pausa/resume
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<FroggerGame key={gameKey}>`)
   - `handleSave`: llama `saveScore('frogger', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona estados `saving`/`saved`
   - HUD: SCORE, VIDAS, NIVEL, barra de TIMER (ancho proporcional a `timerPct`), 5 ranuras de CASA (llenas según `homes`), botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<FroggerGame>` va dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/frogger` muestra la ficha del juego con título FROGGER y botón JUGAR AHORA
- [ ] `/games/frogger/play` carga sin errores y muestra el canvas 520×600 con el juego corriendo
- [ ] El HUD de React muestra SCORE, VIDAS, NIVEL, TIMER y las 5 ranuras de CASA sincronizados con el estado interno del canvas
- [ ] Las flechas mueven la rana de a una celda por pulsación (salto discreto), sin scroll de página
- [ ] Un vehículo que atropella a la rana descuenta una vida y resetea su posición
- [ ] En el río, la rana se mueve junto al tronco/tortuga sobre el que está; caer al agua descuenta una vida
- [ ] Una tortuga sumergida bajo la rana provoca pérdida de vida
- [ ] Llegar a una ranura de casa libre la marca como llena, suma score + bonus de timer y resetea la rana
- [ ] Llenar las 5 casas suma el bonus de nivel, sube NIVEL y aumenta la dificultad (más velocidad, menos tiempo)
- [ ] El TIMER baja durante el cruce; al agotarse descuenta una vida
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda
- [ ] Al llegar a 0 vidas aparece el modal de game over con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/frogger` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego desde cero (score 0, vidas 3, nivel 1, casas vacías)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                                          | Descartada                               | Razón                                                                                  |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Enfoque de esta variante | Frogger arcade fiel: carretera + río + 5 casas + timer + vidas   | Endless de un carril / puzzle por turnos | Máxima fidelidad y profundidad mecánica; mejor para quien busca el Frogger "de verdad" |
| Ruta del juego           | Estática `app/games/frogger/play/page.tsx`                       | Dinámica `[id]/play/page.tsx`            | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico      |
| Comunicación juego→React | Callbacks en `initFrogger`                                       | Custom DOM events                        | Los callbacks son tipados, no requieren `addEventListener` en el componente            |
| Movimiento de la rana    | Discreto por celda, una pulsación = un salto (`e.repeat` ignora) | Movimiento continuo holding flecha       | Es el feel clásico de Frogger y simplifica la colisión a chequeo por celda             |
| Mecánica de río          | Plataformas que arrastran a la rana (troncos + tortugas)         | Solo carretera (sin agua)                | El río es la mitad icónica de Frogger; lo distingue de un simple cruce de tráfico      |
| Timer                    | Cuenta regresiva por cruce que penaliza con vida y da bonus      | Sin timer                                | Aporta tensión y un eje de score (bonus por rapidez) fiel al original                  |
| Render                   | Formas/colores en canvas (sin assets)                            | Spritesheet externo                      | Sin dependencias de assets; encaja con la estética neón del shell CRT                  |
| Reinicio                 | Remontar `<FroggerGame>` vía cambio de `key`                     | Función `restart()` interna              | Estado limpio sin lógica extra en el módulo                                            |
| Guardado de score        | Solo Supabase (`saveScore`)                                      | localStorage                             | Persistencia real; infraestructura ya existente (spec 06)                              |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar el id de `requestAnimationFrame` y cancelarlo en `destroy()`.
- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin llamar `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/frogger/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/frogger/play` resuelve al archivo estático y que los demás juegos siguen resolviendo al placeholder dinámico.
- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 520×600 px. En pantallas más pequeñas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
- **Salto sostenido (key repeat):** Sin filtrar `e.repeat`, mantener la flecha movería la rana varias celdas por frame. Mitigación: ignorar `keydown` con `e.repeat === true` (o flag de tecla liberada).
- **Detección de "sobre plataforma" en el río:** Errores de redondeo entre el offset en píxeles de la rana y los troncos pueden causar muertes/supervivencias injustas en los bordes. Mitigación: chequear superposición por AABB con un margen de tolerancia, y forzar el centro de la rana a la celda al terminar cada salto.
- **Arrastre fuera del canvas:** Si la rana sobre un tronco llega al borde lateral y es empujada fuera, debe contar como muerte; no dejar que el offset crezca sin límite. Mitigación: comprobar límites del canvas tras aplicar el arrastre.
