/**
 * Utilidades Centralizadas de Sanitización y Normalización de Texto y Archivos
 * ClassITSCe - Tecnológico Nacional de México Campus Centla
 */

/**
 * Normaliza nombres propios al formato Title Case eliminando espacios duplicados.
 * Ej: "  juan   carlos   pérez  " -> "Juan Carlos Pérez"
 */
export function toTitleCase(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Normaliza claves de materias y folios oficiales a MAYÚSCULAS sin espacios laterales.
 * Ej: "  aed-1026  " -> "AED-1026"
 */
export function toNormalizedCode(value: string): string {
  if (!value) return '';
  return value.trim().toUpperCase();
}

/**
 * Normaliza correos electrónicos institucionales a minúsculas y sin espacios laterales.
 * Ej: "  ALUMNO@CENTLA.TECNM.MX  " -> "alumno@centla.tecnm.mx"
 */
export function toNormalizedEmail(value: string): string {
  if (!value) return '';
  return value.trim().toLowerCase();
}

/**
 * Normaliza títulos de unidades, tareas, exámenes y temas de debate (Sentence Case).
 * Capitaliza la primera letra y colapsa espacios dobles o laterales.
 * Ej: "   introducción a las redes   " -> "Introducción a las redes"
 */
export function toCapitalizedSentence(value: string): string {
  if (!value) return '';
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Sanitiza nombres de archivos para almacenamiento seguro en Storage.
 * Remueve caracteres especiales, normaliza acentos y previene path traversal.
 */
export function sanitizeFileName(originalName: string): string {
  if (!originalName) return `archivo_${Date.now()}`;

  const lastDotIndex = originalName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return originalName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 80);
  }

  const baseName = originalName.substring(0, lastDotIndex);
  const ext = originalName.substring(lastDotIndex).toLowerCase();

  const cleanBase = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);

  const cleanExt = ext.replace(/[^a-z0-9.]/g, '');
  return `${cleanBase || 'archivo'}${cleanExt}`;
}

/**
 * Whitelist oficial de extensiones permitidas para ClassITSCe.
 * Bloquea ejecutables y scripts (.exe, .bat, .sh, .js, .html, .php, etc.).
 */
export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const;

export type AllowedExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  cleanName?: string;
}

/**
 * Valida un archivo contra tamaño máximo (en MB) y whitelist de extensiones.
 */
export function validateUploadedFile(
  file: File | null | undefined,
  options: {
    maxSizeMB: number;
    allowedExtensions?: readonly string[];
  }
): FileValidationResult {
  if (!file || !(file instanceof File) || file.size === 0) {
    return { valid: false, error: 'Debes adjuntar un archivo válido.' };
  }

  const maxBytes = options.maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `El archivo pesa ${sizeInMB} MB y supera el límite permitido de ${options.maxSizeMB} MB.`,
    };
  }

  const extensions = options.allowedExtensions || ALLOWED_FILE_EXTENSIONS;
  const fileNameLower = file.name.toLowerCase();
  const hasValidExt = extensions.some((ext) => fileNameLower.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Solo se aceptan: ${extensions.join(', ')}`,
    };
  }

  // Prevenir extensiones dobles peligrosas (ej. archivo.php.png o tarea.exe.pdf)
  const parts = fileNameLower.split('.');
  if (parts.length > 2) {
    const dangerousExts = [
      'php',
      'phtml',
      'exe',
      'bat',
      'sh',
      'js',
      'html',
      'htm',
      'vbs',
      'cmd',
      'msi',
      'cgi',
    ];
    const hasDangerousMiddle = parts
      .slice(1, -1)
      .some((p) => dangerousExts.includes(p));
    if (hasDangerousMiddle) {
      return {
        valid: false,
        error:
          'El archivo contiene extensiones intermedias no permitidas por seguridad.',
      };
    }
  }

  return {
    valid: true,
    cleanName: sanitizeFileName(file.name),
  };
}

