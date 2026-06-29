---
name: spec-impl-game
description: Implementa un spec de juego aprobado igual que /spec-impl y, al terminar, encadena automáticamente skin-designer y luego mobile-porter sobre ese juego. Úsalo para integrar un juego nuevo y dejarlo con skins y soporte móvil en una sola pasada.
disable-model-invocation: true
argument-hint: <NN-spec-name>
---

# /spec-impl-game — Implementar un juego y dejarlo con skins + móvil

Esta skill es un envoltorio de `/spec-impl` pensado para **juegos**. Hace exactamente lo mismo que `/spec-impl` (reutilizando su procedimiento canónico, sin duplicar su lógica) y, cuando la implementación termina, **encadena automáticamente** dos agentes sobre el juego recién implementado, **uno tras otro, nunca en paralelo**:

1. `skin-designer` — le añade skins (neon, retro, clásico/default).
2. `mobile-porter` — lo hace jugable y legible en móvil.

El resultado de una sola invocación: el juego implementado, con skins y con soporte móvil, todo en la misma rama lista para PR.

## Contexto de sesión

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

---

## Fase 1 — Implementar el spec con el procedimiento canónico de `/spec-impl`

El argumento recibido es: `$ARGUMENTS`

**No reescribas ni reinventes los pasos de `/spec-impl`.** El procedimiento canónico es la única fuente de verdad. Para ejecutarlo:

1. Lee el SKILL.md instalado de `/spec-impl` en `~/.claude/skills/spec-impl/SKILL.md` (es un symlink a `~/.agents/skills/spec-impl/SKILL.md`).
   - Si ese archivo **no existe**, detente y avisa al usuario: el wrapper depende del `/spec-impl` instalado de `Klerith/fernando-skills` y no puede continuar sin él.
2. **Sigue TODAS sus fases tal cual**, pasando `$ARGUMENTS` como la spec a implementar:
   - Fase 1 (canónica): identificar `specs/NN-<slug>.md` (acepta nombre completo, solo número, o solo slug). Si `$ARGUMENTS` viene vacío, lista los specs y pide el nombre.
   - Fase 2 (canónica): validar que el estado **signifique "Aprobado"** (en cualquier idioma). Si no lo es, **detente** con el mensaje de error estándar de `/spec-impl`. No ofrezcas alternativas: el bloqueo es intencional.
   - Fase 3 (canónica): derivar y crear la rama `spec-NN-slug`, cambiarte a ella, y mostrar objetivo/scope/plan/criterios.
   - Fase 4 (canónica): implementar **paso a paso, con pausas para revisar el diff** y esperando confirmación entre pasos, exactamente como manda `/spec-impl`.
3. Al terminar el último paso, **verifica los criterios de aceptación uno por uno**. Solo cuando estén verdes, actualiza el estado del spec a "Implementado" (o el equivalente del repo).

No avances a la Fase 2 de esta skill hasta que la implementación esté completa y los criterios de aceptación verificados.

---

## Fase 2 — Derivar el id del juego

Una vez implementado el juego, determina el `<id>` del juego para pasárselo a los agentes:

1. **Desde el nombre del spec:** los specs de juego siguen el patrón `specs/NN-<id>-game.md`. Extrae el `<id>` quitando el prefijo `NN-` y el sufijo `-game`. Ejemplos:
   - `specs/12-pacman-game.md` → `pacman`
   - `specs/08-frogger-game.md` → `frogger`
2. **Respaldo desde el contexto de implementación:** confirma el `<id>` con los artefactos reales que creaste — debe existir `lib/games/<id>.ts` y `app/games/<id>/play/page.tsx`. Si el slug del spec no coincide con esos archivos, usa el `<id>` real de la implementación.
3. **Muestra el id derivado al usuario** antes de seguir.
4. Si **no puedes determinar el `<id>` con confianza** (el spec no es de un juego, no hay `lib/games/<id>.ts`, etc.), **pregunta** al usuario cuál es el id del juego —o si el spec no era de un juego, avísale que `skin-designer`/`mobile-porter` solo aplican a juegos y pregúntale cómo proceder— antes de lanzar ningún agente.

Los agentes corren sobre la **misma rama `spec-NN-slug`** que creó `/spec-impl`, para que las skins y el soporte móvil queden en el mismo PR.

---

## Fase 3 — Encadenar skin-designer (1.º)

Automático, con aviso (sin pausa de confirmación). Anuncia al usuario:

```
✅ Implementación lista (<id>). Lanzando skin-designer sobre <id>…
```

Lanza **un solo** agente con la herramienta Agent (`subagent_type: skin-designer`), indicándole claramente que trabaje el juego `<id>`. **Espera a que termine** antes de continuar.

---

## Fase 4 — Encadenar mobile-porter (2.º, secuencial)

Solo **cuando skin-designer haya terminado**, anuncia:

```
✅ Skins listas (<id>). Lanzando mobile-porter sobre <id>…
```

Lanza **un solo** agente con la herramienta Agent (`subagent_type: mobile-porter`), indicándole que portee el juego `<id>` a móvil. **Espera a que termine.**

> **Crítico:** las Fases 3 y 4 son **dos llamadas Agent separadas, una después de la otra** — nunca en el mismo mensaje. skin-designer siempre **antes** que mobile-porter, y **jamás** en paralelo.

---

## Fase 5 — Cierre

Cuando ambos agentes terminen, muestra un resumen final:

```
✅ Juego <id> listo de punta a punta.

  Implementación →  rama spec-NN-slug, criterios de aceptación verificados
  Skins          →  classic / retro / neon (ver references/game-with-theme.md)
  Móvil          →  VirtualGamepad + canvas escalado (ver references/mobile-ported.md)

Próximo paso: revisar el diff y abrir el PR de la rama spec-NN-slug.
```

---

## Hard rules

- **No dupliques la lógica de `/spec-impl`.** Sigue el SKILL.md canónico instalado; si cambia, esta skill hereda el cambio automáticamente.
- **El bloqueo por estado es intencional.** Si el spec no significa "Aprobado", detente con el mensaje estándar de `/spec-impl`. No empieces "igual".
- **Respeta las pausas paso a paso** de la Fase 4 canónica: no implementes todo de golpe sin confirmación entre pasos.
- **skin-designer siempre antes que mobile-porter**, en llamadas Agent separadas y secuenciales. Nunca simultáneas.
- **Un solo juego.** Ambos agentes trabajan únicamente el `<id>` derivado; no tocan otros juegos ni el resto del sitio.
- **Si no es un juego**, no fuerces los agentes: avísalo y pregunta cómo proceder.

## Arguments

Si el usuario invocó `/spec-impl-game 12-pacman-game`, interpreta `12-pacman-game` como la spec a implementar (acepta también solo el número o solo el slug, como `/spec-impl`).

Si invocó `/spec-impl-game` sin argumentos, empieza por la Fase 1: lista los specs disponibles y pide cuál implementar.
