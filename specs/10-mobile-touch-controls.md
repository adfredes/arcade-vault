# 10-mobile-touch-controls

**Estado:** Implementado
**Dependencias:** 05-asteroides-game, 07-tetris-game, 08-arkanoid-game, 09-snake-game
**Fecha:** 2026-06-25
**Objetivo:** Hacer jugables en móvil todos los juegos implementados añadiendo un gamepad virtual (D-pad + 2 botones de acción) debajo del canvas, visible solo en dispositivos táctiles, que despacha eventos sintéticos de teclado a window.

---

## Scope

### Dentro del scope

- `components/games/VirtualGamepad.tsx` — componente compartido: D-pad (4 direcciones) + 2 botones de acción (A, B); acepta `GamepadConfig` con el mapeo de teclas por juego; visible solo en móvil (`pointer: coarse` / media query); despacha `keydown`/`keyup` sintéticos a `window`
- Canvas escalado con CSS (`width: 100%; height: auto`) para ajustarse al viewport móvil manteniendo la resolución interna y la relación de aspecto
- Layout móvil en las 4 play pages:
  - HUD (score, vidas, nivel) **oculto** en móvil
  - Canvas arriba (escalado)
  - Gamepad virtual en el centro
  - Botón PAUSA + SkinSelector al pie (debajo del gamepad)
- Soporte portrait y landscape via media queries CSS
- Convención `GamepadConfig` disponible para futuros juegos

### Fuera del scope

- Cambios para desktop (teclado físico sigue funcionando sin modificar)
- Gestos swipe (solo botones)
- Gamepad hardware (Bluetooth/USB)
- Compactar o adaptar el HUD para desktop
- Sonido
- Guardar preferencia de esquema de control del usuario

---

## Data Model

### `GamepadConfig` (props de `VirtualGamepad`)

```ts
export interface GamepadConfig {
  dpadUp?: string; // key code dispatched on D-pad Up
  dpadDown?: string;
  dpadLeft?: string;
  dpadRight?: string;
  buttonA?: string; // key code dispatched on button A
  buttonALabel?: string; // label visible en el botón (e.g. "FIRE")
  buttonB?: string;
  buttonBLabel?: string;
}
```

### Configs por juego (definidas en cada play page)

| Juego      | D-pad ↑   | D-pad ↓     | D-pad ←     | D-pad →      | A                   | B                 |
| ---------- | --------- | ----------- | ----------- | ------------ | ------------------- | ----------------- |
| Asteroides | `ArrowUp` | `ArrowDown` | `ArrowLeft` | `ArrowRight` | `' '` · "FIRE"      | `Shift` · "HYPER" |
| Tetris     | —         | `ArrowDown` | `ArrowLeft` | `ArrowRight` | `ArrowUp` · "ROTAR" | `' '` · "DROP"    |
| Arkanoid   | —         | —           | `ArrowLeft` | `ArrowRight` | —                   | —                 |
| Snake      | `ArrowUp` | `ArrowDown` | `ArrowLeft` | `ArrowRight` | —                   | —                 |

> No se introducen nuevas tablas en Supabase ni cambios en `lib/games/*.ts`.

---

## Plan de implementación

1. **`components/games/VirtualGamepad.tsx`** — componente compartido:
   - `'use client'`
   - Props: `config: GamepadConfig`
   - Visible solo cuando `@media (pointer: coarse)` (dispositivos táctiles); oculto en desktop
   - Layout: D-pad a la izquierda (cruz de 4 botones), botones A y B a la derecha
   - Cada botón usa `onPointerDown` → `window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))` y `onPointerUp` → `dispatchEvent('keyup')` con la misma key
   - `setInterval` en `onPointerDown` para repetir `keydown` mientras el dedo está presionado; limpiarlo en `onPointerUp`
   - `touch-action: none` y `user-select: none` en el contenedor para evitar scroll/selección
   - Botones con `key === undefined` (no asignados) no se renderizan
   - Estilos: botones semitransparentes oscuros, bordes con el color de acento del tema actual

2. **Canvas scaling** — en cada `*Game.tsx`:
   - Mantener `width` y `height` como atributos HTML (resolución interna del juego intacta)
   - Añadir `style={{ width: '100%', height: 'auto', display: 'block' }}` para que CSS escale el canvas visualmente sin afectar la lógica del juego

3. **`app/games/asteroides/play/page.tsx`**:
   - Ocultar HUD con `hidden md:flex` (Tailwind)
   - Añadir `<VirtualGamepad config={ASTEROIDES_CONFIG} />` debajo del CRT shell
   - Añadir zona mobile-only `flex md:hidden` al pie con botón PAUSA + `<SkinSelector />`

4. **`app/games/tetris/play/page.tsx`** — misma operación que paso 3

5. **`app/games/arkanoid/play/page.tsx`** — misma operación que paso 3

6. **`app/games/snake/play/page.tsx`** — misma operación que paso 3

7. **Orientación portrait y landscape**:
   - Portrait: stack vertical (canvas → gamepad → pie)
   - Landscape: canvas más bajo en altura; gamepad compacto debajo; usar `@media (orientation: landscape) and (pointer: coarse)` para ajustes de altura (`max-height: 45vh` en el canvas)

8. **Verificar TypeScript** — `tsc --noEmit` sin errores

---

## Criterios de aceptación

- [ ] En desktop, el layout y el HUD de los 4 juegos no cambian visualmente
- [ ] En móvil, el HUD (score/vidas/nivel) está oculto en los 4 juegos
- [ ] En móvil, el canvas escala para no desbordar el viewport (sin scroll horizontal)
- [ ] El gamepad virtual aparece debajo del canvas en los 4 juegos en móvil
- [ ] El botón PAUSA y el SkinSelector aparecen debajo del gamepad en móvil
- [ ] D-pad izquierda/derecha mueve la paleta en Arkanoid
- [ ] D-pad arriba/abajo/izquierda/derecha cambia la dirección en Snake
- [ ] D-pad izquierda/derecha rota la nave en Asteroides; arriba empuja; abajo frena
- [ ] Botón A dispara en Asteroides; botón B activa hiperespacio
- [ ] D-pad izquierda/derecha/abajo mueve la pieza en Tetris; A rota; B hace hard drop
- [ ] Mantener presionado un botón del D-pad repite el evento (keydown continuo)
- [ ] Los botones A y B no asignados (Arkanoid, Snake) no aparecen en pantalla
- [ ] El layout funciona en portrait y landscape
- [ ] Los juegos existentes funcionan correctamente en desktop con teclado físico
- [ ] `tsc --noEmit` sin errores

---

## Decisiones tomadas y descartadas

| Decisión               | Elegida                                       | Descartada                            | Razón                                                                                   |
| ---------------------- | --------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| Mecanismo de input     | Eventos sintéticos de teclado a `window`      | Callbacks directos en cada play page  | Los módulos de juego ya escuchan `window`; cero cambios en `lib/games/*.ts`             |
| Detección de móvil     | `@media (pointer: coarse)`                    | `navigator.userAgent` / JS en runtime | CSS puro, sin lógica de detección en JS; más robusto ante cambios de UA                 |
| Tipo de control táctil | Botones virtuales (D-pad + A/B)               | Gestos swipe                          | Los botones son más precisos para juegos que requieren input sostenido (thrust, paleta) |
| HUD en móvil           | Oculto completamente                          | Compactar a una fila                  | Máximo espacio vertical para canvas + gamepad; pausa y skin van al pie                  |
| Escalado del canvas    | CSS `width: 100%; height: auto`               | `transform: scale()` / redibujado     | Más simple; preserva la resolución interna sin tocar la lógica del juego                |
| Scope de juegos        | Los 4 implementados + convención para futuros | Solo algunos juegos                   | Consistencia de plataforma; el esfuerzo marginal por juego adicional es mínimo          |
| Orientación            | Portrait y landscape                          | Solo landscape                        | Mayor accesibilidad; portrait es el modo natural en móvil                               |

---

## Riesgos identificados

- **Eventos sintéticos bloqueados:** Algunos navegadores móviles ignoran `KeyboardEvent` sintéticos en ciertos contextos de seguridad. Mitigación: testear en Chrome y Safari iOS antes de cerrar el spec; si falla, el fallback es callbacks directos en cada play page.

- **Keydown continuo en táctil:** `onPointerDown` dispara un solo evento; los juegos que necesitan key held (paleta de Arkanoid, thrust de Asteroides) requieren un intervalo que siga despachando `keydown` mientras el dedo está presionado. Mitigación: usar `setInterval` en `onPointerDown` y limpiarlo en `onPointerUp`.

- **Multi-touch:** El usuario puede presionar D-pad y botón A simultáneamente. Los eventos `pointer` soportan multi-touch nativamente; verificar que no se cancelen entre sí.

- **Canvas overflow en landscape:** En landscape con viewport muy bajo (ej. iPhone SE), el canvas escalado + gamepad pueden no caber sin scroll. Mitigación: limitar la altura del canvas con `max-height: 45vh` en landscape y ajustar el gamepad a tamaño compacto.

- **SkinSelector en play pages:** Verificar que el componente `SkinSelector` ya existe y es importable de forma independiente; si está acoplado al HUD, habrá que extraerlo antes de añadirlo al pie móvil.
