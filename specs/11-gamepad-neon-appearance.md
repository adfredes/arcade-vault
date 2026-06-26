# 11-gamepad-neon-appearance

**Estado:** Aprobado
**Dependencias:** 10-mobile-touch-controls
**Fecha:** 2026-06-26
**Objetivo:** Rediseñar visualmente el `VirtualGamepad` para que replique la apariencia del gamepad neón de `references/gamepad-assets/` (shell con borde/glow, D-pad con flechas SVG y gema central pulsante, botones A/B circulares horizontales con glow magenta/cian), sin alterar su comportamiento funcional de input.

---

## Scope

### Dentro del scope

- **`components/games/VirtualGamepad.tsx`** — rediseño visual completo:
  - **Shell `.gp`**: contenedor con `linear-gradient` de fondo, borde neón (`--line`), `border-radius`, glow exterior, doble pseudo-elemento (`::before` borde interior, `::after` textura de puntos), inset highlights.
  - **D-pad**: 4 botones direccionales en cruz con forma redondeada y sombra 3D (`box-shadow 0 4px 0`), flechas **SVG** triangulares (no unicode), estado `active`/`on` con hundimiento (`translateY`) + glow cian. **Hub central** con gema (`clip-path` rombo) **pulsante** (`@keyframes pulse-led`).
  - **Botones A/B**: circulares, **horizontales** (B cian a la izquierda, A magenta a la derecha), letra grande en `--pixel` (Press Start 2P), glow de color, anillo dashed en hover/press, hundimiento en `active`.
  - Mantiene visibilidad solo en táctil (`@media (pointer: coarse)`).
- **`app/globals.css`** — nuevas clases `.gp*` (siguiendo la convención de `.crt*`), usando las variables CSS del sitio (`--cyan`, `--magenta`, `--ink*`, `--line`, `--pixel`) en vez de hex hardcodeados.
- **Deprecar labels A/B**: quitar `buttonALabel` / `buttonBLabel` de la interfaz `GamepadConfig` y de los configs en las 4 play pages (Asteroides, Tetris, Arkanoid, Snake) — los botones muestran solo la letra A/B.

### Fuera del scope

- Comportamiento de input (eventos sintéticos `keydown`/`keyup`, repeat con `setInterval`, multi-touch) — se conserva **sin cambios**.
- Mapeo de teclas por juego (`dpadUp`, `buttonA`, etc.) — intacto.
- Acoplar el gamepad al sistema de skins del canvas (seguiría siendo neón siempre).
- Mostrar direcciones de D-pad no asignadas (se siguen ocultando: Arkanoid solo ←→, Snake 4 dirs).
- Cambios en desktop / teclado físico.
- Layout de las play pages más allá del propio componente (HUD oculto, footer PAUSA+SkinSelector ya existen del spec 10).
- Sonido / vibración háptica.

---

## Data Model

No se introducen estructuras de datos nuevas. La única modificación al modelo es la **reducción** de la interfaz `GamepadConfig`:

```ts
export interface GamepadConfig {
  dpadUp?: string;
  dpadDown?: string;
  dpadLeft?: string;
  dpadRight?: string;
  buttonA?: string; // key code despachado por el botón A (magenta, derecha)
  buttonB?: string; // key code despachado por el botón B (cian, izquierda)
  // buttonALabel y buttonBLabel ELIMINADOS — los botones muestran solo "A" / "B"
}
```

Mapeo por juego (sin cambios respecto al spec 10, solo se ignoran los labels):

| Juego      | ↑         | ↓           | ←           | →            | A (magenta) | B (cian) |
| ---------- | --------- | ----------- | ----------- | ------------ | ----------- | -------- |
| Asteroides | `ArrowUp` | `ArrowDown` | `ArrowLeft` | `ArrowRight` | `' '`       | `Shift`  |
| Tetris     | —         | `ArrowDown` | `ArrowLeft` | `ArrowRight` | `ArrowUp`   | `' '`    |
| Arkanoid   | —         | —           | `ArrowLeft` | `ArrowRight` | —           | —        |
| Snake      | `ArrowUp` | `ArrowDown` | `ArrowLeft` | `ArrowRight` | —           | —        |

> Sin tablas Supabase ni cambios en `lib/games/*.ts`.

---

## Plan de implementación

Cada paso deja el sistema funcional.

1. **`app/globals.css` — clases `.gp*`** (basadas en el `<style>` de `references/gamepad-assets/gamepad.html`, sustituyendo hex por variables del sitio):
   - `.gp` (shell): gradiente de fondo, `border: 1px solid var(--line)`, `border-radius`, `box-shadow` con glow, `::before` (borde interior cian) y `::after` (textura de puntos).
   - `.gp-body` (grid 2 columnas), `.gp-col`, `.gp-col-left`, `.gp-col-right`.
   - `.gp-dpad`, `.dp`, `.dp-arrow`, estados `.dp.on` / `.dp:active` con glow `--cyan`; posiciones `.dp-up/.dp-down/.dp-left/.dp-right`.
   - `.dp-hub`, `.dp-hub-gem` + `@keyframes pulse-led`.
   - `.gp-actions`, `.ab`, `.ab.a` (magenta), `.ab.b` (cian), `.ab-letter`, `.ab-ring`, estados `.ab.on` / `.ab:active`.
   - Media query `@media (max-width: 620px)` con los tamaños compactos del asset.
   - Las variables `--ab-mid` / `--ab-deep` / `--ab-glow` se derivan de `--cyan` / `--magenta` (vía `color-mix` o rgba equivalentes) para no hardcodear color.

2. **`components/games/VirtualGamepad.tsx` — markup nuevo**:
   - Conservar `'use client'`, `useRef`, `REPEAT_MS`, `KEY_TO_CODE`, `dispatchKey`, `press`, `release`, `handlers` **sin cambios funcionales**.
   - Reemplazar el JSX por la estructura del asset: `<div class="gp">` → `.gp-body` → columna izquierda con `.gp-dpad` (4 `<button class="dp dp-*">` con SVG + `.dp-hub`/`.dp-hub-gem`), columna derecha con `.gp-actions` (`<button class="ab b">B</button>`, `<button class="ab a">A</button>`).
   - El control de visibilidad táctil (`hidden [@media(pointer:coarse)]:flex`) se mantiene en el wrapper externo del `.gp`.
   - Las flechas del D-pad usan los 4 paths SVG del asset (`dp-up/right/down/left`).
   - Botones no asignados (`config.dpadX` / `config.buttonX` undefined) **no se renderizan** (se omite ese `<button>`), igual que hoy.
   - Aplicar `e.preventDefault()` en `onPointerDown` (se mantiene).

3. **Quitar `buttonALabel` / `buttonBLabel`**:
   - De la interfaz `GamepadConfig`.
   - De los configs en `app/games/asteroides/play/page.tsx`, `app/games/tetris/play/page.tsx`, `app/games/arkanoid/play/page.tsx`, `app/games/snake/play/page.tsx` (eliminar las líneas `buttonALabel`/`buttonBLabel`).

4. **Verificar TypeScript**: `npx tsc --noEmit` sin errores.

5. **Verificación visual con Playwright** en viewport móvil (`pointer: coarse`):
   - Navegar a cada play page, comprobar que el gamepad coincide con `gamepad-neon.png`.
   - Verificar estado `on`/`active` (glow) al presionar D-pad y A/B.
   - Guardar capturas en `.playwright-screenshots/`.

---

## Criterios de aceptación

- [ ] El gamepad en móvil reproduce el shell neón del asset (borde, glow, textura de puntos, hub con gema pulsante).
- [ ] El D-pad usa flechas SVG triangulares y se hunde con glow cian al presionar (`active`/`on`).
- [ ] La gema central del hub pulsa (animación `pulse-led`).
- [ ] Los botones A/B son circulares, horizontales, con B (cian) a la izquierda y A (magenta) a la derecha, mostrando solo la letra en fuente Press Start 2P con glow.
- [ ] Los botones A/B muestran el anillo dashed al presionar y se hunden (`active`).
- [ ] El gamepad sigue visible solo en táctil (`pointer: coarse`) y oculto en desktop.
- [ ] Las direcciones de D-pad no asignadas (Arkanoid ↑↓ + A/B; Snake A/B; Tetris ↑) no se renderizan.
- [ ] El input sigue funcionando: D-pad y A/B despachan los mismos `keydown`/`keyup` que antes en los 4 juegos.
- [ ] Mantener presionado un botón repite el `keydown` (repeat con `setInterval` intacto).
- [ ] `buttonALabel` / `buttonBLabel` ya no existen en `GamepadConfig` ni en los 4 configs.
- [ ] No hay scroll/selección accidental al tocar el gamepad (`touch-action: none`, `user-select: none`).
- [ ] `npx tsc --noEmit` sin errores.
- [ ] Capturas Playwright en `.playwright-screenshots/` confirman el parecido con `gamepad-neon.png`.

---

## Decisiones tomadas y descartadas

| Decisión             | Elegida                                                 | Descartada                       | Razón                                                                                                   |
| -------------------- | ------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Color del gamepad    | Variables CSS del sitio (`--cyan`/`--magenta`/`--ink*`) | Hex hardcodeados del asset       | Mismo resultado neón que el asset, coherente con el chrome del sitio, sin duplicar valores              |
| Acople al skin       | Independiente del SkinSelector (siempre neón)           | Seguir la paleta del canvas      | El SkinSelector solo repinta el canvas, no toca CSS vars; acoplarlo sería plomería nueva fuera de scope |
| Labels de A/B        | Solo letra "A"/"B" (estilo asset)                       | Conservar FIRE/HYPER/ROTAR/DROP  | Fidelidad al asset; el shell circular no aloja texto largo legible                                      |
| Layout A/B           | Horizontal (B izq cian, A der magenta)                  | Stack vertical actual            | Replica exacta del asset                                                                                |
| Ubicación de estilos | Clases `.gp*` en `app/globals.css`                      | Tailwind/inline en el componente | Sigue la convención de `.crt*`; el estilo es complejo (pseudo-elementos, keyframes)                     |
| D-pad incompleto     | Ocultar direcciones no asignadas                        | Mostrarlas deshabilitadas        | Evita botones inertes; mantiene el comportamiento del spec 10                                           |
| Flechas del D-pad    | SVG triangulares del asset                              | Caracteres unicode ▲◀▶▼          | Fidelidad visual y nitidez en cualquier tamaño                                                          |

---

## Riesgos identificados

- **`color-mix` / derivar tonos A/B:** El asset usa rgba intermedios (`--ab-mid`, `--ab-deep`, `--ab-glow`). Derivarlos de `--cyan`/`--magenta` con `color-mix()` requiere soporte del navegador móvil objetivo; si falla, fallback a rgba fijos equivalentes (sigue siendo neón, solo no derivado de la variable).
- **Tamaño del shell en landscape:** El shell `.gp` (max-width grande) + canvas pueden no caber en landscape de viewport bajo. Mitigación: respetar el `max-height: 45vh` del canvas (spec 10) y la media query compacta del gamepad.
- **Romper el mapeo de teclas al reescribir el JSX:** Al cambiar el markup hay riesgo de desconectar `handlers(config.xxx)` de algún botón. Mitigación: verificación Playwright de input por juego en los criterios de aceptación.
- **Play pages con label residual:** Si algún config olvida quitar `buttonALabel`/`buttonBLabel`, TypeScript fallará tras eliminarlos de la interfaz — el error es deseado y guía la limpieza.
