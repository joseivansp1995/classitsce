'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { ActionState } from '@/app/(auth)/actions';
import { toCapitalizedSentence, validateUploadedFile } from '@/utils/formatters/text-sanitizer';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ============================================================================

const CrearUnidadSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  numero_unidad: z.coerce.number().int().min(1, 'Mínimo Unidad 1.'),
  nombre: z
    .string()
    .min(3, 'Escribe el nombre de la unidad temática.')
    .transform(toCapitalizedSentence),
  descripcion: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : '')),
});

const CrearTareaSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  unidad_id: z.string().uuid().nullable().optional(),
  titulo: z
    .string()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .transform(toCapitalizedSentence),
  descripcion: z
    .string()
    .min(5, 'Agrega las instrucciones de la tarea.')
    .transform((v) => v.trim()),
  ponderacion: z.coerce
    .number()
    .min(1, 'Mínimo 1 punto')
    .max(100, 'Máximo 100 puntos')
    .default(100),
  fecha_limite: z.string().min(1, 'Selecciona una fecha límite válida.'),
  penalizacion_diaria_pct: z.coerce.number().min(0).max(100).default(10),
  penalizacion_maxima_pct: z.coerce.number().min(0).max(100).default(30),
  rubrica_json: z.string().optional().nullable(),
});

const CalificarEntregaSchema = z.object({
  entrega_id: z.string().uuid('ID de entrega inválido.'),
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  calificacion: z.coerce
    .number()
    .min(0, 'La calificación mínima es 0.')
    .max(100, 'La calificación máxima es 100.'),
  retroalimentacion_docente: z
    .string()
    .max(500, 'Máximo 500 caracteres.')
    .optional(),
});

const PreguntaSchema = z.object({
  id: z.string(),
  pregunta: z.string().min(3, 'Escribe la pregunta.'),
  opciones: z.array(z.string().min(1)).min(2, 'Mínimo 2 opciones.'),
  respuesta_correcta: z.number().min(0),
});

const CrearEvaluacionSchema = z.object({
  grupo_id: z.string().uuid(),
  unidad_id: z.string().uuid().nullable().optional(),
  titulo: z
    .string()
    .min(3, 'El título de la evaluación es obligatorio.')
    .transform(toCapitalizedSentence),
  instrucciones: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : '')),
  ponderacion: z.coerce.number().min(1).max(100).default(100),
  fecha_inicio: z.string().min(1, 'Define la fecha de apertura.'),
  fecha_cierre: z.string().min(1, 'Define la fecha de cierre.'),
  preguntas_json: z.string().min(2, 'Agrega al menos una pregunta.'),
});

const CalificarEvaluacionSchema = z.object({
  respuesta_id: z.string().uuid('ID de respuesta inválido.'),
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  calificacion: z.coerce.number().min(0).max(100),
  retroalimentacion_docente: z.string().optional(),
});

// ============================================================================
// HELPER INTERNO DE SEGURIDAD (PREVENCIÓN IDOR)
// ============================================================================

/**
 * Consulta la base de datos y confirma que el usuario autenticado sea el docente titular del grupo.
 */
async function verificarDocenteTitular(
  supabase: any,
  grupoId: string,
  userId: string
): Promise<{ valido: boolean; message?: string }> {
  const { data: grupo, error } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupoId)
    .single();

  if (error || !grupo || grupo.docente_id !== userId) {
    return {
      valido: false,
      message: 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }

  return { valido: true };
}

// ============================================================================
// 0. CREAR CARPETA DE UNIDAD TEMÁTICA (ESTILO GOOGLE DRIVE)
// ============================================================================
export async function crearUnidadAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = CrearUnidadSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    numero_unidad: formData.get('numero_unidad'),
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Verifica los datos de la unidad.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { grupo_id, numero_unidad, nombre, descripcion } = parsed.data;

  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'No tienes permisos de docente titular sobre este grupo.',
    };
  }

  const { error } = await supabase.from('unidades').insert({
    grupo_id,
    numero_unidad,
    nombre,
    descripcion,
  });

  if (error) {
    return {
      success: false,
      message:
        'Ya existe una unidad con ese número en este grupo o no tienes permisos.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: `Unidad ${numero_unidad}: "${nombre}" creada exitosamente.`,
  };
}

// ============================================================================
// 1. CREAR TAREA EN UNIDAD + REGLAS DE PENALIZACIÓN POR RETARDO
// ============================================================================
export async function crearTareaAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawUnidad = formData.get('unidad_id');
  const parsed = CrearTareaSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    unidad_id:
      rawUnidad && String(rawUnidad).trim().length > 0
        ? String(rawUnidad)
        : null,
    titulo: formData.get('titulo'),
    descripcion: formData.get('descripcion'),
    ponderacion: formData.get('ponderacion'),
    fecha_limite: formData.get('fecha_limite'),
    penalizacion_diaria_pct: formData.get('penalizacion_diaria_pct') ?? 10,
    penalizacion_maxima_pct: formData.get('penalizacion_maxima_pct') ?? 30,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa los campos del formulario de tarea.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida.' };

  const {
    grupo_id,
    unidad_id,
    titulo,
    descripcion,
    ponderacion,
    fecha_limite,
    penalizacion_diaria_pct,
    penalizacion_maxima_pct,
  } = parsed.data;

  // Verificar titularidad docente ANTES de procesar o subir archivo a Storage
  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'No tienes permisos de docente titular para crear tareas en este grupo.',
    };
  }

  let archivo_guia_url: string | null = null;
  const archivo = formData.get('archivo_guia') as File | null;

  if (archivo && archivo.size > 0) {
    const validation = validateUploadedFile(archivo, { maxSizeMB: 15 });
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Archivo guía no permitido (máx. 15 MB).',
      };
    }

    const cleanFileName = validation.cleanName || 'guia.pdf';
    const filePath = `${grupo_id}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('guias_tareas')
      .upload(filePath, archivo, { upsert: true });

    if (uploadError) {
      console.error('Error al subir a guias_tareas:', uploadError);
      return {
        success: false,
        message: 'No fue posible subir el archivo guía. Inténtalo de nuevo.',
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from('guias_tareas')
      .getPublicUrl(filePath);

    archivo_guia_url = publicUrlData.publicUrl;
  }

  let rubricaData: any[] = [];
  const rawRubrica = formData.get('rubrica_json');
  if (rawRubrica && typeof rawRubrica === 'string' && rawRubrica.trim().length > 0) {
    try {
      rubricaData = JSON.parse(rawRubrica);
    } catch {
      rubricaData = [];
    }
  }

  const { error } = await supabase.from('tareas').insert({
    grupo_id,
    unidad_id,
    titulo,
    descripcion,
    ponderacion,
    fecha_limite: new Date(fecha_limite).toISOString(),
    archivo_guia_url,
    penalizacion_diaria_pct,
    penalizacion_maxima_pct,
    rubrica: rubricaData,
  });

  if (error) {
    return {
      success: false,
      message: 'No se pudo registrar la tarea en la base de datos.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: `Tarea "${titulo}" publicada con regla de retardo (-${penalizacion_diaria_pct}%/día).`,
  };
}

// ============================================================================
// 2. CALIFICAR ENTREGA DE TAREA (APLICA DESCUENTO AUTOMÁTICO SI ES TARDÍA)
// ============================================================================
export async function calificarEntregaAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = CalificarEntregaSchema.safeParse({
    entrega_id: formData.get('entrega_id'),
    grupo_id: formData.get('grupo_id'),
    calificacion: formData.get('calificacion'),
    retroalimentacion_docente: formData.get('retroalimentacion_docente') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Verifica que la calificación esté entre 0 y 100.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { entrega_id, grupo_id, calificacion, retroalimentacion_docente } =
    parsed.data;

  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }

  // Se envía calificacion_base y calificacion; el Trigger de PostgreSQL descuenta automáticamente los puntos por días de retraso
  const { data: updated, error } = await supabase
    .from('entregas')
    .update({
      calificacion_base: calificacion,
      calificacion,
      retroalimentacion_docente,
      estado: 'calificado',
      calificado_en: new Date().toISOString(),
    })
    .eq('id', entrega_id)
    .select('calificacion, calificacion_base, puntos_penalizados, dias_retraso')
    .single();

  if (error) {
    console.error('Error al calificar entrega:', error);
    return {
      success: false,
      message: 'No tienes permisos para calificar esta entrega o ocurrió un error al asentar la nota.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);

  const msgPenalizacion =
    updated && Number(updated.puntos_penalizados) > 0
      ? ` (Nota base: ${updated.calificacion_base} - ${updated.puntos_penalizados} pts por ${updated.dias_retraso} día(s) de retraso = ${updated.calificacion} pts).`
      : '.';

  return {
    success: true,
    message: `Calificación asentada correctamente${msgPenalizacion}`,
  };
}

// ============================================================================
// 3. CREAR EVALUACIÓN / EXAMEN VINCULADO A UNA UNIDAD
// ============================================================================
export async function crearEvaluacionAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawUnidad = formData.get('unidad_id');
  const parsed = CrearEvaluacionSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    unidad_id:
      rawUnidad && String(rawUnidad).trim().length > 0
        ? String(rawUnidad)
        : null,
    titulo: formData.get('titulo'),
    instrucciones: formData.get('instrucciones') || '',
    ponderacion: formData.get('ponderacion'),
    fecha_inicio: formData.get('fecha_inicio'),
    fecha_cierre: formData.get('fecha_cierre'),
    preguntas_json: formData.get('preguntas_json'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa los datos generales de la evaluación.',
    };
  }

  let preguntasValidas;
  try {
    const rawPreguntas = JSON.parse(parsed.data.preguntas_json);
    preguntasValidas = z.array(PreguntaSchema).min(1).parse(rawPreguntas);
  } catch {
    return {
      success: false,
      message: 'Asegúrate de completar todas las preguntas y sus opciones.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const {
    grupo_id,
    unidad_id,
    titulo,
    instrucciones,
    ponderacion,
    fecha_inicio,
    fecha_cierre,
  } = parsed.data;

  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'No tienes permisos de docente titular para crear evaluaciones en este grupo.',
    };
  }

  const { error } = await supabase.from('evaluaciones').insert({
    grupo_id,
    unidad_id,
    titulo,
    instrucciones,
    ponderacion,
    preguntas: preguntasValidas,
    fecha_inicio: new Date(fecha_inicio).toISOString(),
    fecha_cierre: new Date(fecha_cierre).toISOString(),
  });

  if (error) {
    return {
      success: false,
      message: 'Error al guardar la evaluación en Supabase.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: `Evaluación "${titulo}" publicada con ${preguntasValidas.length} reactivos.`,
  };
}

// ============================================================================
// 4. ASENTAR CALIFICACIÓN DE EVALUACIÓN (DOCENTE TITULAR)
// ============================================================================
export async function calificarEvaluacionAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = CalificarEvaluacionSchema.safeParse({
    respuesta_id: formData.get('respuesta_id'),
    grupo_id: formData.get('grupo_id'),
    calificacion: formData.get('calificacion'),
    retroalimentacion_docente: formData.get('retroalimentacion_docente') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Calificación inválida.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { respuesta_id, grupo_id, calificacion, retroalimentacion_docente } =
    parsed.data;

  const authDocente = await verificarDocenteTitular(supabase, grupo_id, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }

  const { error } = await supabase
    .from('respuestas_evaluaciones')
    .update({
      calificacion,
      retroalimentacion_docente,
      estado: 'calificado',
      calificado_en: new Date().toISOString(),
    })
    .eq('id', respuesta_id);

  if (error) {
    console.error('Error al asentar calificacion evaluacion:', error);
    return {
      success: false,
      message: 'No fue posible asentar la calificación del examen.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  return {
    success: true,
    message: 'Calificación de evaluación asentada en acta.',
  };
}

// ============================================================================
// 5. CALIFICACIÓN RÁPIDA DESDE EL EXPEDIENTE 360° DEL ESTUDIANTE
// ============================================================================
export async function calificarTareaDirectaAlumnoAction(
  grupoId: string,
  tareaId: string,
  estudianteId: string,
  calificacion: number,
  retroalimentacion: string
): Promise<ActionState> {
  if (calificacion < 0 || calificacion > 100 || Number.isNaN(calificacion)) {
    return {
      success: false,
      message: 'La calificación debe estar entre 0 y 100.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida.' };

  const authDocente = await verificarDocenteTitular(supabase, grupoId, user.id);
  if (!authDocente.valido) {
    return {
      success: false,
      message: authDocente.message || 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }

  const { data: existente } = await supabase
    .from('entregas')
    .select('id')
    .eq('tarea_id', tareaId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (existente) {
    const { data: updated, error } = await supabase
      .from('entregas')
      .update({
        calificacion_base: calificacion,
        calificacion,
        retroalimentacion_docente: retroalimentacion,
        estado: 'calificado',
        calificado_en: new Date().toISOString(),
      })
      .eq('id', existente.id)
      .select('calificacion, puntos_penalizados, dias_retraso')
      .single();

    if (error) {
      return {
        success: false,
        message: 'No fue posible actualizar la calificación en el expediente.',
      };
    }

    revalidatePath(`/docente/grupos/${grupoId}`);
    const extra =
      updated && Number(updated.puntos_penalizados) > 0
        ? ` (Aplicado descuento automático de -${updated.puntos_penalizados} pts por ${updated.dias_retraso}d de retardo -> Nota final: ${updated.calificacion}).`
        : '.';
    return {
      success: true,
      message: `Calificación guardada en el expediente${extra}`,
    };
  } else {
    const { error } = await supabase.from('entregas').insert({
      tarea_id: tareaId,
      estudiante_id: estudianteId,
      calificacion_base: calificacion,
      calificacion,
      retroalimentacion_docente: retroalimentacion,
      estado: 'calificado',
      calificado_en: new Date().toISOString(),
    });

    if (error) {
      return {
        success: false,
        message: 'No fue posible registrar la calificación en el expediente.',
      };
    }
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  return {
    success: true,
    message: 'Calificación guardada en el expediente del alumno.',
  };
}

// ============================================================================
// 6. AUTOCALIFICACIÓN MASIVA DE EXÁMENES EN 1 CLIC
// ============================================================================
export async function autocalificarEvaluacionesMasivoAction(
  grupoId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida.' };

  // ── Seguridad: verificar que el usuario sea el docente titular del grupo ──
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('docente_id')
    .eq('id', grupoId)
    .single();
  if (grupoError || !grupo) {
    return { success: false, message: 'Grupo no encontrado.' };
  }
  if (grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { data: evaluaciones } = await supabase
    .from('evaluaciones')
    .select('id, preguntas')
    .eq('grupo_id', grupoId);

  if (!evaluaciones || evaluaciones.length === 0) {
    return {
      success: false,
      message: 'No hay evaluaciones configuradas en este grupo.',
    };
  }

  const evalMap = new Map(evaluaciones.map((e) => [e.id, e.preguntas || []]));
  const evalIds = evaluaciones.map((e) => e.id);

  const { data: pendientes } = await supabase
    .from('respuestas_evaluaciones')
    .select('id, evaluacion_id, respuestas')
    .in('evaluacion_id', evalIds)
    .is('calificacion', null);

  if (!pendientes || pendientes.length === 0) {
    return {
      success: true,
      message: 'Todos los exámenes entregados ya se encuentran calificados.',
    };
  }

  let calificadosCount = 0;

  for (const item of pendientes) {
    const preguntas = (evalMap.get(item.evaluacion_id) as any[]) || [];
    const respuestasAlumno = (item.respuestas as number[]) || [];

    if (preguntas.length > 0) {
      let aciertos = 0;
      preguntas.forEach((q: any, idx: number) => {
        if (Number(respuestasAlumno[idx]) === Number(q.respuesta_correcta)) {
          aciertos++;
        }
      });

      const calificacionCalculada =
        Math.round((aciertos / preguntas.length) * 100 * 100) / 100;

      const { error } = await supabase
        .from('respuestas_evaluaciones')
        .update({
          calificacion: calificacionCalculada,
          retroalimentacion_docente: `Autocalificación automática verificada por docente (${aciertos}/${preguntas.length} aciertos).`,
          estado: 'calificado',
          calificado_en: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (!error) calificadosCount++;
    }
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  return {
    success: true,
    message: `¡Automatización completada! Se autocalificaron y firmaron ${calificadosCount} exámenes en acta.`,
  };
}

// ============================================================================
// 7. GENERADOR DE URL FIRMADA TEMPORAL PARA ARCHIVOS PRIVADOS
// ============================================================================
export async function obtenerUrlFirmadaEntregaAction(
  archivoUrlCompleta: string
): Promise<{ success: boolean; signedUrl?: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'No autenticado.' };
  }

  const marker = '/entregas_alumnos/';
  const index = archivoUrlCompleta.indexOf(marker);

  if (index === -1) {
    return { success: true, signedUrl: archivoUrlCompleta };
  }

  const relativePath = decodeURIComponent(
    archivoUrlCompleta.substring(index + marker.length)
  );

  // ── Seguridad: solo el dueño de la entrega O el docente titular del grupo
  //    pueden generar una URL firmada para archivos del bucket privado.
  //    Path esperado: {grupo_id}/{estudiante_id}/{timestamp}_{archivo}
  const [grupoIdFromPath, estudianteIdFromPath] = relativePath.split('/');
  if (grupoIdFromPath && estudianteIdFromPath) {
    const esElEstudiante = user.id === estudianteIdFromPath;
    if (!esElEstudiante) {
      const { data: grupoRow } = await supabase
        .from('grupos')
        .select('docente_id')
        .eq('id', grupoIdFromPath)
        .single();
      if (grupoRow?.docente_id !== user.id) {
        return { success: false, message: 'Acceso denegado a este archivo.' };
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { data, error } = await supabase.storage
    .from('entregas_alumnos')
    .createSignedUrl(relativePath, 300);

  if (error || !data?.signedUrl) {
    return {
      success: false,
      message: 'No fue posible generar el enlace seguro al documento.',
    };
  }

  return { success: true, signedUrl: data.signedUrl };
}

// ============================================================================
// 8. CONFIGURADOR AUTOMÁTICO DE PONDERACIÓN DE CALIFICACIONES (ENCUADRE)
// ============================================================================

const GuardarPonderacionSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  unidad_id: z.string().uuid('ID de unidad inválido.').nullable().optional(),
  peso_tareas_pct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
  peso_examenes_pct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
  peso_asistencia_pct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
  aplicar_a_todas_las_unidades: z.preprocess(
    (val) => val === true || val === 'true' || val === 'on' || val === '1',
    z.boolean()
  ).default(false),
});

export async function guardarConfiguracionPonderacionAction(
  prevStateOrData: ActionState | FormData | any,
  maybeFormData?: FormData
): Promise<ActionState> {
  let rawData: any = {};
  if (maybeFormData instanceof FormData) {
    rawData = {
      grupo_id: maybeFormData.get('grupo_id'),
      unidad_id: maybeFormData.get('unidad_id') || undefined,
      peso_tareas_pct: maybeFormData.get('peso_tareas_pct'),
      peso_examenes_pct: maybeFormData.get('peso_examenes_pct'),
      peso_asistencia_pct: maybeFormData.get('peso_asistencia_pct'),
      aplicar_a_todas_las_unidades: maybeFormData.get('aplicar_a_todas_las_unidades'),
    };
  } else if (prevStateOrData instanceof FormData) {
    rawData = {
      grupo_id: prevStateOrData.get('grupo_id'),
      unidad_id: prevStateOrData.get('unidad_id') || undefined,
      peso_tareas_pct: prevStateOrData.get('peso_tareas_pct'),
      peso_examenes_pct: prevStateOrData.get('peso_examenes_pct'),
      peso_asistencia_pct: prevStateOrData.get('peso_asistencia_pct'),
      aplicar_a_todas_las_unidades: prevStateOrData.get('aplicar_a_todas_las_unidades'),
    };
  } else if (typeof prevStateOrData === 'object' && prevStateOrData !== null) {
    rawData = prevStateOrData;
  }

  const parsed = GuardarPonderacionSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Verifica los valores de los porcentajes de encuadre.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    grupo_id,
    unidad_id,
    peso_tareas_pct,
    peso_examenes_pct,
    peso_asistencia_pct,
    aplicar_a_todas_las_unidades,
  } = parsed.data;

  // Validar que la suma sea exactamente 100%
  const suma = peso_tareas_pct + peso_examenes_pct + peso_asistencia_pct;
  if (suma !== 100) {
    return {
      success: false,
      message: `La ponderación debe sumar exactamente 100% (suma actual: ${suma}%).`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida.' };

  // Verificar que el usuario sea el docente titular del grupo
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupo_id)
    .single();

  if (grupoError || !grupo) {
    return { success: false, message: 'Grupo no encontrado.' };
  }

  if (grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'Acceso denegado: no eres el docente titular de este grupo.',
    };
  }

  // Si se envió una unidad específica y no se indicó aplicar a todas las unidades
  if (unidad_id && !aplicar_a_todas_las_unidades) {
    const { error: unidadError } = await supabase
      .from('unidades')
      .update({
        peso_tareas_pct,
        peso_examenes_pct,
        peso_asistencia_pct,
      })
      .eq('id', unidad_id)
      .eq('grupo_id', grupo_id);

    if (unidadError) {
      return {
        success: false,
        message: 'Error al actualizar el encuadre de la unidad.',
      };
    }

    revalidatePath(`/docente/grupos/${grupo_id}`);
    revalidatePath(`/estudiante/grupos/${grupo_id}`);
    return {
      success: true,
      message: `Encuadre guardado para la unidad (${peso_tareas_pct}% tareas, ${peso_examenes_pct}% exámenes, ${peso_asistencia_pct}% asistencia).`,
    };
  }

  // Actualizar configuración general del grupo
  const { error: updateGrupoError } = await supabase
    .from('grupos')
    .update({
      peso_tareas_pct,
      peso_examenes_pct,
      peso_asistencia_pct,
    })
    .eq('id', grupo_id);

  if (updateGrupoError) {
    return {
      success: false,
      message: 'Error al actualizar el encuadre del grupo.',
    };
  }

  // Si aplicar_a_todas_las_unidades es true, actualizar todas las unidades existentes
  if (aplicar_a_todas_las_unidades) {
    await supabase
      .from('unidades')
      .update({
        peso_tareas_pct,
        peso_examenes_pct,
        peso_asistencia_pct,
      })
      .eq('grupo_id', grupo_id);
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);

  return {
    success: true,
    message: aplicar_a_todas_las_unidades
      ? `Encuadre guardado y aplicado al grupo y a todas sus unidades (${peso_tareas_pct}% tareas, ${peso_examenes_pct}% exámenes, ${peso_asistencia_pct}% asistencia).`
      : `Encuadre general del grupo actualizado (${peso_tareas_pct}% tareas, ${peso_examenes_pct}% exámenes, ${peso_asistencia_pct}% asistencia).`,
  };
}

// ============================================================================
// 6. CLONADOR DE UNIDADES, TAREAS Y EXÁMENES DESDE OTRO GRUPO
// ============================================================================
export async function clonarEstructuraGrupoAction(
  grupoDestinoId: string,
  grupoOrigenId: string
): Promise<{ success: boolean; message: string }> {
  if (!grupoDestinoId || !grupoOrigenId) {
    return { success: false, message: 'Identificadores de grupo inválidos.' };
  }
  if (grupoDestinoId === grupoOrigenId) {
    return {
      success: false,
      message: 'El grupo destino y el origen no pueden ser el mismo.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sesión no válida.' };

  // Verificar que ambos grupos pertenezcan al docente autenticado
  const { data: gruposVerif, error: verifError } = await supabase
    .from('grupos')
    .select('id, nombre, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct')
    .in('id', [grupoDestinoId, grupoOrigenId])
    .eq('docente_id', user.id);

  if (verifError || !gruposVerif || gruposVerif.length < 2) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular sobre ambos grupos.',
    };
  }

  const grupoOrigen = gruposVerif.find((g) => g.id === grupoOrigenId);
  if (grupoOrigen) {
    await supabase
      .from('grupos')
      .update({
        peso_tareas_pct: grupoOrigen.peso_tareas_pct,
        peso_examenes_pct: grupoOrigen.peso_examenes_pct,
        peso_asistencia_pct: grupoOrigen.peso_asistencia_pct,
      })
      .eq('id', grupoDestinoId);
  }

  // 1. Obtener Unidades del grupo origen
  const { data: unidadesOrigen, error: errUnidades } = await supabase
    .from('unidades')
    .select('*')
    .eq('grupo_id', grupoOrigenId)
    .order('numero_unidad', { ascending: true });

  if (errUnidades) {
    return {
      success: false,
      message: 'Error al consultar las unidades del grupo de origen.',
    };
  }

  // Mapa de id_antiguo -> id_nuevo para las unidades
  const mapUnidades = new Map<string, string>();

  if (unidadesOrigen && unidadesOrigen.length > 0) {
    for (const u of unidadesOrigen) {
      const { data: nuevaUnidad, error: errInsertUnidad } = await supabase
        .from('unidades')
        .insert({
          grupo_id: grupoDestinoId,
          numero_unidad: u.numero_unidad,
          nombre: u.nombre,
          descripcion: u.descripcion,
          peso_tareas_pct: u.peso_tareas_pct,
          peso_examenes_pct: u.peso_examenes_pct,
          peso_asistencia_pct: u.peso_asistencia_pct,
        })
        .select('id')
        .single();

      if (!errInsertUnidad && nuevaUnidad) {
        mapUnidades.set(u.id, nuevaUnidad.id);
      }
    }
  }

  // 2. Obtener y clonar Tareas del grupo origen
  const { data: tareasOrigen, error: errTareas } = await supabase
    .from('tareas')
    .select('*')
    .eq('grupo_id', grupoOrigenId);

  let tareasClonadas = 0;
  if (!errTareas && tareasOrigen && tareasOrigen.length > 0) {
    // Fecha límite ajustada a +7 días desde hoy a las 23:59:00
    const fechaLimiteNueva = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    fechaLimiteNueva.setHours(23, 59, 0, 0);

    const tareasInsert = tareasOrigen.map((t) => ({
      grupo_id: grupoDestinoId,
      unidad_id: t.unidad_id ? mapUnidades.get(t.unidad_id) || null : null,
      titulo: t.titulo,
      descripcion: t.descripcion,
      ponderacion: t.ponderacion ?? 100,
      fecha_limite: fechaLimiteNueva.toISOString(),
      archivo_guia_url: t.archivo_guia_url,
      penalizacion_diaria_pct: t.penalizacion_diaria_pct ?? 10,
      penalizacion_maxima_pct: t.penalizacion_maxima_pct ?? 30,
      rubrica: t.rubrica || [],
    }));

    const { error: errInsertTareas } = await supabase
      .from('tareas')
      .insert(tareasInsert);
    if (!errInsertTareas) {
      tareasClonadas = tareasInsert.length;
    }
  }

  // 3. Obtener y clonar Evaluaciones del grupo origen
  const { data: evalOrigen, error: errEval } = await supabase
    .from('evaluaciones')
    .select('*')
    .eq('grupo_id', grupoOrigenId);

  let evalClonadas = 0;
  if (!errEval && evalOrigen && evalOrigen.length > 0) {
    const ahora = new Date();
    const fechaInicioNueva = new Date(
      ahora.getTime() + 5 * 24 * 60 * 60 * 1000
    );
    fechaInicioNueva.setHours(8, 0, 0, 0);
    const fechaCierreNueva = new Date(
      ahora.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    fechaCierreNueva.setHours(23, 59, 0, 0);

    const evalInsert = evalOrigen.map((e) => ({
      grupo_id: grupoDestinoId,
      unidad_id: e.unidad_id ? mapUnidades.get(e.unidad_id) || null : null,
      titulo: e.titulo,
      instrucciones: e.instrucciones,
      preguntas: e.preguntas,
      ponderacion: e.ponderacion ?? 100,
      fecha_inicio: fechaInicioNueva.toISOString(),
      fecha_cierre: fechaCierreNueva.toISOString(),
    }));

    const { error: errInsertEval } = await supabase
      .from('evaluaciones')
      .insert(evalInsert);
    if (!errInsertEval) {
      evalClonadas = evalInsert.length;
    }
  }

  revalidatePath(`/docente/grupos/${grupoDestinoId}`);
  revalidatePath(`/estudiante/grupos/${grupoDestinoId}`);

  return {
    success: true,
    message: `¡Clonación exitosa! Se importaron ${mapUnidades.size} unidades, ${tareasClonadas} tareas y ${evalClonadas} evaluaciones con fechas adaptadas.`,
  };
}

// 7. LISTAR OTROS GRUPOS DEL DOCENTE PARA IMPORTAR
export async function obtenerOtrosGruposDocenteAction(
  grupoActualId: string
): Promise<{ success: boolean; data?: any[]; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sesión no válida.' };

  const { data: grupos, error } = await supabase
    .from('grupos')
    .select('id, nombre, clave_materia, periodo, created_at')
    .eq('docente_id', user.id)
    .neq('id', grupoActualId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, message: 'Error al consultar otros grupos.' };
  }

  return { success: true, data: grupos || [] };
}

// ============================================================================
// 8. GESTIÓN INTEGRAL DE UNIDADES Y MOVIMIENTO / COPIADO ESTILO GOOGLE DRIVE
// ============================================================================

const EditarUnidadSchema = z.object({
  unidad_id: z.string().uuid('ID de unidad inválido.'),
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  numero_unidad: z.coerce.number().int().min(1, 'Mínimo Unidad 1.'),
  nombre: z
    .string()
    .min(2, 'Escribe el nombre de la unidad temática.')
    .transform(toCapitalizedSentence),
  descripcion: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : '')),
});

export async function editarUnidadAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const parsed = EditarUnidadSchema.safeParse({
    unidad_id: formData.get('unidad_id'),
    grupo_id: formData.get('grupo_id'),
    numero_unidad: formData.get('numero_unidad'),
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion') || '',
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Verifica los campos de la unidad temática.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { unidad_id, grupo_id, numero_unidad, nombre, descripcion } =
    parsed.data;

  // Verificar que el usuario sea el docente titular del grupo
  const { data: grupoRow, error: checkError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupo_id)
    .single();

  if (checkError || !grupoRow || grupoRow.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular sobre este grupo.',
    };
  }

  const { error: updateError } = await supabase
    .from('unidades')
    .update({
      numero_unidad,
      nombre,
      descripcion,
    })
    .eq('id', unidad_id)
    .eq('grupo_id', grupo_id);

  if (updateError) {
    return {
      success: false,
      message: 'Error al actualizar la unidad temática.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);

  return {
    success: true,
    message: `Unidad ${numero_unidad}: "${nombre}" actualizada correctamente.`,
  };
}

export async function eliminarUnidadAction(
  grupoId: string,
  unidadId: string
): Promise<{ success: boolean; message: string }> {
  if (!grupoId || !unidadId) {
    return { success: false, message: 'Parámetros inválidos.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  // Verificar titularidad
  const { data: grupoRow, error: checkError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupoId)
    .single();

  if (checkError || !grupoRow || grupoRow.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos para modificar este grupo.',
    };
  }

  // Desvincular tareas, evaluaciones y clases asociadas a esta unidad (unidad_id = null)
  await supabase
    .from('tareas')
    .update({ unidad_id: null })
    .eq('unidad_id', unidadId)
    .eq('grupo_id', grupoId);

  await supabase
    .from('evaluaciones')
    .update({ unidad_id: null })
    .eq('unidad_id', unidadId)
    .eq('grupo_id', grupoId);

  await supabase
    .from('clases_virtuales')
    .update({ unidad_id: null })
    .eq('unidad_id', unidadId)
    .eq('grupo_id', grupoId);

  const { error: deleteError } = await supabase
    .from('unidades')
    .delete()
    .eq('id', unidadId)
    .eq('grupo_id', grupoId);

  if (deleteError) {
    return {
      success: false,
      message: 'No se pudo eliminar la unidad de la base de datos.',
    };
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);

  return {
    success: true,
    message:
      'Unidad eliminada. Sus actividades se movieron a Actividades Generales.',
  };
}

export async function moverOCopiarActividadAction({
  grupoId,
  tipo,
  itemId,
  destinoUnidadId,
  accion,
}: {
  grupoId: string;
  tipo: 'tarea' | 'examen';
  itemId: string;
  destinoUnidadId: string | null;
  accion: 'mover' | 'copiar';
}): Promise<{ success: boolean; message: string }> {
  if (!grupoId || !itemId || !tipo || !accion) {
    return { success: false, message: 'Parámetros incompletos.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  // Verificar que el usuario sea el docente titular
  const { data: grupoRow, error: checkError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupoId)
    .single();

  if (checkError || !grupoRow || grupoRow.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular en este grupo.',
    };
  }

  // Normalizar destino: si es 'general' o vacío, se almacena como null
  const targetUnidadId =
    destinoUnidadId &&
    destinoUnidadId !== 'general' &&
    destinoUnidadId.trim().length > 0
      ? destinoUnidadId
      : null;

  if (accion === 'mover') {
    if (tipo === 'tarea') {
      const { error } = await supabase
        .from('tareas')
        .update({ unidad_id: targetUnidadId })
        .eq('id', itemId)
        .eq('grupo_id', grupoId);

      if (error) {
        return { success: false, message: 'Error al mover la tarea.' };
      }
    } else {
      const { error } = await supabase
        .from('evaluaciones')
        .update({ unidad_id: targetUnidadId })
        .eq('id', itemId)
        .eq('grupo_id', grupoId);

      if (error) {
        return { success: false, message: 'Error al mover la evaluación.' };
      }
    }

    revalidatePath(`/docente/grupos/${grupoId}`);
    revalidatePath(`/estudiante/grupos/${grupoId}`);

    return {
      success: true,
      message: `${
        tipo === 'tarea' ? 'Tarea' : 'Evaluación'
      } movida exitosamente.`,
    };
  }

  if (accion === 'copiar') {
    if (tipo === 'tarea') {
      const { data: tareaOrig, error: getErr } = await supabase
        .from('tareas')
        .select('*')
        .eq('id', itemId)
        .eq('grupo_id', grupoId)
        .single();

      if (getErr || !tareaOrig) {
        return {
          success: false,
          message: 'No se encontró la tarea original a copiar.',
        };
      }

      const { error: insertErr } = await supabase.from('tareas').insert({
        grupo_id: grupoId,
        unidad_id: targetUnidadId,
        titulo: `${tareaOrig.titulo} (Copia)`,
        descripcion: tareaOrig.descripcion,
        ponderacion: tareaOrig.ponderacion ?? 100,
        fecha_limite: tareaOrig.fecha_limite,
        archivo_guia_url: tareaOrig.archivo_guia_url,
        penalizacion_diaria_pct: tareaOrig.penalizacion_diaria_pct ?? 10,
        penalizacion_maxima_pct: tareaOrig.penalizacion_maxima_pct ?? 30,
        rubrica: tareaOrig.rubrica || [],
      });

      if (insertErr) {
        return { success: false, message: 'Error al duplicar la tarea.' };
      }
    } else {
      const { data: evalOrig, error: getErr } = await supabase
        .from('evaluaciones')
        .select('*')
        .eq('id', itemId)
        .eq('grupo_id', grupoId)
        .single();

      if (getErr || !evalOrig) {
        return {
          success: false,
          message: 'No se encontró la evaluación original a copiar.',
        };
      }

      const { error: insertErr } = await supabase.from('evaluaciones').insert({
        grupo_id: grupoId,
        unidad_id: targetUnidadId,
        titulo: `${evalOrig.titulo} (Copia)`,
        instrucciones: evalOrig.instrucciones,
        preguntas: evalOrig.preguntas,
        ponderacion: evalOrig.ponderacion ?? 100,
        fecha_inicio: evalOrig.fecha_inicio,
        fecha_cierre: evalOrig.fecha_cierre,
      });

      if (insertErr) {
        return { success: false, message: 'Error al duplicar la evaluación.' };
      }
    }

    revalidatePath(`/docente/grupos/${grupoId}`);
    revalidatePath(`/estudiante/grupos/${grupoId}`);

    return {
      success: true,
      message: `Copia de la ${
        tipo === 'tarea' ? 'tarea' : 'evaluación'
      } creada exitosamente.`,
    };
  }

  return { success: false, message: 'Acción no soportada.' };
}

export async function eliminarActividadAction(
  grupoId: string,
  tipo: 'tarea' | 'examen',
  itemId: string
): Promise<{ success: boolean; message: string }> {
  if (!grupoId || !tipo || !itemId) {
    return { success: false, message: 'Parámetros inválidos.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  // Verificar que el usuario sea el docente titular
  const { data: grupoRow, error: checkError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupoId)
    .single();

  if (checkError || !grupoRow || grupoRow.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular en este grupo.',
    };
  }

  if (tipo === 'tarea') {
    await supabase.from('entregas').delete().eq('tarea_id', itemId);

    const { error: deleteErr } = await supabase
      .from('tareas')
      .delete()
      .eq('id', itemId)
      .eq('grupo_id', grupoId);

    if (deleteErr) {
      return { success: false, message: 'Error al eliminar la tarea.' };
    }
  } else {
    await supabase
      .from('respuestas_evaluaciones')
      .delete()
      .eq('evaluacion_id', itemId);

    const { error: deleteErr } = await supabase
      .from('evaluaciones')
      .delete()
      .eq('id', itemId)
      .eq('grupo_id', grupoId);

    if (deleteErr) {
      return { success: false, message: 'Error al eliminar la evaluación.' };
    }
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);

  return {
    success: true,
    message: `${
      tipo === 'tarea' ? 'Tarea' : 'Evaluación'
    } eliminada correctamente.`,
  };
}

