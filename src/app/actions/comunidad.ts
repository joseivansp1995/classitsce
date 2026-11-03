'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { ActionState } from '@/app/(auth)/actions';
import { toCapitalizedSentence, validateUploadedFile } from '@/utils/formatters/text-sanitizer';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ============================================================================

const SubirMaterialSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  titulo: z
    .string()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(120, 'El título es demasiado largo.')
    .transform(toCapitalizedSentence),
  descripcion: z
    .string()
    .max(400, 'La descripción no puede exceder 400 caracteres.')
    .optional()
    .transform((v) => (v ? v.trim() : '')),
  tipo_recurso: z.enum(['guia', 'presentacion', 'codigo', 'lectura']),
});

const CrearTemaForoSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  titulo: z
    .string()
    .min(5, 'El título del debate debe tener al menos 5 caracteres.')
    .max(150, 'Título demasiado largo.')
    .transform(toCapitalizedSentence),
  contenido: z
    .string()
    .min(10, 'Plantea la pregunta o contexto del debate (mínimo 10 caracteres).')
    .transform((v) => v.trim()),
  fijado: z.boolean().default(false),
});

const CrearComentarioForoSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  tema_id: z.string().uuid('ID de tema inválido.'),
  comentario_padre_id: z.string().uuid().nullable().optional(),
  contenido: z
    .string()
    .min(2, 'Escribe un comentario válido.')
    .max(1000, 'El comentario es demasiado extenso (máx. 1000 caracteres).')
    .transform((v) => v.trim()),
});

// ============================================================================
// 1. SUBIR MATERIAL DIDÁCTICO (DOCENTE O ESTUDIANTE MATRICULADO)
// ============================================================================
export async function subirMaterialDidacticoAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = SubirMaterialSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    titulo: formData.get('titulo'),
    descripcion: formData.get('descripcion') || '',
    tipo_recurso: formData.get('tipo_recurso') || 'guia',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Verifica los datos del recurso didáctico.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const archivo = formData.get('archivo_material') as File | null;
  const validation = validateUploadedFile(archivo, { maxSizeMB: 15 });
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || 'Debes adjuntar un archivo válido (máx. 15 MB).',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida.' };

  const { grupo_id, titulo, descripcion, tipo_recurso } = parsed.data;

  // Verificar membresía del usuario en el grupo (docente titular o estudiante matriculado) ANTES de subir
  const [{ data: grupoRow }, { data: matriculaRow }] = await Promise.all([
    supabase.from('grupos').select('id, docente_id').eq('id', grupo_id).maybeSingle(),
    supabase.from('matriculas').select('id').eq('grupo_id', grupo_id).eq('estudiante_id', user.id).maybeSingle(),
  ]);

  const esDocente = grupoRow?.docente_id === user.id;
  const esMatriculado = !!matriculaRow;

  if (!esDocente && !esMatriculado) {
    return {
      success: false,
      message: 'No tienes permisos para compartir material en este grupo (no eres miembro).',
    };
  }

  const cleanFileName = validation.cleanName || 'recurso.pdf';
  // Primer nivel de ruta = user.id para cumplir la política RLS de storage.objects
  const filePath = `${user.id}/${grupo_id}_${Date.now()}_${cleanFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('material_didactico')
    .upload(filePath, archivo!, { upsert: true });

  if (uploadError) {
    console.error('Error al subir a material_didactico:', uploadError);
    return {
      success: false,
      message: 'No fue posible subir el archivo a Storage. Inténtalo de nuevo.',
    };
  }

  const { data: publicUrlData } = supabase.storage
    .from('material_didactico')
    .getPublicUrl(filePath);

  const { error: dbError } = await supabase.from('material_didactico').insert({
    grupo_id,
    autor_id: user.id,
    titulo,
    descripcion,
    archivo_url: publicUrlData.publicUrl,
    tipo_recurso,
  });

  if (dbError) {
    return {
      success: false,
      message:
        'No tienes permisos para subir material en este grupo o ocurrió un error.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: `Recurso "${titulo}" compartido exitosamente con el grupo.`,
  };
}

// ============================================================================
// 2. ELIMINAR MATERIAL DIDÁCTICO (AUTOR O DOCENTE TITULAR)
// ============================================================================
export async function eliminarMaterialDidacticoAction(
  materialId: string,
  grupoId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const [{ data: material }, { data: grupo }] = await Promise.all([
    supabase.from('material_didactico').select('autor_id, archivo_url').eq('id', materialId).maybeSingle(),
    supabase.from('grupos').select('docente_id').eq('id', grupoId).maybeSingle(),
  ]);

  if (!material) {
    return { success: false, message: 'Material didáctico no encontrado.' };
  }

  const esDocente = grupo?.docente_id === user.id;
  const esAutor = material.autor_id === user.id;

  if (!esDocente && !esAutor) {
    return {
      success: false,
      message: 'No tienes permisos para eliminar este material.',
    };
  }

  const { error } = await supabase
    .from('material_didactico')
    .delete()
    .eq('id', materialId);

  if (error) {
    console.error('Error al eliminar material didactico:', error);
    return {
      success: false,
      message: 'No fue posible eliminar este material didáctico.',
    };
  }

  // Limpiar archivo huérfano de storage si existe
  if (material.archivo_url) {
    try {
      const parts = material.archivo_url.split('/material_didactico/');
      if (parts[1]) {
        await supabase.storage.from('material_didactico').remove([decodeURIComponent(parts[1])]);
      }
    } catch (err) {
      console.error('Error al limpiar archivo de storage:', err);
    }
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);
  return {
    success: true,
    message: 'Material eliminado correctamente.',
  };
}

// ============================================================================
// 3. CREAR TEMA DE DEBATE EN EL FORO (EXCLUSIVO DOCENTE TITULAR)
// ============================================================================
export async function crearTemaForoAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = CrearTemaForoSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    titulo: formData.get('titulo'),
    contenido: formData.get('contenido'),
    fijado: formData.get('fijado') === 'on',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa el título y planteamiento del foro.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión expirada.' };

  const { grupo_id, titulo, contenido, fijado } = parsed.data;

  const { error } = await supabase.from('foro_temas').insert({
    grupo_id,
    docente_id: user.id,
    titulo,
    contenido,
    fijado,
    cerrado: false,
  });

  if (error) {
    return {
      success: false,
      message:
        'Exclusivamente el docente titular del grupo puede abrir temas de debate.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: 'Entrada de debate publicada en el foro del grupo.',
  };
}

// ============================================================================
// 4. ABRIR / CERRAR DEBATE EN EL FORO (EXCLUSIVO DOCENTE TITULAR)
// ============================================================================
export async function toggleCerrarTemaForoAction(
  temaId: string,
  grupoId: string,
  nuevoEstadoCerrado: boolean
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { data: grupo } = await supabase
    .from('grupos')
    .select('docente_id')
    .eq('id', grupoId)
    .maybeSingle();

  if (!grupo || grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'Solo el docente titular del grupo puede abrir o cerrar temas de debate.',
    };
  }

  const { error } = await supabase
    .from('foro_temas')
    .update({ cerrado: nuevoEstadoCerrado })
    .eq('id', temaId);

  if (error) {
    return {
      success: false,
      message: 'No se pudo actualizar el estado del tema.',
    };
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);
  return {
    success: true,
    message: nuevoEstadoCerrado
      ? 'El tema ha sido cerrado a nuevos comentarios.'
      : 'El tema ha sido reabierto para debate.',
  };
}

// ============================================================================
// 5. PUBLICAR COMENTARIO O RESPUESTA EN HILO (ESTUDIANTES Y DOCENTE)
// ============================================================================
export async function crearComentarioForoAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawPadre = formData.get('comentario_padre_id');
  const parsed = CrearComentarioForoSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    tema_id: formData.get('tema_id'),
    comentario_padre_id:
      rawPadre && String(rawPadre).trim().length > 0 ? String(rawPadre) : null,
    contenido: formData.get('contenido'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Escribe un comentario válido antes de publicar.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'No autenticado.' };

  const { grupo_id, tema_id, comentario_padre_id, contenido } = parsed.data;

  const { error } = await supabase.from('foro_comentarios').insert({
    tema_id,
    autor_id: user.id,
    comentario_padre_id,
    contenido,
  });

  if (error) {
    return {
      success: false,
      message:
        'No se pudo publicar el comentario (verifica que el debate siga abierto).',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: 'Comentario publicado en el hilo.',
  };
}