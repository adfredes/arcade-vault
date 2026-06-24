---
name: nuevo-juego
description: Genera un spec (estilo specs/05 y 06) para integrar un juego canvas vanilla a Arcade Vault con su leaderboard en Supabase. Inspecciona el game.js fuente y produce specs/NN-<id>-game.md listo para /spec-impl. No escribe código de producción. Úsala al agregar un juego nuevo a la plataforma.
disable-model-invocation: true
argument-hint: '<fuente: carpeta en references/started-games/, ruta, o descripción breve>'
---

# /nuevo-juego — Generador de spec de integración de juego

Esta skill genera un spec completo para integrar un juego canvas vanilla a Arcade Vault, siguiendo exactamente el patrón de `specs/05-asteroides-game.md`. **No escribes código aquí.** Tu trabajo es inspeccionar el game.js fuente, recolectar los metadatos del juego y producir un spec en `specs/NN-<id>-game.md` listo para aprobar y ejecutar con `/spec-impl`.

La infraestructura de leaderboard ya existe (`lib/supabase/queries.ts`, `lib/supabase/saveScore.ts`, tablas `games`/`scores` en Supabase). El spec que generes **reutiliza todo eso sin re-especificarlo**.

## Contexto del proyecto

Antes de hacer cualquier otra cosa, lee la skill `/spec` para respetar su metodología y estructura al generar el spec:

- Lee `~/.claude/skills/spec/SKILL.md` — metodología, fases y reglas de la skill.
- Lee `~/.claude/skills/spec/template.md` — estructura canónica de un spec.

Adapta lo que encuentres ahí al contexto de este proyecto (los specs existentes usan convenciones en español y un formato de encabezado propio — mantenlos).

Specs existentes en este repositorio:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Rama actual:
!`git branch --show-current`

## Fase 1 — Identificar la fuente

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío, pregunta al usuario cuál es la fuente del juego: una carpeta de `references/started-games/` (`02-asteroids`, `03-tetris`, `04-arkanoid`), una ruta concreta, o una descripción. Espera la respuesta antes de continuar.

Si `$ARGUMENTS` tiene valor:

1. Determina si corresponde a una subcarpeta de `references/started-games/`. Si es así, lista los archivos de esa carpeta y luego lee:
   - `index.html` — para conocer la estructura del canvas (id, tamaño), qué scripts carga y si hay elementos HUD en el DOM.
   - `game.js` — el archivo principal de lógica.
   - Archivos adicionales si existen: `levels.js`, `assets/spritesheet.js`, etc.

2. Si la ruta no existe o el argumento es una descripción, pide al usuario que confirme la ubicación exacta.

## Fase 2 — Inspeccionar la forma del game.js

Lee el código fuente y clasifica el juego en cada una de estas dimensiones. Registra las respuestas porque condicionarán el contenido del spec:

| Dimensión                   | Opciones a detectar                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **HUD**                     | Dibujado en canvas (`ctx.fillText`) vs elementos DOM (`#score`, `#lines`, etc.)                                       |
| **Listeners de teclado**    | `window.addEventListener` vs `document.addEventListener`; qué teclas usa (`ArrowLeft/Right/Up/Down`, `Space`, letras) |
| **Entry point**             | Llamada directa al final (`init()`, `loop()`, `startGame()`) vs callback de asset loader (`loadSpritesheet(cb)`)      |
| **Loop**                    | Acumulador de tiempo (`dropAccum += dt`) vs dt por frame (`dt = (ts - lastTime) / 1000`); ¿hay clamp de dt?           |
| **Estado del juego**        | Variables globales planas (`let score`, `let lives`) vs clases (`new Ship()`, `new Asteroid()`)                       |
| **Señales de fin de juego** | Cómo detecta game over (variable de estado, `gameState === 'gameover'`, `lives <= 0`)                                 |
| **Dependencias externas**   | Scripts adicionales requeridos (`LEVELS`, `spritesheet.js`, sonidos)                                                  |

Anota también:

- La resolución fija del canvas (`width` × `height` en el HTML o como constantes `W`/`H` en el JS).
- Las teclas que deben tener `e.preventDefault()` para evitar scroll de página (generalmente `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space`).

## Fase 3 — Recolectar metadatos del juego

Pregunta al usuario los metadatos necesarios para la fila en Supabase y la integración en la plataforma. Agrupa las preguntas así:

**Bloque A — Identidad:**

1. `id` — slug en minúsculas, sin espacios (también será el segmento de ruta `/games/<id>/play`). Sugiere uno basado en el nombre del juego.
2. `title` — nombre en MAYÚSCULAS tal como aparecerá en la UI (ej. `TETRIS`, `ARKANOID`).
3. `cat` — categoría en MAYÚSCULAS (ej. `PUZZLE`, `ARCADE`, `SHOOTER`).

**Bloque B — Textos:** 4. `short` — subtítulo de la card, una frase corta (≤ 60 chars). 5. `long` — párrafo para la ficha del juego, 2-3 oraciones.

**Bloque C — Visual:** 6. `color` — token de color: `cyan` (default), `magenta`, `yellow` o `green`. Solo `magenta` y `yellow` tienen clase de botón propia; el resto cae a cyan. Recomienda según la paleta del juego. 7. `cover` — clase CSS `cover-*`. Las clases existentes son: `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`. Si ninguna encaja, propón `cover-<id>` y el spec incluirá agregar la regla en `globals.css`.

Espera respuesta a cada bloque antes de continuar.

## Fase 4 — Generar el spec

Determina el número correlativo del siguiente spec: mira el listado de `specs/` que obtuviste al inicio y suma 1 al mayor número encontrado.

Crea el archivo `specs/NN-<id>-game.md` con **exactamente** esta estructura (basada en `specs/05-asteroides-game.md`), adaptada al juego inspeccionado:

```markdown
# NN-<id>-game

**Estado:** Borrador
**Dependencias:** 05-asteroides-game, 06-leaderboard-supabase
**Fecha:** <fecha actual del contexto>
**Objetivo:** <una sola frase que describa la integración>

---

## Scope

### Dentro del scope

- `lib/games/<id>.ts` — módulo TypeScript adaptado de `game.js`; exporta `init<Game>(canvas, callbacks): <Game>Controller`
- `components/games/<Game>Game.tsx` — Client Component que monta el canvas, llama a `init<Game>`, y hace de puente entre el módulo y la play page
- `app/games/<id>/play/page.tsx` — ruta estática, play page dedicada; incluye HUD React, botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con id `<id>`
  [Si cover es nueva:] - Regla `.cover-<id>` en `app/globals.css`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a <W>×<H>px)
- Ranking en tiempo real / realtime
  [Si el juego tiene sonido pero se descarta:] - Sonido (fuera de scope para esta integración)
  [Si el juego tiene niveles extra / features complejas:] - <feature> (queda para spec futuro)

---

## Data Model

### Interfaz del módulo (`lib/games/<id>.ts`)

(Adaptar los callbacks según el juego: si tiene vidas → onLivesChange; si tiene nivel → onLevelChange; si tiene líneas en lugar de vidas → onLinesChange; etc.)

\`\`\`ts
export interface <Game>Callbacks {
onScoreChange: (score: number) => void;
[onLivesChange: (lives: number) => void;] // si aplica
[onLevelChange: (level: number) => void;] // si aplica
onGameOver: (finalScore: number) => void;
}

export interface <Game>Controller {
pause: () => void;
resume: () => void;
destroy: () => void;
}

export function init<Game>(canvas: HTMLCanvasElement, callbacks: <Game>Callbacks): <Game>Controller;
\`\`\`

### Fila en tabla `games` (Supabase)

\`\`\`sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
'<id>',
'<TITLE>',
'<short>',
'<long>',
'<CAT>',
'<cover-class>',
'<color>'
);
\`\`\`

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican.

---

## Plan de implementación

1. **`lib/games/<id>.ts`** — adaptar `game.js` al módulo TypeScript:
   - Envolver toda la lógica en la factory `init<Game>(canvas, callbacks)`
   - Reemplazar `const canvas = document.getElementById(...)` y `const ctx = canvas.getContext('2d')` por los parámetros recibidos
   - Definir constantes `const W = <width>; const H = <height>;`
   - Estado del juego en variables de closure (no globales)
   - Listeners de teclado removibles:
     - Mover de `document.addEventListener` a `window.addEventListener` [si aplica según la inspección]
     - Set `GAME_KEYS` con las teclas que requieren `e.preventDefault()` (<lista de teclas detectadas>)
     - Función `pressed(code)` para detección de pulsación por frame (edge-trigger)
   - Flag `paused` interno; `pause()` lo activa, `resume()` lo desactiva y resetea `lastTime = null`
   - Loop RAF con clamp de dt (`Math.min(dt, 0.05)`) [o acumulador si el juego lo usa — especificar]
   - Llamar callbacks cuando cambia el estado: `onScoreChange`, [otros según el juego], `onGameOver`
   - Loop se auto-detiene en game over (no llama `requestAnimationFrame` de nuevo)
   - `destroy()` cancela el RAF pendiente (`cancelAnimationFrame(rafId)`) y elimina los listeners de teclado
   - [Si HUD en DOM: eliminar actualizaciones a `.textContent`; reemplazar por llamadas a los callbacks]
   - [Si asset loader: envolver el cuerpo de `init<Game>` en la llamada al loader; el controller se retorna desde el callback]
   - [Si dependencias externas (`LEVELS`, `spritesheet.js`): importarlas como módulos ES o copiarlas al módulo]
   - Retornar `{ pause, resume, destroy }`

2. **`components/games/<Game>Game.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<<Game>GameHandle, Props>` con handle `{ pause: () => void; resume: () => void }`
   - Props: `callbacks: <Game>Callbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `<Game>Controller`
   - `useImperativeHandle` expone `pause()` y `resume()` al padre
   - `useEffect(() => { ... }, [])` — monta `init<Game>(canvasRef.current!, callbacks)`, guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={<W>} height={<H>} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/<id>/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, [lives,] [level,] `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia
   - `gameRef = useRef<<Game>GameHandle>(null)` para controlar pausa/resume
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<Game>Game key={gameKey}`)
   - `handleSave`: llama `saveScore('<id>', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona estados `saving`/`saved`
   - HUD: score, [vidas,] [nivel,] botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<Game>Game` va dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games` y (si aplica) agregar `cover-<id>` en `app/globals.css`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)
     [Si cover es nueva:] - Agregar regla `.cover-<id>` en `app/globals.css` siguiendo el patrón de las demás reglas `cover-*`

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/<id>` muestra la ficha del juego con título <TITLE> y botón JUGAR AHORA
- [ ] `/games/<id>/play` carga sin errores y muestra el canvas con el juego corriendo
- [ ] El HUD de React muestra score [y demás stats] sincronizados con el estado interno del canvas
- [ ] [El stat correspondiente] actualiza en tiempo real al ocurrir eventos en el juego
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda
- [ ] Al game over aparece el modal con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/<id>` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego desde cero
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, etc.) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                    | Descartada                    | Razón                                                                             |
| ------------------------ | ------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/<id>/play/page.tsx`    | Dinámica `[id]/play/page.tsx` | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico |
| Comunicación juego→React | Callbacks en `init<Game>`                  | Custom DOM events             | Los callbacks son tipados, no requieren `addEventListener` en el componente       |
| HUD                      | Doble (canvas interno + React externo)     | Solo React                    | El canvas dibuja información clásica; React dibuja la capa de plataforma          |
| Reinicio                 | Remontar `<Game>Game>` via cambio de `key` | Función `restart()` interna   | Estado limpio sin lógica extra en el módulo                                       |
| Guardado de score        | Solo Supabase (`saveScore`)                | localStorage                  | Persistencia real; infraestructura ya existente (spec 06)                         |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar el id de `requestAnimationFrame` y cancelarlo en `destroy()`.
- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin llamar `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/<id>/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/<id>/play` resuelve al archivo estático y que los demás juegos siguen resolviendo al placeholder dinámico.
- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo <W>×<H>. En pantallas más pequeñas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
  [Si asset loader:] - **Inicialización asíncrona:** El loader de assets (`loadSpritesheet`) es async; `init<Game>` debe retornar el controller desde dentro del callback, o bien pre-cargar el asset antes de montar el componente. Mitigación: definida en el paso 1 del plan.
```

Muestra el spec completo al usuario y pide confirmación de cada sección antes de pasar a la siguiente (igual que `/spec`). Aplica correcciones y vuelve a mostrar la sección modificada hasta que el usuario confirme.

## Fase 5 — Cierre

Una vez confirmadas todas las secciones, guarda el archivo. Confirma al usuario:

```
✅ Spec generado.

Archivo: specs/NN-<id>-game.md
Estado:  Borrador

Próximos pasos:
  1. Revisá el spec y ajustá lo que haga falta.
  2. Cuando esté listo, cambiá "Borrador" a "Aprobado" manualmente en el archivo.
  3. Ejecutá /spec-impl NN-<id>-game para implementarlo paso a paso.
```

## Hard rules

- **No escribir ni modificar código de producción.** Solo se crea `specs/NN-<id>-game.md`. No tocar `lib/`, `app/`, `components/`, `globals.css`, ni ejecutar nada en Supabase.
- **Reutilizar sin re-especificar** la infraestructura existente: tablas `games`/`scores`, RLS policies, `saveScore` (en `lib/supabase/saveScore.ts`, no en `queries.ts`), `getTopScores`, `getGameStats`, `getAllGames`. Solo mencionar que ya existen.
- **El spec queda en estado Borrador.** El usuario lo aprueba manualmente antes de `/spec-impl`.
- **No generar el spec en una sola respuesta.** Mostrar sección por sección, esperar confirmación, aplicar cambios si los hay.
- **No asumir metadatos** que el usuario no confirmó. Si falta el `id`, `title`, `short`, `long`, `cat`, `color` o `cover`, preguntar antes de escribir el spec.

## Arguments

Si el usuario invocó `/nuevo-juego 03-tetris`, interpreta `03-tetris` como la carpeta en `references/started-games/`. Si el argumento no coincide con ninguna carpeta conocida, pregunta al usuario antes de continuar.

Si invocó `/nuevo-juego` sin argumentos, comienza por la Fase 1 y pide la fuente.
