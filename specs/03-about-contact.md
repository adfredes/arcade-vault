# 03-about-contact

**Estado:** Implementado
**Dependencias:** 01-mvp-visual (globals.css, components/Nav.tsx), 02-home-landing (rutas /games)
**Fecha:** 2026-06-16
**Objetivo:** Implementar la página `/about` portando el template `about.jsx` y conectar
el formulario de contacto a Resend para envío real de emails.

---

## Scope

### Dentro del scope

- `app/about/page.tsx` — nueva ruta; porta el template `about.jsx` completo
  (sección "Acerca de" + sección "Contacto" con formulario)
- `app/api/contact/route.ts` — API route POST que llama a Resend y envía el mensaje
  a adfredes@gmail.com
- `components/Nav.tsx` — agregar link "Acerca de" → `/about` (desktop + mobile panel)
- `.env.local` — agregar variable `RESEND_API_KEY=` (valor a completar por el usuario)
- Sub-componentes inline en `app/about/page.tsx`: `HighlightIcon`, `useReveal`

### Fuera del scope

- Template de email HTML enriquecido (el email es texto plano con los campos del form)
- Rate limiting / captcha en el endpoint de contacto
- Guardar mensajes en base de datos
- Respuesta automática al remitente
- Cualquier cambio a otras rutas (`/`, `/games`, `/auth`, `/hall-of-fame`)

---

## Data Model

No se introducen estructuras de datos persistentes. Se define un tipo inline para el body
del endpoint:

```ts
// app/api/contact/route.ts
type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};
```

Variable de entorno requerida:

- `RESEND_API_KEY` — API key de Resend (valor vacío en `.env.local`, usuario la completa)

---

## Plan de implementación

1. **Instalar dependencia** — `npm install resend`

2. **Agregar variable de entorno** — crear/actualizar `.env.local` con:
   `RESEND_API_KEY=`

3. **Crear `app/api/contact/route.ts`** — handler POST que:
   - Parsea `{ name, email, msg }` del body
   - Valida que los tres campos estén presentes (400 si falta alguno)
   - Llama a `resend.emails.send()` con:
     - `from: "Arcade Vault <onboarding@resend.dev>"`
     - `to: ["adfredes@gmail.com"]`
     - `subject: "Nuevo mensaje de contacto — Arcade Vault"`
     - `text:` con los tres campos formateados
   - Retorna `{ ok: true }` (200) o `{ error: string }` (500)

4. **Crear `app/about/page.tsx`** — porta `about.jsx` al App Router:
   - Componentes inline: `HighlightIcon`, `useReveal` (IntersectionObserver)
   - `onSubmit` hace `fetch("POST", /api/contact)` en lugar de `setSent` directo
   - Estado adicional `error: string | null` para mostrar mensaje de error si la API falla
   - En éxito: `setSent(form.name)` → muestra terminal-success (igual al template)
   - En error: muestra banner rojo con texto del error debajo del botón enviar

5. **Actualizar `components/Nav.tsx`** — agregar link "Acerca de" en:
   - `.links` (desktop): `<Link href="/about">Acerca de</Link>` con `isActive` cuando
     `pathname === "/about"`
   - `av-mobile-panel` (mobile): mismo link

6. **Verificar TypeScript** — `tsc --noEmit` sin errores

---

## Criterios de aceptación

- [ ] `/about` renderiza sin errores con las dos secciones: "Acerca de" y "Contacto"
- [ ] Sección "Acerca de" muestra los 3 highlight cards (HEART, BROWSER, PLANT) con sus íconos pixel
- [ ] Divider animado aparece entre las dos secciones
- [ ] Secciones 2+ tienen animación reveal al hacer scroll (IntersectionObserver)
- [ ] Formulario valida campos vacíos: muestra animación shake sin enviar
- [ ] Submit hace POST a `/api/contact`; mientras espera el botón muestra estado de carga
- [ ] Envío exitoso muestra el terminal-success con el nombre del usuario en mayúsculas
- [ ] "ENVIAR OTRO MENSAJE" resetea el formulario y vuelve al estado inicial
- [ ] Envío fallido (Resend error) muestra banner de error debajo del botón sin borrar el formulario
- [ ] Email llega a adfredes@gmail.com con name, email y mensaje del remitente
- [ ] Nav desktop muestra link "Acerca de" activo cuando la ruta es `/about`
- [ ] Nav mobile muestra link "Acerca de" en el panel lateral
- [ ] `tsc --noEmit` sin errores

---

## Decisiones tomadas y descartadas

| Decisión                | Elegida                        | Descartada                          | Razón                                                                             |
| ----------------------- | ------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| Remitente (from)        | `onboarding@resend.dev`        | Dominio propio verificado           | No hay dominio verificado aún; onboarding@resend.dev funciona en sandbox          |
| Manejo de error en form | Banner de error explícito      | Mostrar éxito de todas formas       | Feedback claro al usuario; evita pensar que se envió cuando no                    |
| Template de email       | Texto plano                    | HTML enriquecido                    | Suficiente para un formulario de contacto; HTML agrega complejidad sin valor real |
| Sub-componentes         | Inline en `app/about/page.tsx` | Archivos separados en `components/` | Solo se usan en esta página; extraer sería over-engineering prematuro             |
| Rate limiting           | Fuera de scope                 | Middleware de Next.js               | No es crítico para el MVP; se puede agregar en spec futuro si hay abuso           |
| Guardar mensajes en DB  | Fuera de scope                 | Tabla `contact_messages`            | Resend actúa como registro suficiente por ahora                                   |

---

## Riesgos identificados

- **Sandbox de Resend:** `onboarding@resend.dev` como remitente solo permite enviar
  a emails verificados en la cuenta de Resend (modo sandbox). Si `adfredes@gmail.com`
  no está verificado en la cuenta, los emails no llegarán. Solución: verificar ese
  email en el dashboard de Resend antes de probar, o usar un dominio propio.

- **`RESEND_API_KEY` vacía en producción:** Si la variable no se configura en el entorno
  de deploy, el endpoint retornará 500. No rompe el build, pero el formulario siempre
  mostrará error. Recordar configurar la variable en Vercel/hosting antes de deploy.
