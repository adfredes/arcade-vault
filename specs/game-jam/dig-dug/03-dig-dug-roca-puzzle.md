# 03-dig-dug-roca-puzzle

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-29
**Objetivo:** Variante puzzle de Dig Dug en Arcade Vault: sin bomba ni arpón, la única forma de eliminar enemigos es atraerlos bajo rocas y dejarlas caer; cada nivel es un tablero diseñado para resolverse en pocas caídas, premiando aplastamientos en cadena.

---

## Scope

### Dentro del scope

- `lib/games/digdug.ts` — mismo id base; exporta `initDigDug(canvas, callbacks): DigDugController`
- `components/games/DigDugGame.tsx` — Client Component; expone `pause`/`resume`
- `app/games/digdug/play/page.tsx` — ruta estática; HUD con score, nivel, rocas restantes y modal de fin de partida con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con `id: 'digdug'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 560×640 px)
- Ranking en tiempo real / realtime
- Sonido
- Crear la regla CSS `cover-digdug` en `app/globals.css` (no hay clase `cover-*` libre que represente cavar/rocas; la añade otra spec — ver "Riesgos")
- Bomba / arpón / inflado de enemigos (eliminados a propósito en esta variante)
- Fuego de Fygar (sin combate directo; los enemigos solo persiguen y matan por contacto)
- Modos clásico y oleadas (ver variantes 01 y 02)

---

## Data Model

### Interfaz del módulo (`lib/games/digdug.ts`)

```ts
export interface DigDugCallbacks {
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onRocksChange: (rocksLeft: number) => void;
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

### Mecánica central (qué cambia vs. la clásica)

- **Sin arpón ni inflado:** el jugador no tiene arma directa. La tecla `Space` queda libre (o se ignora). El único recurso ofensivo son las **rocas**.
- **Niveles diseñados (tablas predefinidas):** cada nivel es un layout fijo de tierra, rocas y posiciones iniciales de enemigos pensado para resolverse atrayendo enemigos bajo las rocas. Hay un conjunto de niveles incrementales; al completarlos todos, se repite el ciclo con enemigos más rápidos.
- **Objetivo por nivel:** eliminar a todos los enemigos del tablero aplastándolos con rocas. Las rocas son un recurso **limitado** (`rocksLeft`): si te quedás sin rocas con enemigos vivos, fallás el nivel (game over).
- **Premio al ingenio:** aplastar varios enemigos con una sola roca multiplica fuerte; resolver con rocas de sobra otorga bonus de eficiencia.

### 1. `lib/games/digdug.ts` — módulo TypeScript desde cero

- Constantes: `const COLS = 14; const ROWS = 16; const CELL = 40; const W = 560; const H = 640;`
- **Definición de niveles:** `const LEVELS: LevelDef[]` donde `LevelDef = { dirt: string[]; rocks: [col,row][]; enemies: { col, row, type }[]; player: [col,row] }`. La tierra se describe con un mapa de caracteres por fila (`#` tierra, `.` túnel) para legibilidad; las rocas y enemigos por coordenadas.
- Estado en closures: `level` (índice, inicial 0), `dirt[ROWS][COLS]`, `player` (`{ x, y, dir, alive }`), `enemies` (array `{ x, y, type, state: 'normal'|'ghost', ghostTimer }`), `rocks` (array `{ col, row, state: 'rest'|'wobble'|'falling', fallY }`), `rocksLeft` (rocas aún en el tablero, sin caer), `score`, `paused`, `dead`, `lastTime`, `rafId`
- **Cavar:** igual que la clásica — moverse hacia tierra la convierte en túnel.
- **Rocas (mecánica núcleo, ampliada):** una roca cae cuando se cava la celda inmediatamente debajo (`rest`→`wobble` ≈0.6 s→`falling`). Al caer, aplasta a TODO enemigo (y al jugador) en su columna por debajo, acumulando una **cadena**. Al terminar de caer, la roca se consume y `rocksLeft--`, `onRocksChange(rocksLeft)`. (No hay otra forma de matar.)
- **IA de enemigos:** persecución por túneles hacia el jugador; tras inactividad, modo `ghost` que atraviesa la tierra. El diseño de niveles asume que el jugador usa los túneles para guiar a los enemigos bajo las rocas. Sin fuego de Fygar (Fygar y Pooka difieren solo en valor de score y velocidad).
- **Scoring (centrado en rocas y cadenas):**
  - Aplastar con roca: 1 enemigo = 1000; cadena en una sola roca = 1000, 2500, 4500, 7000, 10000… (incremento creciente que premia setups grandes).
  - Pooka aplastado: ×1 ese valor; Fygar aplastado: ×2 (más difícil de posicionar).
  - **Bonus de eficiencia al limpiar el nivel:** `rocksLeft × 1500` (cada roca no usada vale puntos) + bonus base de nivel `(level+1) × 500`.
- **Fin de nivel:** cuando no quedan enemigos vivos → aplicar bonus de eficiencia; `level = (level + 1) % LEVELS.length`; cargar el siguiente layout (cada ciclo completo sube la velocidad de enemigos); `onLevelChange(level)`; `onScoreChange(score)`; `onRocksChange(rocksLeft del nuevo nivel)`.
- **Game over:** (a) el jugador es tocado por un enemigo o aplastado por su propia roca → `dead = true`; **o** (b) `rocksLeft === 0` y aún quedan enemigos vivos (nivel irresoluble) → `dead = true`. En ambos casos `onGameOver(score)`.
- **Loop RAF con clamp de dt:** `loop(ts)`: `dt = Math.min((ts - lastTime) / 1000, 0.1)`; `lastTime = ts`; si `!paused && !dead` actualizar; siempre dibujar; si `!dead` `rafId = requestAnimationFrame(loop)`.
- **Listeners de teclado removibles:** `keydown`/`keyup` en `window`; `GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])` con `e.preventDefault()` (sin `Space` activo, pero se puede incluir igualmente para evitar scroll).
- **Render** (`drawScene(ctx)`): tierra por capas, túneles, rocas (con animación de tambaleo en `wobble`), enemigos (Pooka/Fygar), jugador. Indicador visual de la columna "amenazada" bajo una roca tambaleante para que el puzzle sea legible. `shadowBlur` global para el glow neón coherente con el shell CRT.
- `pause()` → `paused = true`; `resume()` → `paused = false`, `lastTime = performance.now()`.
- `destroy()` → `cancelAnimationFrame(rafId)` + remover listeners.
- Retornar `{ pause, resume, destroy }`.

### 2. `components/games/DigDugGame.tsx` — Client Component

- `'use client'`
- `forwardRef<DigDugGameHandle, Props>` con handle `{ pause(): void; resume(): void }`
- Props: `callbacks: DigDugCallbacks`
- `useImperativeHandle` expone `pause`, `resume`
- `useEffect(() => { ... }, [])` — monta `initDigDug`, guarda controller, retorna `() => controller.destroy()`
- `<canvas ref={canvasRef} width={560} height={640} style={{ display: 'block', maxWidth: '100%' }} />`

### 3. `app/games/digdug/play/page.tsx` — play page dedicada

- `'use client'`
- Estado React: `score`, `level` (inicial 1, mostrado como `level+1`), `rocksLeft`, `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
- Callbacks en `useCallback([])`: `onScoreChange`, `onLevelChange`, `onRocksChange`, `onGameOver`
- `gameRef = useRef<DigDugGameHandle>(null)` para pausa/resume
- HUD: `SCORE <score>`, `NIVEL <level>`, `ROCAS <rocksLeft>` (resaltado en neon cuando `rocksLeft <= 1`); botón PAUSA; botón SALIR
- Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
- Restart: resetear estado + `setGameKey(k => k + 1)` (remonta `<DigDugGame key={gameKey}>`)
- `handleSave`: `saveScore('digdug', playerName, finalScore)`; estados `saving`/`saved`
- Shell CRT: clases `crt`, `crt-screen`, `crt-content`
- Modal de game over: distingue causa — "APLASTADO" / "TE ATRAPARON" / "SIN ROCAS"; nivel alcanzado; score final; input nombre (max 10 chars, mayúsculas); GUARDAR / JUGAR DE NUEVO / VOLVER AL VAULT

### 4. Insertar fila en `games`

Ejecutar el INSERT vía `mcp__supabase__execute_sql`.

### 5. Verificar TypeScript

`tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/digdug` muestra la ficha del juego con título DIG DUG y botón JUGAR AHORA
- [ ] `/games/digdug/play` carga sin errores y muestra el primer nivel diseñado (tierra, rocas y enemigos en sus posiciones)
- [ ] El jugador cava túneles al moverse con las flechas
- [ ] No existe arpón/inflado: la única forma de matar es con rocas
- [ ] El HUD muestra score, nivel y rocas restantes sincronizados con el canvas
- [ ] Cavar bajo una roca la hace tambalear y caer; la roca aplasta a todos los enemigos en su columna
- [ ] Aplastar varios enemigos con una sola roca aplica la escala de cadena (1000/2500/4500/7000…)
- [ ] Un Fygar aplastado vale el doble que un Pooka en la misma posición
- [ ] Al limpiar el nivel se aplica el bonus de eficiencia (`rocksLeft × 1500`) y se carga el siguiente layout
- [ ] Tras completar todos los niveles, el ciclo se repite con enemigos más rápidos
- [ ] Quedarse sin rocas con enemigos vivos termina la partida con causa "SIN ROCAS"
- [ ] Ser tocado por un enemigo o por tu propia roca termina la partida con la causa correspondiente
- [ ] Las teclas de juego (flechas) no hacen scroll de la página
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda sin spike de dt
- [ ] El modal de game over muestra causa + nivel alcanzado y permite guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/digdug` y en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia desde el nivel 1 con score 0
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail y `/games` lo muestra en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                            | Descartada                      | Razón                                                                                              |
| ------------------------ | -------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/digdug/play/page.tsx`          | Dinámica `[id]/play/page.tsx`   | Aislamiento por juego                                                                              |
| Arma del jugador         | Solo rocas (sin arpón/inflado)                     | Arpón + rocas como la clásica   | Reenfoca el juego como puzzle de posicionamiento; mecánica de roca elevada a protagonista          |
| Estructura de niveles    | Tablas diseñadas (layouts fijos) en ciclo          | Generación aleatoria            | Un puzzle requiere niveles resolubles y curados; lo aleatorio rompería el diseño de soluciones     |
| Rocas como recurso       | Limitado (`rocksLeft`); agotarlas = game over      | Rocas infinitas                 | Convierte cada caída en una decisión; el núcleo del puzzle es no desperdiciar rocas                |
| Scoring                  | Cadenas de roca + bonus de eficiencia              | Score plano por enemigo         | Premia el ingenio (aplastar varios, sobrar rocas), no la velocidad ni el combate                   |
| Fuego de Fygar           | Eliminado                                          | Mantenerlo como la clásica      | Sin combate directo, el fuego no encaja; Fygar se diferencia solo por velocidad y valor de score   |
| Causa de game over       | Etiquetada (APLASTADO/ATRAPADO/SIN ROCAS)          | Mensaje genérico                | Feedback claro de por qué fallaste, propio de un puzzle de aprendizaje                             |
| Enfoque de esta variante | Puzzle de rocas, niveles curados, recurso limitado | Clásico fiel / Oleadas survival | Para jugadores que prefieren pensar antes que reflejos; aporta categoría puzzle-acción al catálogo |

---

## Riesgos identificados

- **Loop zombie:** RAF no cancelado en `destroy()` produce dos loops al remontar (JUGAR DE NUEVO). Mitigación: guardar `rafId` y `cancelAnimationFrame(rafId)` en `destroy()`.
- **Listeners de teclado huérfanos:** Listeners en `window` que sobreviven a un desmontaje sin `destroy()`. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **`lastTime` al reanudar pausa:** Sin reset, el primer frame tras pausa acumula el tiempo pausado como dt (rocas/enemigos saltan). Mitigación: `resume()` reasigna `lastTime = performance.now()`.
- **Niveles irresolubles por mal diseño:** Un layout mal balanceado puede ser imposible o trivial. Mitigación: validar manualmente cada `LevelDef` con una solución conocida antes de incluirlo; documentar la solución de referencia junto a cada nivel.
- **Bloqueo del jugador (softlock):** El jugador podría quedar atrapado sin rocas útiles pero con enemigos lentos, dejando la partida sin avanzar. Mitigación: la condición de game over por `rocksLeft === 0` con enemigos vivos cierra la partida; además, la persecución de enemigos garantiza presión.
- **Legibilidad de la amenaza de roca:** El jugador debe entender qué columna aplastará una roca tambaleante. Mitigación: resaltar la columna bajo una roca en `wobble` y animar el tambaleo claramente.
- **Conflicto ruta estática vs dinámica:** Next.js prioriza `app/games/digdug/play/page.tsx`. Verificar la resolución y que los demás juegos sigan usando el placeholder dinámico.
- **Canvas fuera de pantalla:** Canvas fijo 560×640. Fuera de scope.
- **Falta de la clase `cover-digdug`:** El INSERT la referencia pero no existe en `app/globals.css`. Fuera de scope; debe añadirse por separado. Degrada con elegancia si falta.
