# Porteo móvil por juego — Estado

> Mantenido por el agente `mobile-porter`. Un juego por corrida. No editar manualmente sin avisar al agente.

El patrón canónico vive en `specs/10-mobile-touch-controls.md`. El gamepad compartido es
`components/games/VirtualGamepad.tsx` y el selector `components/games/SkinSelector.tsx`. Detección touch
por CSS (`@media (pointer: coarse)`); el canvas escala con `width:100%; height:auto`.

## Estado por juego

| Juego      | Gamepad config | HUD oculto | Canvas escalado | Footer móvil | Portrait | Landscape | Última actualización |
| ---------- | -------------- | ---------- | --------------- | ------------ | -------- | --------- | -------------------- |
| asteroides | ✅             | ✅         | ✅              | ✅           | ✅       | ✅        | 2026-06-25           |
| tetris     | ✅             | ✅         | ✅              | ✅           | ✅       | ✅        | 2026-06-25           |
| arkanoid   | ✅             | ✅         | ✅              | ✅           | ✅       | ✅        | 2026-06-25           |
| snake      | ✅             | ✅         | ✅              | ✅           | ✅       | ✅        | 2026-06-25           |
| frogger    | ✅             | ✅         | ✅              | ✅           | ✅       | ✅        | 2026-06-29           |

Leyenda: ✅ aplicado y verificado · 🟡 en progreso · – pendiente

## Notas por juego

### frogger (2026-06-29)

- **Gamepad config** (`FROGGER_CONFIG` en `app/games/frogger/play/page.tsx`): solo D-pad
  (`dpadUp: 'ArrowUp'`, `dpadDown: 'ArrowDown'`, `dpadLeft: 'ArrowLeft'`, `dpadRight: 'ArrowRight'`).
  Sin botones A/B (la rana solo salta en 4 direcciones). Verificado: pulsar el D-pad arriba mueve la rana
  y suma puntos.
- **Listener de teclado**: `FroggerGame.tsx` escuchaba en `document`; se cambió a `window` para que los
  `KeyboardEvent` sintéticos del `VirtualGamepad` (que despacha vía `window.dispatchEvent`) lleguen al
  juego. El teclado físico sigue funcionando (los eventos reales burbujean hasta `window`). No se tocó la
  lógica de juego (física, scoring, colisiones, spawn).
- **Canvas**: 640×560 (8:7). Mantiene `width/height` internos; en portrait usa `max-height:100%` inline
  para encajar por altura dentro del CRT (4:3) sin recortar la fila de inicio (abajo). En landscape el
  tope `max-height:45vh` del bloque `@media (orientation: landscape) and (pointer: coarse)` de
  `globals.css` se reforzó con `!important` para ganar al inline en esa orientación (cero impacto en los
  otros juegos, que ya recibían 45vh).
- **HUD oculto / Footer**: clases `hidden md:flex` (HUD) y `flex md:hidden` (footer PAUSA + SkinSelector),
  idénticas al patrón canónico de asteroides.
- **Caveat de plataforma (no es regresión de frogger):** `.player-hud { display:flex }` en `globals.css`
  gana sobre el `.hidden` de Tailwind (en Tailwind v4 lo no-layered vence a la capa `utilities`), por lo
  que el HUD superior se ve también en móvil. Es idéntico en asteroides/tetris/arkanoid/snake; corregirlo
  es un cambio global fuera del alcance de un porteo de un solo juego.
  </content>
  </invoke>
