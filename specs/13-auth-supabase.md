# SPEC 13 — Autenticación con Supabase Auth (registro, login y sesión)

> **Estado:** Aprobado · **Depende de:** SPEC 04 (clientes Supabase), SPEC 06 (leaderboard/scores) · **Fecha:** 2026-06-29
> **Objetivo:** Reemplazar la auth falsa de localStorage por Supabase Auth real (email+password con verificación, OAuth Google/GitHub e invitado) en la página `/auth`, con sesión SSR refrescada por middleware y puntajes vinculados al usuario.

---

## Por qué existe este spec

La app simula sesión guardando solo un nombre en `localStorage` (`av_user`), sin identidad real ni protección. Los botones sociales son decorativos y los puntajes no están atados a ninguna cuenta. Este spec introduce identidad real con Supabase Auth, manteniendo la API del hook `useUser` para no reescribir `Nav.tsx` ni las play pages, y conservando el acceso de invitado.

---

## Scope

**Dentro:**

- Migrar `context/UserContext.tsx` para que la sesión provenga de Supabase Auth (`onAuthStateChange`, `getUser`), conservando la API pública del hook (`user`, `signOut`) para no romper `Nav.tsx` ni las play pages.
- `app/auth/page.tsx`: cablear los tabs a Supabase real:
  - **Crear cuenta:** `signUp` (email + password) con `display_name` en `options.data`, y verificación por email obligatoria.
  - **Iniciar sesión:** `signInWithPassword`.
  - **OAuth:** botones Google y GitHub funcionales vía `signInWithOAuth`.
  - **Invitado:** conservar acceso anónimo (sin cuenta, sin sesión Supabase).
- Estados de UI: cargando, error (credenciales inválidas, email ya registrado), y pantalla/estado **"revisa tu correo"** tras el registro.
- `app/auth/callback/route.ts`: Route Handler que intercambia el `code` por sesión (OAuth + confirmación de email) y redirige.
- `middleware.ts`: refresca cookies de sesión en cada request (patrón `@supabase/ssr`). **No bloquea rutas.**
- Migración DB: agregar `scores.user_id uuid` (FK → `auth.users`, nullable) + políticas RLS de `INSERT`/`SELECT` que permitan invitados (user_id null) y autenticados.
- `lib/supabase/saveScore.ts`: setear `user_id` del usuario logueado (o null si invitado).
- Config vía MCP Supabase: habilitar providers Google/GitHub y plantilla de email de verificación (en lo que el MCP permita; lo que requiera secrets del dashboard se documenta).

**Fuera de scope (para specs futuros):**

- Recuperación de contraseña / "olvidé mi contraseña" (reset por email).
- Magic link (login sin password).
- Tabla `profiles` dedicada (se usa `user_metadata` por ahora).
- Edición de perfil, avatar, cambio de username post-registro.
- Backfill / migración de los scores antiguos (`user_id` queda null en los existentes).
- Protección/bloqueo de rutas por sesión.
- Borrado de cuenta y gestión de privacidad (GDPR).

---

## Data model

**1. `user_metadata` (Supabase Auth, sin tabla nueva).** El username se guarda en el registro:

```ts
// signUp(...)
{
  email,
  password,
  options: {
    data: { display_name: 'PX_KAI' }, // username, MAYÚSCULAS, slice(0,10)
    emailRedirectTo: `${origin}/auth/callback`,
  },
}
// se lee luego como: user.user_metadata.display_name
```

**2. Hook de sesión (API pública conservada).** `User` pasa de `{ name }` a derivarse del usuario Supabase:

```ts
// context/UserContext.tsx
export type User = {
  id: string; // auth.users.id (ausente en invitado)
  name: string; // display_name ?? parte local del email ?? 'PLAYER1'
};
// useUser(): { user: User | null, signOut(): Promise<void>, ... }
// 'login' deja de aceptar un nombre arbitrario: la sesión la dicta Supabase.
```

**3. Tabla `scores` — migración.** Estado actual: `id, game_id, player_name, score, created_at`. Se agrega:

```sql
alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null;

alter table public.scores enable row level security;

-- Lectura pública (leaderboard visible para todos)
create policy "scores_select_public" on public.scores
  for select using (true);

-- Inserción: invitado (user_id null) o el propio usuario autenticado
create policy "scores_insert_self_or_guest" on public.scores
  for insert with check (
    user_id is null or user_id = auth.uid()
  );
```

`player_name` se mantiene (texto libre, llenado con `display_name` o `'INVITADO'`). Los scores existentes quedan con `user_id = null`.

**Convenciones:**

- `display_name`: MAYÚSCULAS, máx 10 caracteres (igual que hoy).
- Invitado = sin sesión Supabase, `user_id = null`, `player_name = 'INVITADO'`.
- Redirect OAuth/verificación siempre a `/auth/callback`.

---

## Plan de implementación

> **Antes de escribir código de Next.js**, leer las guías relevantes en `node_modules/next/dist/docs/01-app/` (middleware y route handlers): esta versión (Next.js 16.2.9) tiene convenciones distintas a las de entrenamiento.

1. **Migración DB.** Aplicar la migración de `scores` (columna `user_id` + RLS) vía MCP Supabase (`apply_migration`). Verificar con `list_tables` que la columna y las policies existen. Regenerar tipos si aplica.

2. **Middleware de sesión.** Crear `middleware.ts` en la raíz que refresca cookies con `@supabase/ssr` (cliente server + `getUser()`), con `matcher` que excluye estáticos. Manual test: navegar entre páginas autenticado y confirmar que la sesión persiste tras refresh.

3. **Callback handler.** Crear `app/auth/callback/route.ts` que toma `code` de la query, hace `exchangeCodeForSession` y redirige a `/` (o a `next` si viene). Deja el sistema listo para OAuth y verificación de email.

4. **Migrar `UserContext`.** Reescribir `context/UserContext.tsx` para derivar `user` de Supabase (`getUser` inicial + `onAuthStateChange`), exponiendo la misma forma (`user`, `signOut`). `signOut` llama a `supabase.auth.signOut()`. Sin romper imports existentes. Manual test: el Nav muestra el nombre real tras login.

5. **Página `/auth` — login y registro email.** Cablear el form: tab "Iniciar sesión" → `signInWithPassword`; tab "Crear cuenta" → `signUp` con `display_name` y `emailRedirectTo`. Agregar estados `loading` y `error`. Manual test: registrarse e iniciar sesión con email+password.

6. **Estado "revisa tu correo".** Tras `signUp` exitoso, mostrar el panel de verificación pendiente (en vez de redirigir). Manual test: registrarse muestra el mensaje; el email de confirmación llega y `/auth/callback` inicia sesión.

7. **OAuth Google/GitHub.** Cablear los botones a `signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback' } })`. Manual test: ambos botones inician el flujo OAuth y vuelven autenticados.

8. **Invitado.** Ajustar "JUGAR COMO INVITADO" para que limpie cualquier sesión y entre sin cuenta. Manual test: como invitado, `user` es null y se puede jugar.

9. **`saveScore` con `user_id`.** Actualizar `lib/supabase/saveScore.ts` para incluir `user_id` (del usuario logueado o null). Ajustar las llamadas en las play pages para pasar el id si hace falta. Manual test: un score autenticado guarda `user_id`; uno de invitado lo guarda null.

10. **Config Supabase (MCP + manual).** Habilitar providers Google/GitHub y la plantilla de email de verificación vía MCP en lo posible; documentar en el spec/PR los pasos del dashboard que requieran secrets (Client ID/Secret de OAuth) no accesibles por MCP.

---

## Criterios de aceptación

- [ ] Un usuario nuevo puede registrarse con email+password y ve el estado "revisa tu correo".
- [ ] El email de verificación llega y, al hacer clic, `/auth/callback` deja la sesión iniciada.
- [ ] Un usuario verificado puede iniciar sesión con email+password.
- [ ] Credenciales inválidas muestran un mensaje de error legible (no crash, no console error sin manejar).
- [ ] Registrar un email ya existente muestra un mensaje de error claro.
- [ ] El botón Google inicia OAuth y vuelve a la app autenticado.
- [ ] El botón GitHub inicia OAuth y vuelve a la app autenticado.
- [ ] "Jugar como invitado" entra sin sesión y permite jugar; `user` es null.
- [ ] El Nav muestra el `display_name` real del usuario tras iniciar sesión.
- [ ] `signOut` cierra la sesión Supabase y el Nav vuelve a "Iniciar Sesión".
- [ ] La sesión persiste tras recargar la página (cookies refrescadas por el middleware).
- [ ] La tabla `scores` tiene columna `user_id` y RLS activo con las dos policies.
- [ ] Un score guardado por un usuario logueado tiene `user_id`; uno de invitado lo tiene null.
- [ ] El leaderboard sigue mostrándose para todos (select público).
- [ ] `tsc --noEmit` sin errores y `npm run dev` arranca sin errores de Supabase/auth.

---

## Decisiones tomadas y descartadas

- **Sí:** Supabase Auth real (`@supabase/ssr`). Ya está configurado en SPEC 04; los campos email/password ya existen en la UI.
- **No:** mantener la auth falsa de localStorage. No da identidad real ni protege nada.
- **Sí:** username en `user_metadata.display_name`. Cero tablas nuevas, suficiente para el caso.
- **No:** tabla `profiles` dedicada. Overengineering por ahora; se hará en otro spec si hace falta perfil editable.
- **Sí:** verificación de email obligatoria. Evita cuentas con emails falsos; requiere `/auth/callback` y estado "revisa tu correo".
- **Sí:** `user_id` en `scores` con RLS. Liga puntajes a la cuenta y habilita futuras vistas "mis scores".
- **No:** backfill de scores antiguos. Quedan con `user_id` null; no aportan valor migrarlos.
- **Sí:** una sola página `/auth` con tabs. Menos rutas, menos cambios; el patrón actual ya funciona.
- **No:** rutas `/login` y `/register` separadas. Más archivos sin beneficio claro hoy.
- **Sí:** middleware que solo refresca sesión. Requerido por `@supabase/ssr` para SSR correcto.
- **No:** middleware que bloquea rutas. Jugar como invitado debe seguir libre en todo el sitio.
- **No:** "olvidé mi contraseña" y magic link en este spec. Van en specs aparte.

---

## Riesgos identificados

| Riesgo                                                                 | Mitigación                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| OAuth requiere Client ID/Secret del dashboard no accesibles por MCP    | Documentar los pasos manuales en el PR; el código queda listo y los botones se prueban una vez configurados.   |
| RLS de `INSERT` mal definida bloquea el guardado de scores de invitado | Probar explícitamente inserción autenticada y de invitado en el criterio de aceptación antes de cerrar.        |
| El cliente browser de `saveScore` no tiene el `user_id` al insertar    | Obtener el usuario vía `supabase.auth.getUser()` dentro de `saveScore`, no pasarlo a mano desde cada juego.    |
| Convenciones de middleware distintas en Next.js 16.2.9                 | Leer `node_modules/next/dist/docs/01-app/` antes de escribir el middleware; no asumir API de versiones viejas. |
| Email de verificación no llega (SMTP por defecto de Supabase limitado) | Verificar plantilla/envío en el dashboard; documentar límite de rate del SMTP de prueba.                       |

---

## Configuración manual de Supabase (paso 10)

Las tools MCP de Supabase cubren schema/SQL/migraciones/advisors, pero **no** la configuración de Auth (providers OAuth ni plantillas de email). Estos pasos se hacen en el **dashboard** (Authentication) porque requieren secrets no accesibles por MCP:

1. **Confirmación de email.** Authentication → Sign In / Providers → Email: `Confirm email` **activado** (es lo que dispara el flujo "revisá tu correo"). Está ON por defecto.
2. **Redirect URLs.** Authentication → URL Configuration → `Redirect URLs`: agregar `http://localhost:3000/auth/callback` y la URL de producción `https://<dominio>/auth/callback`.
3. **Google.** Authentication → Providers → Google: pegar `Client ID` y `Client Secret` (Google Cloud Console → OAuth consent + credenciales), con redirect autorizado `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **GitHub.** Authentication → Providers → GitHub: pegar `Client ID` y `Client Secret` (GitHub → Settings → Developer settings → OAuth Apps), mismo callback de Supabase.
5. **Plantilla de email (opcional).** Authentication → Email Templates → `Confirm signup`: el enlace debe apuntar al callback (por defecto `{{ .ConfirmationURL }}` ya redirige a `/auth/callback`).

> El SMTP de prueba de Supabase tiene rate limit bajo; para volumen real configurar SMTP propio (fuera de scope).

**Advisor pre-existente (no introducido por este spec):** `public.rls_auto_enable()` es `SECURITY DEFINER` ejecutable por `anon`/`authenticated`. Revisar en otro spec si corresponde.

---

## Lo que **no** está en este spec

- Recuperación de contraseña y magic link.
- Tabla `profiles`, edición de perfil, avatar, cambio de username.
- Bloqueo de rutas por sesión.
- Backfill de scores antiguos.
- Borrado de cuenta / privacidad (GDPR).

Cada uno, si llega, va en su propio spec.
