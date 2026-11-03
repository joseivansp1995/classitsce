'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { ActionState } from '@/app/(auth)/actions';
import { calcularCalificacionUnidadYCurso } from '@/utils/academico/calculo-ponderado';

const EmitirConstanciaSchema = z.object({
  grupo_id: z.string().uuid('ID de grupo inválido.'),
  estudiante_id: z.string().uuid('ID de estudiante inválido.'),
});

export async function emitirConstanciaAction(
  grupoId: string,
  estudianteId: string
): Promise<ActionState> {
  const parsed = EmitirConstanciaSchema.safeParse({
    grupo_id: grupoId,
    estudiante_id: estudianteId,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Identificadores de grupo o estudiante inválidos.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Sesión no válida.' };
  }

  // 1. Verificar si la constancia ya fue emitida previamente
  const { data: constanciaExistente } = await supabase
    .from('constancias')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (constanciaExistente) {
    return {
      success: true,
      message: 'La constancia ya se encontraba emitida y lista para descarga.',
      data: { constancia: constanciaExistente },
    };
  }

  // 2. Consultar reglas de acreditación del grupo
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select(
      'id, nombre, docente_id, calificacion_minima_aprobatoria, asistencia_minima_porcentaje, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct'
    )
    .eq('id', grupoId)
    .single();

  if (grupoError || !grupo) {
    return { success: false, message: 'No se encontró el grupo académico.' };
  }

  if (grupo.docente_id !== user.id) {
    return {
      success: false,
      message: 'Acceso denegado: solo el docente titular del grupo puede expedir constancias oficiales.',
    };
  }

  // 3. Consultar unidades, tareas, evaluaciones y clases del grupo para calcular promedio y asistencia reales
  const [
    { data: unidades },
    { data: tareas },
    { data: evaluaciones },
    { data: clases },
    { data: asistenciasAlumno },
  ] = await Promise.all([
    supabase
      .from('unidades')
      .select('id, numero_unidad, nombre, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct')
      .eq('grupo_id', grupoId)
      .order('numero_unidad', { ascending: true }),
    supabase
      .from('tareas')
      .select('id, unidad_id, ponderacion')
      .eq('grupo_id', grupoId),
    supabase
      .from('evaluaciones')
      .select('id, unidad_id, ponderacion')
      .eq('grupo_id', grupoId),
    supabase.from('clases_virtuales').select('id, unidad_id').eq('grupo_id', grupoId),
    supabase
      .from('asistencias')
      .select('id, clase_id, presente')
      .eq('grupo_id', grupoId)
      .eq('estudiante_id', estudianteId)
      .eq('presente', true),
  ]);

  const tareaIds = (tareas || []).map((t) => t.id);
  const evalIds = (evaluaciones || []).map((e) => e.id);

  const [{ data: entregasAlumno }, { data: respuestasAlumno }] =
    await Promise.all([
      tareaIds.length > 0
        ? supabase
            .from('entregas')
            .select('tarea_id, calificacion')
            .eq('estudiante_id', estudianteId)
            .in('tarea_id', tareaIds)
        : Promise.resolve({ data: [] }),
      evalIds.length > 0
        ? supabase
            .from('respuestas_evaluaciones')
            .select('evaluacion_id, calificacion')
            .eq('estudiante_id', estudianteId)
            .in('evaluacion_id', evalIds)
        : Promise.resolve({ data: [] }),
    ]);

  // 4. Cálculo matemático unificado con el motor de Encuadre TecNM
  const resCalculo = calcularCalificacionUnidadYCurso({
    grupo,
    unidades: unidades || [],
    tareas: tareas || [],
    evaluaciones: evaluaciones || [],
    clases: clases || [],
    entregas: entregasAlumno || [],
    respuestas: respuestasAlumno || [],
    asistencias: asistenciasAlumno || [],
    estudianteId,
  });

  const promedioFinal = resCalculo.promedio;
  const porcentajeAsistencia = resCalculo.asistenciaPct;
  const minCalificacion = Number(grupo.calificacion_minima_aprobatoria ?? 70);
  const minAsistencia = Number(grupo.asistencia_minima_porcentaje ?? 80);

  // 5. Validar cumplimiento estricto de las reglas fijadas por el docente y modelo TecNM
  if (porcentajeAsistencia < minAsistencia) {
    return {
      success: false,
      message: `El estudiante no cumple el porcentaje mínimo de asistencia institucional (${porcentajeAsistencia}% / mín. ${minAsistencia}%).`,
    };
  }

  if (unidades && unidades.length > 0 && resCalculo.unidadesReprobadas.length > 0) {
    const detalleReprobadas = resCalculo.unidadesReprobadas
      .map((u) => `U${u.numero} (${u.calificacion} pts)`)
      .join(', ');
    return {
      success: false,
      message: `El estudiante no acredita bajo el modelo TecNM: no aprobó todas las unidades requeridas. Unidades no acreditadas: ${detalleReprobadas} (calificación mínima: ${minCalificacion}).`,
    };
  }

  if (promedioFinal < minCalificacion) {
    return {
      success: false,
      message: `Promedio insuficiente para acreditación: ${promedioFinal} (mínimo aprobatorio: ${minCalificacion}).`,
    };
  }

  // 6. Insertar constancia oficial en Supabase (genera folio ITSCe-XXXXX y hash_verificacion UUID)
  const { data: nuevaConstancia, error: insertError } = await supabase
    .from('constancias')
    .insert({
      grupo_id: grupoId,
      estudiante_id: estudianteId,
      promedio_final: promedioFinal,
      porcentaje_asistencia: porcentajeAsistencia,
    })
    .select('*')
    .single();

  if (insertError || !nuevaConstancia) {
    return {
      success: false,
      message: 'Error al expedir el registro oficial de la constancia en el sistema.',
    };
  }

  revalidatePath(`/docente/grupos/${grupoId}`);
  revalidatePath(`/estudiante/grupos/${grupoId}`);

  return {
    success: true,
    message: `Constancia oficial expedida con Folio ${nuevaConstancia.folio}.`,
    data: { constancia: nuevaConstancia },
  };
}