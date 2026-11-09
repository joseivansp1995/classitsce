import { NextResponse, type NextRequest } from 'next/server';
import { updateSessionAndEnforceRole } from '@/utils/supabase/middleware';

// Control 23: Patrones de rutas sensibles, archivos internos y volcados
const BLOCKED_PATH_PREFIXES = /^\/(\.env|\.git|\.vscode|\.idea|wp-admin|phpmyadmin)/i;
const BLOCKED_FILE_EXTENSIONS = /\.(sql|bak|old|log|ini|sh|py|config)$/i;

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.toLowerCase();

  // Control 23: Bloqueo temprano con 404 inmediato ante intentos de escaneo o acceso a archivos internos
  if (BLOCKED_PATH_PREFIXES.test(pathname) || BLOCKED_FILE_EXTENSIONS.test(pathname)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return await updateSessionAndEnforceRole(request);
}

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas excepto archivos estáticos e imágenes:
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
