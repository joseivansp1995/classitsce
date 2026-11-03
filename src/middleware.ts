import { type NextRequest } from 'next/server';
import { updateSessionAndEnforceRole } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
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