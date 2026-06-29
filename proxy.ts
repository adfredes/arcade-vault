import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16 renombró "middleware" a "proxy" (misma funcionalidad).
// Refresca las cookies de sesión de Supabase en cada request (patrón @supabase/ssr)
// y aplica redirecciones por sesión. Jugar como invitado sigue libre en todo el sitio.

// Rutas que un usuario YA autenticado no debería ver (login/registro).
// `/auth/callback` queda fuera a propósito: maneja el intercambio de código.
const GUEST_ONLY = ['/auth'];

// (Futuro) Rutas que exigirán sesión: los no autenticados se redirigen a /auth.
// Agregar acá los prefijos cuando existan pantallas de auth forzada.
const AUTH_REQUIRED: string[] = [];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión (revalida y reescribe las cookies si hace falta).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Autenticado entrando a login/registro → al Vault.
  if (user && GUEST_ONLY.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // No autenticado en ruta protegida → a /auth.
  if (!user && AUTH_REQUIRED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Todas las rutas excepto estáticos, imágenes optimizadas y favicon.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
