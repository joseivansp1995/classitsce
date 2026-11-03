'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { ActionState } from '@/app/(auth)/actions';
import { toCapitalizedSentence } from '@/utils/formatters/text-sanitizer';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ============================================================================

const ProgramarClaseSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  unidad_id: z.string().uuid().nullable().optional(),
  titulo_sesion: z
    .string()
    .min(3, 'El título de la sesión debe tener al menos 3 caracteres.')
    .max(120, 'Título demasiado largo.')
    .transform(toCapitalizedSentence),
  fecha_programada: z.string().min(1, 'Selecciona la fecha de la clase.'),
  hora_inicio: z.string().min(1, 'Define la hora de inicio.'),
  hora_fin: z.string().min(1, 'Define la hora de finalización.'),
});

// ============================================================================
// 1. PROGRAMAR NUEVA SESIÓN VIRTUAL EN EL CALENDARIO (DOCENTE TITULAR)
// ============================================================================
export async function programarClaseVirtualAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawUnidadId = formData.get('unidad_id');
  const parsed = ProgramarClaseSchema.safeParse({
    grupo_id: formData.get('grupo_id'),
    unidad_id:
      rawUnidadId && String(rawUnidadId).trim().length > 0
        ? String(rawUnidadId)
        : null,
    titulo_sesion: formData.get('titulo_sesion'),
    fecha_programada: formData.get('fecha_programada'),
    hora_inicio: formData.get('hora_inicio'),
    hora_fin: formData.get('hora_fin'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Revisa los campos de fecha y horario de la sesión.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { grupo_id, unidad_id, titulo_sesion, fecha_programada, hora_inicio, hora_fin } =
    parsed.data;

  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupo_id)
    .single();

  if (grupoError || !grupo || grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular para agendar clases en este grupo.',
    };
  }

  // Generar identificador único e institucional para la sala en Jitsi Meet
  const shortGroup = grupo_id.split('-')[0].toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const codigo_sala_video = `ClassITSCe-TecNM-${shortGroup}-${randomSuffix}`;
  const url_sala_video = `https://meet.jit.si/${codigo_sala_video}`;

  const { error } = await supabase.from('clases_virtuales').insert({
    grupo_id,
    unidad_id: unidad_id ?? null,
    titulo_sesion,
    codigo_sala_video,
    url_sala_video,
    fecha_programada,
    hora_inicio,
    hora_fin,
    activa: true,
  });

  if (error) {
    return {
      success: false,
      message:
        'No se pudo agendar la sesión virtual. Verifica que seas el docente titular.',
    };
  }

  revalidatePath(`/docente/grupos/${grupo_id}`);
  revalidatePath(`/estudiante/grupos/${grupo_id}`);
  return {
    success: true,
    message: `Sesión "${titulo_sesion}" agendada y sala de video vinculada.`,
  };
}

// ============================================================================
// 2. ABRIR / FINALIZAR SALA DE VIDEO (DOCENTE TITULAR)
// ============================================================================
export async function toggleEstadoClaseVirtualAction(
  claseId: string,
  grupoId: string,
  nuevoEstadoActiva: boolean
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupoId)
    .single();

  if (grupoError || !grupo || grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular para modificar esta sala virtual.',
    };
  }

  const { error } = await supabase
    .from('clases_virtuales')
    .update({ activa: nuevoEstadoActiva })
    .eq('id', claseId);

  if (error) {
    return {
      success: false,
      message: 'Error al actualizar el estado de la sala virtual.',
    };
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);
  return {
    success: true,
    message: nuevoEstadoActiva
      ? 'Sala virtual habilitada para toma de asistencia.'
      : 'Sesión virtual finalizada.',
  };
}

// ============================================================================
// 3. REGISTRO AUTOMÁTICO DE ASISTENCIA AL ENTRAR A LA VIDEOLLAMADA (ESTUDIANTE)
// ============================================================================
export async function registrarAsistenciaAutomaticaAction(
  claseId: string,
  grupoId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'No autenticado.' };
  }

  const { data: matricula, error: matError } = await supabase
    .from('matriculas')
    .select('id')
    .eq('grupo_id', grupoId)
    .eq('estudiante_id', user.id)
    .maybeSingle();

  if (matError || !matricula) {
    return {
      success: false,
      message: 'No estás matriculado en este grupo para registrar asistencia.',
    };
  }

  // Verificar si ya tiene asistencia registrada en esta sesión para evitar duplicados
  const { data: existente } = await supabase
    .from('asistencias')
    .select('id, presente')
    .eq('clase_id', claseId)
    .eq('estudiante_id', user.id)
    .maybeSingle();

  if (existente) {
    return {
      success: true,
      message: 'Tu asistencia ya se encontraba registrada en esta sesión.',
    };
  }

  const { error } = await supabase.from('asistencias').insert({
    clase_id: claseId,
    grupo_id: grupoId,
    estudiante_id: user.id,
    presente: true,
    origen: 'virtual_auto',
    hora_registro: new Date().toISOString(),
  });

  if (error) {
    return {
      success: false,
      message:
        'No se pudo registrar la asistencia automática (verifica que la sesión esté activa).',
    };
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);
  return {
    success: true,
    message:
      '¡Asistencia registrada automáticamente al conectarte a la videollamada!',
  };
}

// ============================================================================
// 4. PASE DE LISTA MANUAL POR EL DOCENTE DURANTE O DESPUÉS DE LA CLASE
// ============================================================================
export async function marcarAsistenciaManualDocenteAction(
  claseId: string,
  grupoId: string,
  estudianteId: string,
  presente: boolean
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id, docente_id')
    .eq('id', grupoId)
    .single();

  if (grupoError || !grupo || grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'No tienes permisos de docente titular para asentar asistencia.',
    };
  }

  const { data: existente } = await supabase
    .from('asistencias')
    .select('id')
    .eq('clase_id', claseId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from('asistencias')
      .update({
        presente,
        origen: 'manual_docente',
        hora_registro: new Date().toISOString(),
      })
      .eq('id', existente.id);

    if (error) {
      return {
        success: false,
        message: 'No tienes permisos para modificar la lista de asistencia.',
      };
    }
  } else {
    const { error } = await supabase.from('asistencias').insert({
      clase_id: claseId,
      grupo_id: grupoId,
      estudiante_id: estudianteId,
      presente,
      origen: 'manual_docente',
      hora_registro: new Date().toISOString(),
    });

    if (error) {
      return {
        success: false,
        message: 'Error al registrar asistencia manual.',
      };
    }
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);
  return {
    success: true,
    message: 'Asistencia actualizada por el docente.',
  };
}