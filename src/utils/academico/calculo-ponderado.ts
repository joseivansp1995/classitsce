/**
 * Motor Matemático Unificado por Encuadre (Modelo TecNM)
 * ClassITSCe - Tecnológico Nacional de México
 */

export interface GrupoConfig {
  calificacion_minima_aprobatoria?: number | string | null;
  asistencia_minima_porcentaje?: number | string | null;
  peso_tareas_pct?: number | string | null;
  peso_examenes_pct?: number | string | null;
  peso_asistencia_pct?: number | string | null;
  [key: string]: any;
}

export interface UnidadItem {
  id: string;
  numero_unidad?: number | string | null;
  nombre?: string | null;
  peso_tareas_pct?: number | string | null;
  peso_examenes_pct?: number | string | null;
  peso_asistencia_pct?: number | string | null;
  [key: string]: any;
}

export interface TareaItem {
  id: string;
  unidad_id?: string | null;
  ponderacion?: number | string | null;
  [key: string]: any;
}

export interface EvaluacionItem {
  id: string;
  unidad_id?: string | null;
  ponderacion?: number | string | null;
  [key: string]: any;
}

export interface EntregaItem {
  tarea_id: string;
  estudiante_id?: string | null;
  calificacion?: number | string | null;
  [key: string]: any;
}

export interface RespuestaEvaluacionItem {
  evaluacion_id: string;
  estudiante_id?: string | null;
  calificacion?: number | string | null;
  [key: string]: any;
}

export interface ClaseVirtualItem {
  id: string;
  unidad_id?: string | null;
  [key: string]: any;
}

export interface AsistenciaItem {
  clase_id: string;
  estudiante_id?: string | null;
  presente: boolean;
  [key: string]: any;
}

export interface ResultadoUnidad {
  unidadId: string;
  numero: number;
  nombre: string;
  calificacion: number;
  promedioTareas: number;
  promedioExamenes: number;
  asistenciaPct: number;
  tieneTareas: boolean;
  tieneExamenes: boolean;
  tieneAsistencia: boolean;
  pesosConfigurados: {
    tareas: number;
    examenes: number;
    asistencia: number;
  };
  pesosNormalizados: {
    tareas: number;
    examenes: number;
    asistencia: number;
  };
  aprobada: boolean;
}

export interface ResultadoCalculo {
  promedio: number;
  asistenciaPct: number;
  acredita: boolean;
  unidades: ResultadoUnidad[];
  unidadesReprobadas: ResultadoUnidad[];
}

export interface CalculoPonderadoParams {
  grupo: GrupoConfig;
  unidades?: UnidadItem[];
  tareas?: TareaItem[];
  evaluaciones?: EvaluacionItem[];
  clases?: ClaseVirtualItem[];
  entregas?: EntregaItem[];
  respuestas?: RespuestaEvaluacionItem[];
  asistencias?: AsistenciaItem[];
  estudianteId?: string | null;
}

/**
 * Calcula la calificación final y el desglose por unidades de un estudiante o grupo
 * conforme a las reglas oficiales del TecNM y normalización de encuadre.
 */
export function calcularCalificacionUnidadYCurso({
  grupo,
  unidades = [],
  tareas = [],
  evaluaciones = [],
  clases = [],
  entregas = [],
  respuestas = [],
  asistencias = [],
  estudianteId,
}: CalculoPonderadoParams): ResultadoCalculo {
  const minCalificacion = Number(grupo?.calificacion_minima_aprobatoria ?? 70);
  const minAsistencia = Number(grupo?.asistencia_minima_porcentaje ?? 80);

  // Pesos globales del grupo por defecto (50%, 40%, 10%)
  const gPesoTareas = Number(grupo?.peso_tareas_pct ?? 50);
  const gPesoExamenes = Number(grupo?.peso_examenes_pct ?? 40);
  const gPesoAsistencia = Number(grupo?.peso_asistencia_pct ?? 10);

  // Filtrar entregas, respuestas y asistencias si se especificó estudianteId
  const misEntregas = estudianteId
    ? entregas.filter((e) => e.estudiante_id === estudianteId)
    : entregas;
  const misRespuestas = estudianteId
    ? respuestas.filter((r) => r.estudiante_id === estudianteId)
    : respuestas;
  const misAsistencias = estudianteId
    ? asistencias.filter((a) => a.estudiante_id === estudianteId)
    : asistencias;

  const entregasMap = new Map(misEntregas.map((e) => [e.tarea_id, e]));
  const respuestasMap = new Map(misRespuestas.map((r) => [r.evaluacion_id, r]));

  // Cálculo de asistencia global del curso
  const totalSesionesGrupo = clases.length;
  const presentesGlobales = misAsistencias.filter((a) => a.presente).length;
  const asistenciaGlobalPct =
    totalSesionesGrupo > 0
      ? Math.round((presentesGlobales / totalSesionesGrupo) * 100 * 10) / 10
      : 100;

  // Si el curso tiene unidades temáticas configuradas
  if (unidades && unidades.length > 0) {
    const unidadesOrdenadas = [...unidades].sort(
      (a, b) => Number(a.numero_unidad ?? 0) - Number(b.numero_unidad ?? 0)
    );

    const resultadosUnidades: ResultadoUnidad[] = unidadesOrdenadas.map((u) => {
      // 1. Pesos específicos de la unidad (o heredados del grupo)
      const pTareas = Number(u.peso_tareas_pct ?? gPesoTareas);
      const pExamenes = Number(u.peso_examenes_pct ?? gPesoExamenes);
      const pAsistencia = Number(u.peso_asistencia_pct ?? gPesoAsistencia);

      // 2. Actividades pertenecientes a esta unidad
      const uTareas = tareas.filter((t) => t.unidad_id === u.id);
      const uEval = evaluaciones.filter((e) => e.unidad_id === u.id);
      const uClases = clases.filter((c) => c.unidad_id === u.id);

      const tieneTareas = uTareas.length > 0;
      const tieneExamenes = uEval.length > 0;
      // Si la unidad no tiene clases específicas asignadas, usa las clases generales del grupo
      const clasesParaUnidad = uClases.length > 0 ? uClases : clases;
      const tieneAsistencia = clasesParaUnidad.length > 0;

      // 3. Promedio simple de Tareas (0 a 100)
      let promedioTareas = 0;
      if (tieneTareas) {
        let sumaNotasTareas = 0;
        uTareas.forEach((t) => {
          const ent = entregasMap.get(t.id);
          const cal =
            ent?.calificacion !== null && ent?.calificacion !== undefined
              ? Number(ent.calificacion)
              : 0;
          sumaNotasTareas += cal;
        });
        promedioTareas = Math.round((sumaNotasTareas / uTareas.length) * 10) / 10;
      }

      // 4. Promedio simple de Exámenes (0 a 100)
      let promedioExamenes = 0;
      if (tieneExamenes) {
        let sumaNotasEval = 0;
        uEval.forEach((ev) => {
          const resp = respuestasMap.get(ev.id);
          const cal =
            resp?.calificacion !== null && resp?.calificacion !== undefined
              ? Number(resp.calificacion)
              : 0;
          sumaNotasEval += cal;
        });
        promedioExamenes = Math.round((sumaNotasEval / uEval.length) * 10) / 10;
      }

      // 5. Porcentaje de Asistencia de la Unidad (0 a 100)
      let unidadAsistenciaPct = 100;
      if (tieneAsistencia) {
        const clasesIds = new Set(clasesParaUnidad.map((c) => c.id));
        const presentesUnidad = misAsistencias.filter(
          (a) => a.presente && clasesIds.has(a.clase_id)
        ).length;
        unidadAsistenciaPct =
          Math.round((presentesUnidad / clasesParaUnidad.length) * 100 * 10) / 10;
      }

      // 6. Normalización dinámica de pesos activos
      let pesoTotalActivo = 0;
      if (tieneTareas) pesoTotalActivo += pTareas;
      if (tieneExamenes) pesoTotalActivo += pExamenes;
      if (tieneAsistencia) pesoTotalActivo += pAsistencia;

      let normTareas = 0;
      let normExamenes = 0;
      let normAsistencia = 0;
      let calificacionUnidad = 0;

      if (pesoTotalActivo > 0) {
        normTareas = tieneTareas ? pTareas / pesoTotalActivo : 0;
        normExamenes = tieneExamenes ? pExamenes / pesoTotalActivo : 0;
        normAsistencia = tieneAsistencia ? pAsistencia / pesoTotalActivo : 0;

        calificacionUnidad =
          promedioTareas * normTareas +
          promedioExamenes * normExamenes +
          unidadAsistenciaPct * normAsistencia;
        calificacionUnidad = Math.round(calificacionUnidad * 10) / 10;
      }

      return {
        unidadId: u.id,
        numero: Number(u.numero_unidad ?? 0),
        nombre: u.nombre ?? `Unidad ${u.numero_unidad}`,
        calificacion: calificacionUnidad,
        promedioTareas,
        promedioExamenes,
        asistenciaPct: unidadAsistenciaPct,
        tieneTareas,
        tieneExamenes,
        tieneAsistencia,
        pesosConfigurados: {
          tareas: pTareas,
          examenes: pExamenes,
          asistencia: pAsistencia,
        },
        pesosNormalizados: {
          tareas: Math.round(normTareas * 100),
          examenes: Math.round(normExamenes * 100),
          asistencia: Math.round(normAsistencia * 100),
        },
        aprobada: calificacionUnidad >= minCalificacion,
      };
    });

    const sumaPromedios = resultadosUnidades.reduce(
      (acc, ru) => acc + ru.calificacion,
      0
    );
    const promedio =
      resultadosUnidades.length > 0
        ? Math.round((sumaPromedios / resultadosUnidades.length) * 10) / 10
        : 0;

    const unidadesReprobadas = resultadosUnidades.filter((u) => !u.aprobada);
    const todasUnidadesAprobadas = unidadesReprobadas.length === 0;
    const acredita =
      todasUnidadesAprobadas && asistenciaGlobalPct >= minAsistencia;

    return {
      promedio,
      asistenciaPct: asistenciaGlobalPct,
      acredita,
      unidades: resultadosUnidades,
      unidadesReprobadas,
    };
  }

  // =========================================================================
  // Modo Global de Respaldo (cuando el grupo no tiene unidades creadas aún)
  // =========================================================================
  const tieneTareas = tareas.length > 0;
  const tieneExamenes = evaluaciones.length > 0;
  const tieneAsistencia = clases.length > 0;

  let promedioTareas = 0;
  if (tieneTareas) {
    let sumaNotas = 0;
    tareas.forEach((t) => {
      const ent = entregasMap.get(t.id);
      const cal =
        ent?.calificacion !== null && ent?.calificacion !== undefined
          ? Number(ent.calificacion)
          : 0;
      sumaNotas += cal;
    });
    promedioTareas = Math.round((sumaNotas / tareas.length) * 10) / 10;
  }

  let promedioExamenes = 0;
  if (tieneExamenes) {
    let sumaNotas = 0;
    evaluaciones.forEach((ev) => {
      const resp = respuestasMap.get(ev.id);
      const cal =
        resp?.calificacion !== null && resp?.calificacion !== undefined
          ? Number(resp.calificacion)
          : 0;
      sumaNotas += cal;
    });
    promedioExamenes = Math.round((sumaNotas / evaluaciones.length) * 10) / 10;
  }

  let pesoTotalActivo = 0;
  if (tieneTareas) pesoTotalActivo += gPesoTareas;
  if (tieneExamenes) pesoTotalActivo += gPesoExamenes;
  if (tieneAsistencia) pesoTotalActivo += gPesoAsistencia;

  let promedioGlobal = 0;
  if (pesoTotalActivo > 0) {
    const normTareas = tieneTareas ? gPesoTareas / pesoTotalActivo : 0;
    const normExamenes = tieneExamenes ? gPesoExamenes / pesoTotalActivo : 0;
    const normAsistencia = tieneAsistencia ? gPesoAsistencia / pesoTotalActivo : 0;

    promedioGlobal =
      promedioTareas * normTareas +
      promedioExamenes * normExamenes +
      asistenciaGlobalPct * normAsistencia;
    promedioGlobal = Math.round(promedioGlobal * 10) / 10;
  }

  const acredita =
    promedioGlobal >= minCalificacion && asistenciaGlobalPct >= minAsistencia;

  return {
    promedio: promedioGlobal,
    asistenciaPct: asistenciaGlobalPct,
    acredita,
    unidades: [],
    unidadesReprobadas: [],
  };
}

