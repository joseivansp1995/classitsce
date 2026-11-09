/**
 * Control 12: Limitación de Tasa (Rate Limiting) y Auditoría de Eventos de Seguridad
 * ClassITSCe - Tecnológico Nacional de México Campus Centla
 */

import { headers } from 'next/headers';

// Almacén en memoria de marcas de tiempo por llave (sliding window)
const rateLimitMap = new Map<string, number[]>();

/**
 * Verifica si una acción excede el límite de peticiones en una ventana de tiempo deslizante.
 * 
 * @param key Identificador único del recurso (ej: `login:192.168.1.1:usuario@centla.tecnm.mx`)
 * @param limit Número máximo de peticiones permitidas en la ventana
 * @param windowMs Tamaño de la ventana de tiempo en milisegundos
 * @returns `{ allowed: boolean, retryAfterSeconds: number }`
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = rateLimitMap.get(key) || [];
  // Filtrar marcas de tiempo fuera de la ventana actual
  const validTimestamps = timestamps.filter((t) => t > windowStart);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);

  // Mantenimiento de memoria: limpiar claves inactivas si el mapa supera 5,000 entradas
  if (rateLimitMap.size > 5000) {
    for (const [k, ts] of rateLimitMap.entries()) {
      const active = ts.filter((t) => t > windowStart);
      if (active.length === 0) {
        rateLimitMap.delete(k);
      } else {
        rateLimitMap.set(k, active);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Obtiene la dirección IP del cliente a partir de las cabeceras del proxy inverso.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const xForwardedFor = headerList.get('x-forwarded-for');
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(',')[0].trim();
      if (firstIp) return firstIp;
    }

    const xRealIp = headerList.get('x-real-ip');
    if (xRealIp) return xRealIp.trim();

    const cfConnectingIp = headerList.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp.trim();
  } catch {
    // Si se ejecuta en un contexto donde headers() no está disponible
  }

  return '127.0.0.1';
}

/**
 * Control 08: Registro estructurado de eventos de seguridad sin filtrar credenciales.
 * Sanitiza automáticamente cualquier campo que contenga contraseñas, tokens o claves.
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
): void {
  const SENSITIVE_KEYS = /password|pass|token|secret|key|auth|cookie|credential/i;
  const sanitizedDetails: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(details)) {
    if (SENSITIVE_KEYS.test(k)) {
      sanitizedDetails[k] = '[REDACTED]';
    } else {
      sanitizedDetails[k] = v;
    }
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    security_event: event,
    ...sanitizedDetails,
  };

  console.warn(`[SECURITY EVENT] ${JSON.stringify(logEntry)}`);
}
