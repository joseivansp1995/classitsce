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

/**
 * Valida la firma binaria real (magic bytes) de un archivo contra su extensión declarada.
 * Protege contra extension spoofing (ej. un ejecutable .exe renombrado a .pdf o .png).
 */
export async function validateFileMagicBytes(
  file: File
): Promise<{ valid: boolean; error?: string }> {
  if (!file || !(file instanceof File) || file.size === 0) {
    return { valid: false, error: 'Archivo no válido o vacío.' };
  }

  // Leer los primeros 32 bytes para abarcar firmas binarias y cabeceras de texto
  const buffer = await file.slice(0, 32).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 4) {
    return { valid: false, error: 'El archivo es demasiado pequeño o está corrupto.' };
  }

  // 1. Detección inmediata de ejecutables y scripts conocidos
  // Windows MZ header (4D 5A)
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return {
      valid: false,
      error: 'Archivo ejecutable no permitido por políticas de seguridad.',
    };
  }

  // Linux ELF (7F 45 4C 46)
  if (
    bytes[0] === 0x7f &&
    bytes[1] === 0x45 &&
    bytes[2] === 0x4c &&
    bytes[3] === 0x46
  ) {
    return {
      valid: false,
      error: 'Archivo ejecutable no permitido por políticas de seguridad.',
    };
  }

  // Shebang (#! -> 23 21)
  if (bytes[0] === 0x23 && bytes[1] === 0x21) {
    return {
      valid: false,
      error: 'Script ejecutable no permitido por políticas de seguridad.',
    };
  }

  // Detección de texto malicioso o etiquetas de script/código
  const textHeader = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes)
    .trim()
    .toLowerCase();

  const dangerousTextPrefixes = [
    '<!doctype',
    '<html',
    '<script',
    '<?php',
    '<svg',
    '<?xml',
  ];

  if (dangerousTextPrefixes.some((prefix) => textHeader.startsWith(prefix))) {
    return {
      valid: false,
      error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
    };
  }

  // Helper para comparar prefijos de bytes
  const startsWithBytes = (arr: Uint8Array, pattern: number[]) => {
    if (arr.length < pattern.length) return false;
    return pattern.every((val, idx) => arr[idx] === val);
  };

  const fileName = file.name.toLowerCase();

  // 2. Validación según extensión declarada
  // PDF: 25 50 44 46 2D (%PDF-)
  if (fileName.endsWith('.pdf')) {
    const isPdf = startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    if (!isPdf) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (fileName.endsWith('.png')) {
    const isPng = startsWithBytes(bytes, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (!isPng) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  // JPEG: FF D8 FF
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    const isJpg = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    if (!isJpg) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  // WEBP: RIFF en bytes 0..3 (52 49 46 46) y WEBP en bytes 8..11 (57 45 42 50)
  if (fileName.endsWith('.webp')) {
    const isRiff = startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]);
    const isWebp =
      bytes.length >= 12 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    if (!isRiff || !isWebp) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  // ZIP / DOCX / PPTX / XLSX (PKZIP signatures: 50 4B 03 04, 50 4B 05 06, o 50 4B 07 08)
  if (
    fileName.endsWith('.zip') ||
    fileName.endsWith('.docx') ||
    fileName.endsWith('.pptx') ||
    fileName.endsWith('.xlsx')
  ) {
    const isPkZip =
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08));
    if (!isPkZip) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  // RAR: 52 61 72 21 1A 07 (Rar!\x1a\x07)
  if (fileName.endsWith('.rar')) {
    const isRar = startsWithBytes(bytes, [
      0x52, 0x61, 0x72, 0x21, 0x1a, 0x07,
    ]);
    if (!isRar) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  // Legacy OLE2 DOC, PPT, XLS: D0 CF 11 E0 A1 B1 1A E1
  if (
    fileName.endsWith('.doc') ||
    fileName.endsWith('.ppt') ||
    fileName.endsWith('.xls')
  ) {
    const isOle2 = startsWithBytes(bytes, [
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    if (!isOle2) {
      return {
        valid: false,
        error: 'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

