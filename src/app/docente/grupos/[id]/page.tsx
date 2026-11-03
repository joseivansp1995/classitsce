import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import MinimalGroupWorkspace from '@/components/grupos/MinimalGroupWorkspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DetalleGrupoDocentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // UN SOLO BLOQUE PARALELO: Incluye unidades y columnas de penalización por retardo
  const [
    { data: docenteProfile },
    { data: grupo, error: grupoError },
    { data: unidades },
    { data: matriculas },
    { data: invitaciones },
    { data: tareas },
    { data: evaluaciones },
    { data: materiales },
    { data: foroTemas },
    { data: clasesVirtuales },
    { data: asistencias },
    { data: constanciasGrupo },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre_completo, email')
      .eq('id', user!.id)
      .single(),
    supabase
      .from('grupos')
      .select(
        'id, nombre, clave_materia, periodo, codigo_acceso, docente_id, calificacion_minima_aprobatoria, asistencia_minima_porcentaje, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct'
      )
      .eq('id', id)
      .eq('docente_id', user!.id)
      .single(),
    supabase
      .from('unidades')
      .select('id, grupo_id, numero_unidad, nombre, descripcion, peso_tareas_pct, peso_examenes_pct, peso_asistencia_pct')
      .eq('grupo_id', id)
      .order('numero_unidad', { ascending: true }),
    supabase
      .from('matriculas')
      .select('id, created_at, profiles:estudiante_id (id, nombre_completo, email)')
      .eq('grupo_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invitaciones')
      .select('id, email_estudiante, token, estado, expires_at, created_at')
      .eq('grupo_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tareas')
      .select(
        'id, grupo_id, unidad_id, titulo, descripcion, archivo_guia_url, ponderacion, fecha_limite, penalizacion_diaria_pct, penalizacion_maxima_pct, rubrica'
      )
      .eq('grupo_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('evaluaciones')
      .select(
        'id, grupo_id, unidad_id, titulo, instrucciones, preguntas, ponderacion, fecha_inicio, fecha_cierre'
      )
      .eq('grupo_id', id)
      .order('created_at', { ascending: false }),
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
      .limit(500),
    supabase
      .from('constancias')
      .select(
        'id, folio, grupo_id, estudiante_id, promedio_final, porcentaje_asistencia, hash_verificacion, fecha_emision'
      )
      .eq('grupo_id', id),
  ]);

  if (grupoError || !grupo) {
    notFound();
  }

  const tareaIds = (tareas || []).map((t) => t.id);
  const evalIds = (evaluaciones || []).map((e) => e.id);
  const temaIds = (foroTemas || []).map((ft) => ft.id);

  const [
    { data: entregas },
    { data: respuestasEvaluaciones },
    { data: foroComentarios },
  ] = await Promise.all([
    tareaIds.length > 0
      ? supabase
          .from('entregas')
          .select(
            'id, tarea_id, estudiante_id, archivo_entrega_url, comentario_estudiante, estado, calificacion, calificacion_base, dias_retraso, puntos_penalizados, retroalimentacion_docente, entregado_en, profiles:estudiante_id (nombre_completo, email), tareas:tarea_id (titulo, ponderacion)'
          )
          .in('tarea_id', tareaIds)
          .order('entregado_en', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    evalIds.length > 0
      ? supabase
          .from('respuestas_evaluaciones')
          .select(
            'id, evaluacion_id, estudiante_id, respuestas, estado, calificacion, retroalimentacion_docente, entregado_en, profiles:estudiante_id (nombre_completo, email), evaluaciones:evaluacion_id (titulo, preguntas, ponderacion)'
          )
          .in('evaluacion_id', evalIds)
          .order('entregado_en', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
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
      esDocente={true}
      grupo={grupo}
      docenteNombre={docenteProfile?.nombre_completo || 'Docente Titular'}
      currentUser={{
        id: user!.id,
        nombre_completo: docenteProfile?.nombre_completo || 'Docente Titular',
        email: docenteProfile?.email || user!.email || '',
      }}
      unidades={unidades || []}
      matriculas={matriculas || []}
      invitaciones={invitaciones || []}
      tareas={tareas || []}
      evaluaciones={evaluaciones || []}
      entregas={entregas || []}
      respuestasEvaluaciones={respuestasEvaluaciones || []}
      materiales={materiales || []}
      foroTemas={foroTemas || []}
      foroComentarios={foroComentarios || []}
      clasesVirtuales={clasesVirtuales || []}
      asistencias={asistencias || []}
      constancias={constanciasGrupo || []}
    />
  );
}