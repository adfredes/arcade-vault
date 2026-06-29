# 02-dig-dug-oleadas

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-29
**Objetivo:** Variante survival de Dig Dug en Arcade Vault: una sola arena de tierra y una sola vida; los enemigos llegan en oleadas crecientes desde los bordes y sobrevivís acumulando multiplicador de combo hasta que te alcancen.

---

## Scope

### Dentro del scope

- `lib/games/digdug.ts` — mismo id base; exporta `initDigDug(canvas, callbacks): DigDugController`
- `components/games/DigDugGame.tsx` — Client Component; expone `pause`/`resume`
- `app/games/digdug/play/page.tsx` — ruta estática; HUD con score, oleada, combo y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con `id: 'digdug'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 560×640 px)
- Ranking en tiempo real / realtime
- Sonido
- Crear la regla CSS `cover-digdug` en `app/globals.css` (no hay clase `cover-*` libre que represente cavar/rocas; la añade otra spec — ver "Riesgos")
- Vidas múltiples (esta variante es de vida única / sudden death)
- Modos clásico y roca-puzzle (ver variantes 01 y 03)

---

## Data Model

### Interfaz del módulo (`lib/games/digdug.ts`)

```ts
export interface DigDugCallbacks {
  onScoreChange: (score: number) => void;
  onWaveChange: (wave: number) => void;
  onComboChange: (multiplier: number) => void;
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

- **Una sola arena fija** (no hay "fin de ronda" que regenere el mapa): un único campo de tierra que el jugador va cavando y queda cavado durante toda la partida.
- **Una sola vida (sudden death):** el primer contacto letal termina la partida. Esto eleva la tensión y produce scores muy dispersos, ideales para el Hall of Fame.
- **Oleadas crecientes:** cada `WAVE_INTERVAL` segundos (o al limpiar la oleada actual) entra una nueva oleada con más enemigos y mayor velocidad. Los enemigos aparecen materializándose en celdas de tierra de los bordes (entran en modo ghost breve y se "asientan" en un túnel cercano).
- **Multiplicador de combo:** matar enemigos en rápida sucesión (dentro de una ventana de 3 s) sube el multiplicador (×1 → ×2 → ×3 → … hasta ×8). Si pasa la ventana sin matar, el multiplicador vuelve a ×1. Todo el score de la matanza se multiplica por el combo vigente.

### 1. `lib/games/digdug.ts` — módulo TypeScript desde cero

- Constantes: `const COLS = 14; const ROWS = 16; const CELL = 40; const W = 560; const H = 640; const WAVE_INTERVAL = 12; const COMBO_WINDOW = 3; const MAX_COMBO = 8;`
- Grid de tierra: matriz `dirt[ROWS][COLS]` de booleanos (persistente toda la partida; el cavado nunca se restaura).
- Estado en closures: `player` (`{ x, y, dir, alive }`), `enemies` (array `{ x, y, type, state, inflate, ghostTimer }`), `rocks` (array `{ col, row, state, fallY }`), `harpoon` (o null), `score`, `wave` (inicial 1), `combo` (inicial 1), `comboTimer`, `waveTimer`, `enemiesLeft`, `paused`, `dead`, `lastTime`, `rafId`
- **Cavar / arpón / rocas / IA / fuego de Fygar:** idénticos a la variante 01 (cavar al moverse, inflar manteniendo `Space`, rocas que caen y aplastan, persecución + modo ghost, fuego horizontal de Fygar).
- **Spawning de oleadas:** `spawnWave(wave)`: número de enemigos `= 2 + wave`, velocidad base escalada por `wave`; cada enemigo aparece en una celda de borde y entra en `state: 'ghost'` durante ≈1 s para asentarse en un túnel; proporción de Fygars sube con la oleada. Una nueva oleada entra cuando `enemiesLeft === 0` **o** cuando `waveTimer >= WAVE_INTERVAL` (lo que ocurra primero) → `wave++`, `onWaveChange(wave)`, `waveTimer = 0`.
- **Scoring con combo:** base por enemigo igual a la tabla por profundidad de la variante 01 (Pooka 200–500, Fygar 400–1000, roca 1000+cadena). El valor base se multiplica por `combo` vigente antes de sumarse. Al matar: `combo = Math.min(combo + 1, MAX_COMBO)`, `comboTimer = 0`, `onComboChange(combo)`, `onScoreChange(score)`.
- **Decaimiento de combo:** en cada frame, `comboTimer += dt`; si `comboTimer >= COMBO_WINDOW` y `combo > 1` → `combo = 1`, `onComboChange(1)`.
- **Game over inmediato:** al primer contacto letal (enemigo normal/ghost, fuego de Fygar, o roca sobre el jugador): `dead = true`, `onGameOver(score)` — no hay vidas que descontar.
- **Loop RAF con clamp de dt:** `loop(ts)`: `dt = Math.min((ts - lastTime) / 1000, 0.1)`; `lastTime = ts`; si `!paused && !dead` actualizar (mover, oleadas, combos, colisiones); siempre dibujar; si `!dead` `rafId = requestAnimationFrame(loop)`.
- **Listeners de teclado removibles:** `keydown`/`keyup` en `window`; `GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '])` con `e.preventDefault()`.
- **Render** (`drawScene(ctx)`): capas de tierra, túneles, rocas, enemigos, arpón, jugador. Indicador de oleada entrante (texto/flash en el borde por donde aparecen). `shadowBlur` global para el glow neón; el color del jugador o de un anillo de combo intensifica con `combo` alto.
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
- Estado React: `score`, `wave` (inicial 1), `combo` (inicial 1), `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
- Callbacks en `useCallback([])`: `onScoreChange`, `onWaveChange`, `onComboChange`, `onGameOver`
- `gameRef = useRef<DigDugGameHandle>(null)` para pausa/resume
- HUD: `SCORE <score>`, `OLEADA <wave>`, `COMBO ×<combo>` (resaltado en neon cuando `combo >= 4`); botón PAUSA; botón SALIR
- Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
- Restart: resetear estado + `setGameKey(k => k + 1)` (remonta `<DigDugGame key={gameKey}>`)
- `handleSave`: `saveScore('digdug', playerName, finalScore)`; estados `saving`/`saved`
- Shell CRT: clases `crt`, `crt-screen`, `crt-content`
- Modal de game over: "TE ALCANZARON" + oleada alcanzada + combo máximo; score final; input nombre (max 10 chars, mayúsculas); GUARDAR / JUGAR DE NUEVO / VOLVER AL VAULT

### 4. Insertar fila en `games`

Ejecutar el INSERT vía `mcp__supabase__execute_sql`.

### 5. Verificar TypeScript

`tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/digdug` muestra la ficha del juego con título DIG DUG y botón JUGAR AHORA
- [ ] `/games/digdug/play` carga sin errores y muestra el canvas con la arena de tierra y el jugador
- [ ] El jugador cava túneles al moverse; el cavado persiste durante toda la partida (no se regenera el mapa)
- [ ] El HUD muestra score, oleada y multiplicador de combo sincronizados con el canvas
- [ ] `Space` dispara el arpón; mantenerlo infla y revienta enemigos; las rocas caen y aplastan
- [ ] Entran oleadas crecientes (más enemigos y más rápidos) al limpiar la oleada o al expirar `WAVE_INTERVAL`
- [ ] Matar enemigos en sucesión dentro de la ventana de combo sube el multiplicador (hasta ×8)
- [ ] El multiplicador vuelve a ×1 si pasa la ventana de combo sin matar
- [ ] El score de cada matanza se multiplica por el combo vigente
- [ ] El primer contacto letal termina la partida de inmediato (vida única)
- [ ] Las teclas de juego (flechas / espacio) no hacen scroll de la página
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda sin spike de dt
- [ ] El modal de game over muestra la oleada alcanzada y el combo máximo, y permite guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/digdug` y en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia con oleada 1, combo ×1, score 0 y arena nueva
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail y `/games` lo muestra en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                       | Descartada                     | Razón                                                                                                |
| ------------------------ | --------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/digdug/play/page.tsx`     | Dinámica `[id]/play/page.tsx`  | Aislamiento por juego                                                                                |
| Estructura de niveles    | Arena única + oleadas continuas               | Rondas que regeneran el mapa   | El laberinto que el jugador cava se vuelve su recurso: túneles abiertos = rutas de escape y de roca  |
| Vidas                    | Vida única (sudden death)                     | 3 vidas como la clásica        | Tensión máxima y scores muy dispersos, ideales para competir en el Hall of Fame                      |
| Escalado de dificultad   | Por oleada (más enemigos + velocidad)         | Por tiempo absoluto            | Mantiene el control en manos del jugador: limpiar rápido adelanta la presión y el potencial de combo |
| Sistema de score         | Base por profundidad × multiplicador de combo | Score plano como la clásica    | El combo premia el juego agresivo y encadenado; diferenciación clara frente a la variante 01         |
| Combo                    | Ventana de 3 s, tope ×8                       | Combo infinito sin decaimiento | El decaimiento obliga a arriesgar para mantener el multiplicador; el tope evita scores desbordados   |
| Spawning de enemigos     | Materializan en bordes (ghost breve)          | Aparecen en posiciones fijas   | La arena persistente no tiene "huecos" fijos; el spawn por borde es justo y legible                  |
| Enfoque de esta variante | Survival en arena, combo, vida única          | Clásico fiel / Roca-puzzle     | Para jugadores que buscan adrenalina y maximizar score; mecánica de combo inédita en el catálogo     |

---

## Riesgos identificados

- **Loop zombie:** RAF no cancelado en `destroy()` produce dos loops al remontar (JUGAR DE NUEVO). Mitigación: guardar `rafId` y `cancelAnimationFrame(rafId)` en `destroy()`.
- **Listeners de teclado huérfanos:** Listeners en `window` que sobreviven a un desmontaje sin `destroy()`. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **`lastTime` al reanudar pausa:** Sin reset, el primer frame tras pausa acumula el tiempo pausado como dt (oleadas/combos saltan). Mitigación: `resume()` reasigna `lastTime = performance.now()`.
- **Combo injusto por colisión múltiple:** Una roca que aplasta varios enemigos en un frame podría disparar el combo varias veces de golpe. Mitigación: documentar que la cadena de roca cuenta como UN evento de combo (sube +1) pero usa la escala de cadena de score (1000/2500/4000…).
- **Saturación de la arena cavada:** Si el jugador cava casi todo el campo, los enemigos pierden ventaja y el juego se trivializa. Mitigación: subir agresivamente velocidad y cantidad por oleada; spawns más frecuentes cuando la densidad de túneles es alta.
- **Conflicto ruta estática vs dinámica:** Next.js prioriza `app/games/digdug/play/page.tsx`. Verificar la resolución y que los demás juegos sigan usando el placeholder dinámico.
- **Canvas fuera de pantalla:** Canvas fijo 560×640. Fuera de scope.
- **Falta de la clase `cover-digdug`:** El INSERT la referencia pero no existe en `app/globals.css`. Fuera de scope; debe añadirse por separado. Degrada con elegancia si falta.
