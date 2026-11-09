import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

// Extraer el host (con puerto si aplica) de NEXT_PUBLIC_SITE_URL para allowedOrigins de Server Actions
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
let siteHost: string | null = null;
if (siteUrl) {
  try {
    const parsed = new URL(siteUrl);
    siteHost = parsed.host;
  } catch {
    // Si no es URL completa válida, se omite
  }
}

const serverActionOrigins = [
  'localhost:3000',
  ...(isDev ? ['192.168.137.1:3000'] : []),
  ...(siteHost && siteHost !== 'localhost:3000' && siteHost !== '192.168.137.1:3000'
    ? [siteHost]
    : []),
];

const nextConfig: NextConfig = {
  // Control 20: Ocultar la cabecera 'X-Powered-By: Next.js'
  poweredByHeader: false,

  // Control 14: Orígenes permitidos en desarrollo y red local
  allowedDevOrigins: ['192.168.137.1', 'localhost', '*.local'],

  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
      allowedOrigins: serverActionOrigins,
    },
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Controles 04, 13, 14, 15, 16: Cabeceras de endurecimiento HTTP para todas las rutas
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://meet.jit.si https://*.8x8.vc; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co https://meet.jit.si; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://meet.jit.si https://*.8x8.vc blob:; media-src 'self' blob: https://*.supabase.co; frame-src 'self' blob: https://*.supabase.co https://meet.jit.si https://*.8x8.vc; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
