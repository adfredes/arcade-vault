# SPEC 14 — Hardening de seguridad (headers, password policy, anti-bot y advisors)

> **Estado:** Implementado · **Depende de:** SPEC 04 (Supabase setup), SPEC 13 (Supabase Auth) · **Fecha:** 2026-06-29
> **Objetivo:** Cerrar el checklist de seguridad básico (`references/security/security-checklist.md`) agregando los 3 headers de seguridad en Next.js, validando la fortaleza de la contraseña en el registro de `/auth` (mín. 8 caracteres con minúscula, mayúscula, dígito y símbolo) con feedback de error antes de llamar a Supabase, eliminando la función `rls_auto_enable()` que dispara 2 advisors, y documentando los ajustes de Auth de dashboard (password mínima, leaked password protection y rate limit de signups) hasta dejar los advisors de Supabase en verde.

---

## Por qué existe este spec

`references/security/security-checklist.md` lista las medidas de seguridad básicas que el proyecto debe cumplir. Al auditar el estado real (vía MCP Supabase) se confirmó que:

- **RLS ya está habilitado** en `games` y `scores` (ambas `rls_enabled: true`, con políticas; ningún advisor de RLS faltante). Este ítem del checklist ya está cubierto por SPEC 04 / SPEC 13 — solo se verifica.
- **Leaked password protection está OFF** (advisor `auth_leaked_password_protection`).
- La función **`public.rls_auto_enable()`** (un event-trigger helper que auto-activa RLS al crear tablas) tiene `EXECUTE` concedido a `anon`/`authenticated`/`public`, lo que dispara los advisors `0028`/`0029`. Quedó marcada para "otro spec" en SPEC 13 — este es ese spec.
- **Faltan** los headers de seguridad en Next.js, la política de longitud/fortaleza de contraseña y el límite de rate de signups.

Este spec cierra el checklist completo dejando los advisors de Supabase en verde y agregando la validación de contraseña en el cliente para no enviar a autenticar contraseñas que sabemos que el backend va a rechazar.

---

## Scope

**Dentro:**

- **Headers de seguridad** en `next.config.ts`: agregar `headers()` que aplique a `/(.*)` los 3 headers del checklist:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Validación de contraseña en el registro** (`app/auth/page.tsx`, solo tab "Crear cuenta"): una expresión regular que exija mínimo 8 caracteres con al menos una minúscula, una mayúscula, un dígito y un símbolo. Si no cumple, mostrar un mensaje de error en la UI **antes** de llamar a `supabase.auth.signUp` (no se dispara la petición). Mostrar también el texto de requisitos como ayuda en el campo.
- **Eliminar `rls_auto_enable()`**: migración que hace `DROP EVENT TRIGGER ensure_rls` y `DROP FUNCTION public.rls_auto_enable()`, eliminando ambos advisors. (Las tablas existentes ya tienen RLS; las futuras se activarán a mano — ver Decisiones.)
- **Documentar** los ajustes de Auth que el MCP no expone (se hacen en el dashboard), con verificación por advisor:
  - Minimum password length = 8.
  - Leaked password protection = ON (HaveIBeenPwned).
  - Max signup rate (rate limit de signups) ajustado como anti-bot.
- **Verificación final**: re-correr `get_advisors(security)` y confirmar 0 warnings de los 3 ítems tratados.
- Proteccion de rutas con Proxy Nexts.js: informacion sobre proxy aqui:
  https://nextjs.org/docs/app/getting-started/proxy

Ejemplo: proxy.ts

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url));
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: '/about/:path*',
};
```

**Fuera de scope (para specs futuros):**

- **CSP** (`Content-Security-Policy`) y otros headers extra (HSTS, Permissions-Policy): se difieren por riesgo de romper canvas/Supabase/Resend; requieren afinado y testeo dedicado.
- **CAPTCHA** (hCaptcha/Turnstile) en `/auth`: el anti-bot de este spec es solo el rate limit de dashboard. CAPTCHA toca la UI y requiere provider key/secret → otro spec.
- **Validación regex en el tab "Iniciar sesión"**: login solo verifica credenciales existentes; aplicar la política ahí bloquearía contraseñas legítimas anteriores a la política.
- **Sincronizar la política de fortaleza de contraseña en el servidor/dashboard**: Supabase no expone "requiere símbolo/dígito" por categorías vía MCP; la regla de complejidad vive en el cliente. El dashboard solo fuerza la longitud mínima.
- **Recuperación de contraseña, magic link, edición de perfil** (ya estaban fuera en SPEC 13).

---

## Data model

Este spec **no introduce nuevas estructuras de datos**. Solo elimina una función y un event trigger existentes, ajusta config y agrega validación de UI. No hay tablas ni columnas nuevas.

---

## Plan de implementación

> **Antes de tocar `next.config.ts`**, leer la guía relevante en `node_modules/next/dist/docs/01-app/` (config / headers): Next.js 16.2.9 puede tener convenciones distintas a las de entrenamiento. No asumir la API de versiones viejas.

1. **Headers de seguridad en Next.js.** En `next.config.ts`, agregar la función `headers()` al `NextConfig` (conservando `allowedDevOrigins`) que devuelva una regla para `source: '/(.*)'` con los 3 headers del checklist. Manual test: `curl -I http://localhost:3000/` y confirmar que los 3 headers aparecen en cualquier ruta.

2. **Validación de contraseña en el registro.** En `app/auth/page.tsx`:
   - Definir la constante regex de complejidad y un helper `isStrongPassword(pass)`.
   - En `submit`, cuando `tab === 'up'`, antes de `signUp`: si `!isStrongPassword(pass)`, hacer `setError(<mensaje de requisitos>)` y `return` (sin llamar a Supabase, sin dejar `loading` colgado).
   - Mostrar el texto de requisitos bajo el campo contraseña cuando `tab === 'up'` (hint estática).
   - Manual test: en "Crear cuenta", una contraseña débil (ej. `abc`) muestra el error y NO genera request de signup (verificar en Network); una fuerte (ej. `Vault123!`) pasa la validación y llama a `signUp`.

3. **Migración: eliminar `rls_auto_enable()`.** Vía MCP Supabase `apply_migration`: `DROP EVENT TRIGGER IF EXISTS ensure_rls;` seguido de `DROP FUNCTION IF EXISTS public.rls_auto_enable();`. Verificar con `list_migrations` que se aplicó y con una consulta a `pg_event_trigger`/`pg_proc` que ya no existen.

4. **Ajustes de Auth en el dashboard** (ver sección "Configuración manual de Supabase"): setear minimum password length = 8, activar leaked password protection, y ajustar el rate limit de signups.

5. **Verificación de advisors.** Re-correr `get_advisors` (security) y confirmar que desaparecieron `anon_security_definer_function_executable`, `authenticated_security_definer_function_executable` y `auth_leaked_password_protection`.

6. **Verificación de RLS (ya existente).** Confirmar con `list_tables` que `games` y `scores` siguen con `rls_enabled: true` y sus políticas intactas tras el DROP (no deberían verse afectadas).

7. **Proteccion de rutas con Proxy Next.js**

---

## Criterios de aceptación

- [ ] `curl -I` sobre cualquier ruta devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] En "Crear cuenta", una contraseña que no cumple (corta, o sin mayúscula/minúscula/dígito/símbolo) muestra un mensaje de error claro y **no** dispara la petición de `signUp` (verificable en Network).
- [ ] En "Crear cuenta", una contraseña que cumple los 5 requisitos (≥8, minúscula, mayúscula, dígito, símbolo) pasa la validación y procede al flujo normal de `signUp`.
- [ ] El campo contraseña en "Crear cuenta" muestra el texto de requisitos como ayuda.
- [ ] El tab "Iniciar sesión" NO aplica la regex (sigue funcionando con cualquier contraseña existente).
- [ ] La función `public.rls_auto_enable()` y el event trigger `ensure_rls` ya no existen en la base.
- [ ] `get_advisors(security)` no devuelve `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [ ] `get_advisors(security)` no devuelve `auth_leaked_password_protection` (leaked password protection activado en dashboard).
- [ ] El dashboard tiene minimum password length = 8 y un rate limit de signups configurado.
- [ ] `games` y `scores` siguen con RLS habilitado y sus políticas tras la migración.
- [ ] `tsc --noEmit` sin errores y `npm run dev` arranca sin errores.

---

## Decisiones tomadas y descartadas

- **Sí:** solo los 3 headers del checklist (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`). Literal al checklist, cero riesgo de romper la app.
- **No:** CSP ni HSTS/Permissions-Policy en este spec. CSP es delicada con canvas inline + Supabase + Resend; va en un spec dedicado con testeo.
- **Sí:** validación regex de contraseña en el cliente, solo en el tab de registro. Evita mandar a autenticar contraseñas que el backend rechazaría y da feedback inmediato.
- **No:** validar la regex en "Iniciar sesión". Login verifica credenciales existentes; aplicar la política ahí bloquearía cuentas válidas anteriores.
- **Sí:** eliminar `rls_auto_enable()` + `ensure_rls`. Las tablas actuales ya tienen RLS; el helper exponía una función SECURITY DEFINER a `anon`/`authenticated` sin necesidad real. Es la opción que el usuario eligió.
- **Consecuencia asumida:** las **tablas futuras** ya no tendrán RLS auto-activado; habrá que habilitarlo manualmente (`alter table ... enable row level security` + políticas) al crearlas. Documentar en el PR.
- **No:** cambiar la función a `SECURITY INVOKER`. Necesita privilegios de owner para `ALTER TABLE ... ENABLE RLS`; como invoker el trigger fallaría.
- **No:** solo revocar `EXECUTE`. Se optó por eliminar la función completa (decisión del usuario).
- **Sí:** ajustes de Auth (longitud mínima, leaked password, rate limit) como pasos de dashboard documentados, verificados por advisor. El MCP de Supabase no expone esa config (igual que en SPEC 13).
- **No:** CAPTCHA en este spec. El anti-bot acá es el rate limit de signups del dashboard; CAPTCHA toca la UI y necesita secrets → otro spec.

---

## Riesgos identificados

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` rompe algún embed legítimo del sitio en iframe                                       | El sitio no se embebe a sí mismo; los juegos corren en canvas, no en iframes. Si en el futuro se necesita embeber, cambiar a `SAMEORIGIN`.                                                  |
| La regex de contraseña diverge de la política del dashboard (cliente exige símbolo, dashboard solo longitud) | La regla de complejidad es client-side por diseño (Supabase no la expone por categorías). Documentar que la fuente de verdad de complejidad es el cliente; el dashboard fuerza la longitud. |
| Quitar `rls_auto_enable` deja tablas futuras sin RLS por olvido                                              | Documentar el cambio en el PR y en el CLAUDE.md/AGENTS.md si aplica; agregar el `enable row level security` como paso en futuras migraciones de tablas.                                     |
| Convenciones de `headers()` distintas en Next.js 16.2.9                                                      | Leer `node_modules/next/dist/docs/01-app/` antes de escribir la config; no asumir API de versiones viejas.                                                                                  |
| Los ajustes de Auth de dashboard requieren acceso no disponible por MCP                                      | Documentar los pasos manuales; la verificación se hace re-corriendo el advisor de seguridad.                                                                                                |

---

## Configuración manual de Supabase (paso 4)

El MCP de Supabase cubre schema/SQL/migraciones/advisors, pero **no** la config de Auth. Estos pasos se hacen en el **dashboard** (Authentication):

1. **Minimum password length.** Authentication → Policies / Password: setear longitud mínima = **8**.
2. **Leaked password protection.** Authentication → Password: activar la verificación contra HaveIBeenPwned (apaga el advisor `auth_leaked_password_protection`).
3. **Max signup rate (anti-bot).** Authentication → Rate Limits: ajustar el límite de signups (por hora) a un valor acorde al tráfico esperado para frenar registros masivos automatizados.

> El SMTP de prueba de Supabase tiene rate limit bajo; para volumen real configurar SMTP propio (fuera de scope). La política de **complejidad** de la contraseña (mayúscula/minúscula/dígito/símbolo) vive en el cliente (`/auth`), no en el dashboard.

---

## Apéndice — Expresión regular de contraseña

```ts
// app/auth/page.tsx — validación solo en el tab "Crear cuenta"
// ≥8 caracteres, al menos una minúscula, una mayúscula, un dígito y un símbolo.
const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function isStrongPassword(pass: string): boolean {
  return STRONG_PASSWORD.test(pass);
}

// Mensaje de error sugerido:
// "La contraseña debe tener mínimo 8 caracteres e incluir mayúscula,
//  minúscula, número y símbolo."
```
