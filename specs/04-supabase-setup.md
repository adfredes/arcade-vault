# 04-supabase-setup

**Estado:** Aprobado
**Dependencias:** ninguna
**Fecha:** 2026-06-17
**Objetivo:** Instalar y configurar `@supabase/supabase-js` y `@supabase/ssr` en la aplicación Next.js, incluyendo clientes de browser y servidor.

---

## Scope

### Dentro del scope

- Instalar `@supabase/supabase-js` y `@supabase/ssr`
- `.env.local` — agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `.env.template` — agregar las mismas variables (sin valores)
- `lib/supabase/client.ts` — cliente para Client Components (`createBrowserClient`)
- `lib/supabase/server.ts` — cliente para Server Components y Route Handlers (`createServerClient`)

### Fuera del scope

- Tablas en la base de datos (ninguna en este spec)
- Páginas de autenticación (`/auth`, login, registro)
- Lógica de redirección por sesión en el middleware
- Guardado de puntajes o cualquier operación de datos
- Realtime, Edge Functions, Storage

---

## Data Model

No se crean tablas ni estructuras persistentes. Se definen las siguientes variables de entorno:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
```

```bash
# .env.template
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

---

## Plan de implementación

1. **Instalar dependencias**

   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. **Agregar variables de entorno** — actualizar `.env.local` y `.env.template` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

3. **Crear `lib/supabase/client.ts`** — cliente para Client Components:

   ```ts
   import { createBrowserClient } from '@supabase/ssr';
   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
     );
   }
   ```

4. **Crear `lib/supabase/server.ts`** — cliente para Server Components y Route Handlers:

   ```ts
   import { createServerClient } from '@supabase/ssr';
   import { cookies } from 'next/headers';
   export async function createClient() {
     const cookieStore = await cookies();
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
       {
         cookies: {
           getAll: () => cookieStore.getAll(),
           setAll: (cs) => {
             try {
               cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
             } catch {}
           },
         },
       }
     );
   }
   ```

5. **Verificar TypeScript** — `tsc --noEmit` sin errores

---

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen en `package.json`
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con valores placeholder
- [ ] `.env.template` contiene las mismas variables sin valores
- [ ] `lib/supabase/client.ts` exporta `createClient` usando `createBrowserClient`
- [ ] `lib/supabase/server.ts` exporta `createClient` async usando `createServerClient` con cookies de Next.js
- [ ] `tsc --noEmit` sin errores
- [ ] `npm run dev` inicia sin errores relacionados a Supabase

---

## Decisiones tomadas y descartadas

| Decisión                  | Elegida                                             | Descartada                      | Razón                                                                                    |
| ------------------------- | --------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Paquete de integración    | `@supabase/ssr` + `@supabase/supabase-js`           | `@supabase/auth-helpers-nextjs` | `auth-helpers` está deprecado; `@supabase/ssr` es el oficial actual para App Router      |
| Variable de clave pública | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`              | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Nombre actual según docs de Supabase; `ANON_KEY` es nomenclatura de versiones anteriores |
| Tablas en DB              | Fuera de scope                                      | Crear schema inicial            | Se crean en specs posteriores cuando se implemente auth y scores                         |
| Estructura de clientes    | `lib/supabase/client.ts` + `lib/supabase/server.ts` | Un solo `lib/supabase.ts`       | Separación requerida por `@supabase/ssr`: browser y server tienen APIs distintas         |
