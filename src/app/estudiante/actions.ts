'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { ActionState } from '@/app/(auth)/actions';
import {
  validateUploadedFile,
  validateFileMagicBytes,
} from '@/utils/formatters/text-sanitizer';

const EntregarTareaSchema = z.object({
  tarea_id: z.string().uuid(),
  grupo_id: z.string().uuid(),
  comentario_estudiante: z.string().max(400).optional(),
});

const ResponderEvaluacionSchema = z.object({
  evaluacion_id: z.string().uuid(),
  grupo_id: z.string().uuid(),
  respuestas_json: z.string().min(2),
});

// ============================================================================
// 1. SUBIR O ACTUALIZAR ENTREGA DE TAREA (SI NO HA SIDO CALIFICADA)
// ============================================================================
export async function entregarTareaAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = EntregarTareaSchema.safeParse({
    tarea_id: formData.get('tarea_id'),
    grupo_id: formData.get('grupo_id'),
    comentario_estudiante: formData.get('comentario_estudiante') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Datos de entrega inválidos.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión expirada.' };

  const { tarea_id, grupo_id, comentario_estudiante } = parsed.data;

  // Verificar que el estudiante esté formalmente matriculado en el grupo ANTES de subir archivos
  const { data: matricula, error: matError } = await supabase
    .from('matriculas')
    .select('id')
    .eq('grupo_id', grupo_id)
    .eq('estudiante_id', user.id)
    .maybeSingle();

  if (matError || !matricula) {
    return {
      success: false,
      message: 'No estás matriculado en este grupo para realizar entregas.',
    };
  }

  // Verificar si ya existe una entrega calificada (bloqueo ético de edición)
  const { data: entregaExistente } = await supabase
    .from('entregas')
    .select('id, calificacion, archivo_entrega_url')
    .eq('tarea_id', tarea_id)
    .eq('estudiante_id', user.id)
    .maybeSingle();

  if (entregaExistente && entregaExistente.calificacion !== null) {
    return {
      success: false,
      message:
        'Esta tarea ya fue calificada por tu docente y no puede modificarse.',
    };
  }

  // Consultar fecha límite para determinar si es 'entregado' o 'tardio'
  const { data: tareaInfo } = await supabase
    .from('tareas')
    .select('fecha_limite')
    .eq('id', tarea_id)
    .single();

  const archivo = formData.get('archivo_entrega') as File | null;
  let archivo_entrega_url = entregaExistente?.archivo_entrega_url || null;

  if (archivo && archivo.size > 0) {
    const validation = validateUploadedFile(archivo, { maxSizeMB: 10 });
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Archivo de entrega inválido (máx. 10 MB).',
      };
    }

    const magicValidation = await validateFileMagicBytes(archivo);
    if (!magicValidation.valid) {
      return {
        success: false,
        message:
          magicValidation.error ||
          'El contenido del archivo no coincide con su extensión o es potencialmente inseguro.',
      };
    }

    const cleanName = validation.cleanName || 'entrega.pdf';
    // Primer nivel de carpeta = user.id (requerido por la política RLS de Storage)
    const filePath = `${user.id}/${tarea_id}_${Date.now()}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from('entregas_alumnos')
      .upload(filePath, archivo, { upsert: true });

    if (uploadError) {
      console.error('Error al subir entrega a Storage:', uploadError);
      return {
        success: false,
        message: 'No fue posible subir tu entrega al servidor de archivos. Inténtalo de nuevo.',
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from('entregas_alumnos')
      .getPublicUrl(filePath);

    archivo_entrega_url = publicUrlData.publicUrl;
  }

  if (!archivo_entrega_url) {
    return {
      success: false,
      message: 'Debes adjuntar un archivo para realizar tu entrega.',
    };
  }

  const esTardio =
    tareaInfo && new Date() > new Date(tareaInfo.fecha_limite);
  const estado = esTardio ? 'tardio' : 'entregado';

  if (entregaExistente) {
    const { error } = await supabase
      .from('entregas')
      .update({
        archivo_entrega_url,
        comentario_estudiante,
        estado,
        entregado_en: new Date().toISOString(),
      })
      .eq('id', entregaExistente.id);

    if (error) {
      return {
        success: false,
        message: 'No fue posible actualizar tu entrega.',
      };
    }
  } else {
    const { error } = await supabase.from('entregas').insert({
      tarea_id,
      estudiante_id: user.id,
      archivo_entrega_url,
      comentario_estudiante,
      estado,
    });

    if (error) {
      return {
        success: false,
        message: 'Error al registrar tu entrega.',
      };
    }
  }

  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: 'Tu tarea se ha entregado exitosamente.',
  };
}

// ============================================================================
// 2. ENVIAR RESPUESTAS DE EVALUACIÓN
// ============================================================================
export async function responderEvaluacionAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = ResponderEvaluacionSchema.safeParse({
    evaluacion_id: formData.get('evaluacion_id'),
    grupo_id: formData.get('grupo_id'),
    respuestas_json: formData.get('respuestas_json'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Responde todas las preguntas antes de enviar.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'No autenticado.' };

  const { data: matricula, error: matError } = await supabase
    .from('matriculas')
    .select('id')
    .eq('grupo_id', parsed.data.grupo_id)
    .eq('estudiante_id', user.id)
    .maybeSingle();

  if (matError || !matricula) {
    return {
      success: false,
      message: 'No estás matriculado en este grupo para responder evaluaciones.',
    };
  }

  // Verificar que la fecha/hora actual esté dentro del periodo habilitado de la evaluación
  const { data: evaluacion, error: evalError } = await supabase
    .from('evaluaciones')
    .select('fecha_inicio, fecha_cierre')
    .eq('id', parsed.data.evaluacion_id)
    .single();

  if (evalError || !evaluacion) {
    return {
      success: false,
      message: 'No se encontró la evaluación solicitada.',
    };
  }

  const ahora = new Date();
  const fechaInicio = new Date(evaluacion.fecha_inicio);
  const fechaCierre = new Date(evaluacion.fecha_cierre);

  if (ahora < fechaInicio) {
    return {
      success: false,
      message: 'Esta evaluación aún no ha iniciado.',
    };
  }

  if (ahora > fechaCierre) {
    return {
      success: false,
      message: 'El periodo habilitado para responder esta evaluación ha finalizado.',
    };
  }

  let respuestasArray;
  try {
    respuestasArray = JSON.parse(parsed.data.respuestas_json);
  } catch {
    return { success: false, message: 'Formato de respuestas inválido.' };
  }

  // Se inserta con calificacion = NULL respetando la política RLS y el trigger ético
  const { error } = await supabase.from('respuestas_evaluaciones').insert({
    evaluacion_id: parsed.data.evaluacion_id,
    estudiante_id: user.id,
    respuestas: respuestasArray,
    estado: 'entregado',
  });

  if (error) {
    return {
      success: false,
      message: 'Ya enviaste esta evaluación anteriormente o el examen cerró.',
    };
  }

  revalidatePath(`/estudiante/grupos/${parsed.data.grupo_id}`);
  return {
    success: true,
    message: 'Evaluación enviada correctamente. Tu docente asentará la nota.',
  };
}