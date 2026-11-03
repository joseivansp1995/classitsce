import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import MinimalGroupWorkspace from '@/components/grupos/MinimalGroupWorkspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AulaGrupoEstudiantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: estudianteProfile },
    { data: grupo, error: grupoError },
    { data: unidades },
    { data: tareas },
    { data: entregas },
    { data: evaluaciones },
    { data: respuestasEval },
    { data: materiales },
    { data: foroTemas },
    { data: clasesVirtuales },
    { data: asistencias },
    { data: misConstancias },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre_completo, email')
      .eq('id', user!.id)
      .single(),
    supabase
      .from('grupos')
      .select(
        'id, nombre, clave_materia, periodo, docente_id, calificacion_minima_aprobatoria, asistencia_minima_porcentaje, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('unidades')
      .select('id, grupo_id, numero_unidad, nombre, descripcion, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct')
      .eq('grupo_id', id)
      .order('numero_unidad', { ascending: true }),
    supabase
      .from('tareas')
      .select(
        'id, grupo_id, unidad_id, titulo, descripcion, archivo_guia_url, ponderacion, fecha_limite, penalizacion_diaria_pct, penalizacion_maxima_pct, rubrica'
      )
      .eq('grupo_id', id)
      .order('fecha_limite', { ascending: true }),
    supabase
      .from('entregas')
      .select(
        'id, tarea_id, estudiante_id, archivo_entrega_url, comentario_estudiante, estado, calificacion, calificacion_base, dias_retraso, puntos_penalizados, retroalimentacion_docente'
      )
      .eq('estudiante_id', user!.id)
      .limit(500),
    supabase
      .from('evaluaciones')
      .select(
        'id, grupo_id, unidad_id, titulo, instrucciones, preguntas, ponderacion, fecha_inicio, fecha_cierre'
      )
      .eq('grupo_id', id)
      .order('fecha_cierre', { ascending: true }),
    supabase
      .from('respuestas_evaluaciones')
      .select(
        'id, evaluacion_id, estudiante_id, respuestas, estado, calificacion, retroalimentacion_docente'
      )
      .eq('estudiante_id', user!.id)
      .limit(500),
    supabase
      .from('material_didactico')
      .select(
        'id, grupo_id, autor_id, titulo, descripcion, archivo_url, tipo_recurso, created_at, profiles:autor_id (nombre_completo, rol)'
      )
      .eq('grupo_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('foro_temas')
      .select(
        'id, grupo_id, docente_id, titulo, contenido, fijado, cerrado, created_at, profiles:docente_id (nombre_completo, rol)'
      )
      .eq('grupo_id', id)
      .order('fijado', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('clases_virtuales')
      .select(
        'id, grupo_id, unidad_id, titulo_sesion, codigo_sala_video, url_sala_video, fecha_programada, hora_inicio, hora_fin, activa'
      )
      .eq('grupo_id', id)
      .order('fecha_programada', { ascending: false }),
    supabase
      .from('asistencias')
      .select(
        'id, clase_id, grupo_id, estudiante_id, presente, origen, hora_registro'
      )
      .eq('grupo_id', id)
      .eq('estudiante_id', user!.id)
      .limit(500),
    supabase
      .from('constancias')
      .select(
        'id, folio, grupo_id, estudiante_id, promedio_final, porcentaje_asistencia, hash_verificacion, fecha_emision'
      )
      .eq('grupo_id', id)
      .eq('estudiante_id', user!.id),
  ]);

  if (grupoError || !grupo) {
    notFound();
  }

  const temaIds = (foroTemas || []).map((ft) => ft.id);
  const [{ data: docenteInfo }, { data: foroComentarios }] = await Promise.all([
    supabase
      .from('profiles')
      .select('nombre_completo')
      .eq('id', grupo.docente_id)
      .single(),
    temaIds.length > 0
      ? supabase
          .from('foro_comentarios')
          .select(
            'id, tema_id, autor_id, comentario_padre_id, contenido, created_at, profiles:autor_id (nombre_completo, rol)'
          )
          .in('tema_id', temaIds)
          .order('created_at', { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <MinimalGroupWorkspace
      esDocente={false}
      grupo={grupo}
      docenteNombre={docenteInfo?.nombre_completo || 'Docente Titular'}
      currentUser={{
        id: user!.id,
        nombre_completo:
          estudianteProfile?.nombre_completo || 'Estudiante Institucional',
        email: estudianteProfile?.email || user!.email || '',
      }}
      unidades={unidades || []}
      matriculas={[]}
      invitaciones={[]}
      tareas={tareas || []}
      evaluaciones={evaluaciones || []}
      entregas={entregas || []}
      respuestasEvaluaciones={respuestasEval || []}
      materiales={materiales || []}
      foroTemas={foroTemas || []}
      foroComentarios={foroComentarios || []}
      clasesVirtuales={clasesVirtuales || []}
      asistencias={asistencias || []}
      constancias={misConstancias || []}
    />
  );
}