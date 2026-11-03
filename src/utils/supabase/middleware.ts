import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { UserRole } from '@/types/database';

const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  admin: '/admin',
  docente: '/docente',
  estudiante: '/estudiante',
};

export async function updateSessionAndEnforceRole(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Validar usuario autenticado de forma segura contra Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Definir rutas públicas (Login, Registro con invitación y Verificación pública de constancias QR)
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/verificar');

  // 2. Si NO está autenticado e intenta entrar a una ruta protegida -> enviar a /login
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // 3. Si ESTÁ autenticado, consultar su rol y estado activo en public.profiles
  if (user) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single();

    if (error || !profile || !profile.activo) {
      // Si el perfil fue desactivado o no existe, forzar salida a login
      const errorUrl = request.nextUrl.clone();
      errorUrl.pathname = '/login';
      errorUrl.searchParams.set('error', 'cuenta_inactiva_o_invalida');
      return NextResponse.redirect(errorUrl);
    }

    const userRole = profile.rol as UserRole;
    const allowedBaseRoute = ROLE_DASHBOARD_MAP[userRole];

    // Si un usuario autenticado visita '/', '/login' o '/registro', redirigirlo a su propio dashboard
    if (
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/registro')
    ) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = allowedBaseRoute;
      return NextResponse.redirect(dashboardUrl);
    }

    // 4. Bloqueo de accesos cruzados entre roles (/admin, /docente, /estudiante)
    const isAccessingRoleProtectedArea =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/docente') ||
      pathname.startsWith('/estudiante');

    if (
      isAccessingRoleProtectedArea &&
      !pathname.startsWith(allowedBaseRoute)
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = allowedBaseRoute;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}