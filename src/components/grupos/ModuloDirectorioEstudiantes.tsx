'use client';

import React, { useState, useMemo, useTransition } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Award,
  FileText,
  ClipboardList,
  Video,
  Download,
  ExternalLink,
  X,
  Save,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  ClockAlert,
  FileSpreadsheet,
  Wand2,
  Lock,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  calificarTareaDirectaAlumnoAction,
  calificarEvaluacionAction,
  autocalificarEvaluacionesMasivoAction,
  obtenerUrlFirmadaEntregaAction,
} from '@/app/docente/grupos/[id]/actions';
import { marcarAsistenciaManualDocenteAction } from '@/app/actions/clases-virtuales';
import { emitirConstanciaAction } from '@/app/actions/constancias';
import { calcularCalificacionUnidadYCurso } from '@/utils/academico/calculo-ponderado';

export default function ModuloDirectorioEstudiantes({
  grupo,
  docenteNombre,
  matriculas,
  tareas,
  evaluaciones,
  entregas,
  respuestasEvaluaciones,
  clasesVirtuales,
  asistencias,
  constancias,
  unidades = [],
}: {
  grupo: any;
  docenteNombre: string;
  matriculas: any[];
  tareas: any[];
  evaluaciones: any[];
  entregas: any[];
  respuestasEvaluaciones: any[];
  clasesVirtuales: any[];
  asistencias: any[];
  constancias: any[];
  unidades?: any[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'todos' | 'acreditados' | 'riesgo'
  >('todos');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [drawerTab, setDrawerTab] = useState<
    'tareas' | 'examenes' | 'asistencia' | 'constancia'
  >('tareas');

  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>(
    {}
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const getUnidadBadge = (unidadId: string | null | undefined) => {
    if (!unidadId) return null;
    const u = unidades.find((x: any) => x.id === unidadId);
    if (!u) return null;
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        U{u.numero_unidad}
      </span>
    );
  };

  // Procesar expediente completo de cada estudiante matriculado con motor unificado por Encuadre
  const estudiantesProcesados = useMemo(() => {
    return matriculas.map((m: any) => {
      const perfil = m.profiles || {};
      const estId = perfil.id;

      const totalSesiones = clasesVirtuales.length;
      let tareasEntregadasCount = 0;
      tareas.forEach((t) => {
        const ent = entregas.find(
          (e) => e.tarea_id === t.id && e.estudiante_id === estId
        );
        if (ent) tareasEntregadasCount++;
      });

      let examenesRespondidosCount = 0;
      evaluaciones.forEach((ev) => {
        const resp = respuestasEvaluaciones.find(
          (r) => r.evaluacion_id === ev.id && r.estudiante_id === estId
        );
        if (resp) examenesRespondidosCount++;
      });

      // Cálculo matemático unificado con normalización por Encuadre de Unidad
      const resCalculo = calcularCalificacionUnidadYCurso({
        grupo,
        unidades,
        tareas,
        evaluaciones,
        clases: clasesVirtuales,
        entregas,
        respuestas: respuestasEvaluaciones,
        asistencias,
        estudianteId: estId,
      });

      const asistenciasPresentes = asistencias.filter(
        (a) => a.estudiante_id === estId && a.presente
      ).length;

      const constancia = constancias.find((c) => c.estudiante_id === estId);

      return {
        matriculaId: m.id,
        id: estId,
        nombre_completo: perfil.nombre_completo || 'Sin nombre',
        email: perfil.email || '',
        fecha_alta: m.created_at,
        promedio: resCalculo.promedio,
        calificacionesUnidades: resCalculo.unidades,
        asistenciaPct: resCalculo.asistenciaPct,
        asistenciasPresentes,
        totalSesiones,
        tareasEntregadasCount,
        examenesRespondidosCount,
        acredita: resCalculo.acredita,
        constancia,
      };
    });
  }, [
    matriculas,
    tareas,
    evaluaciones,
    entregas,
    respuestasEvaluaciones,
    clasesVirtuales,
    asistencias,
    constancias,
    grupo,
    unidades,
  ]);

  const estudiantesFiltrados = estudiantesProcesados.filter((est) => {
    const matchSearch =
      est.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      est.email.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter === 'acreditados') return est.acredita;
    if (statusFilter === 'riesgo') return !est.acredita;
    return true;
  });

  const alumnoActivo =
    estudiantesProcesados.find((e) => e.id === selectedStudentId) || null;

  const examenesPendientesCount = respuestasEvaluaciones.filter(
    (r) => r.calificacion === null
  ).length;

  // ==========================================================================
  // INNOVACIÓN 1: EXPORTAR ACTA OFICIAL DE CALIFICACIONES Y ASISTENCIA A EXCEL (CSV)
  // ==========================================================================
  const handleExportarActaExcel = () => {
    if (estudiantesProcesados.length === 0) {
      showToast('No hay alumnos matriculados para exportar.');
      return;
    }

    const unidadesOrdenadas = [...(unidades || [])].sort(
      (a: any, b: any) => Number(a.numero_unidad) - Number(b.numero_unidad)
    );

    const headers = [
      'No.',
      'Nombre Completo',
      'Correo Institucional',
      ...tareas.map((t) => `Tarea: ${t.titulo} (${t.ponderacion}%)`),
      ...evaluaciones.map((ev) => `Examen: ${ev.titulo} (${ev.ponderacion}%)`),
      'Asistencias Presentes',
      '% Asistencia',
      ...unidadesOrdenadas.map((u: any) => `U${u.numero_unidad}: ${u.nombre}`),
      'Promedio Final Ponderado',
      'Dictamen',
      'Folio Constancia QR',
    ];

    const rows = estudiantesProcesados.map((est, idx) => {
      const notasTareas = tareas.map((t) => {
        const ent = entregas.find(
          (e) => e.tarea_id === t.id && e.estudiante_id === est.id
        );
        return ent?.calificacion ?? 0;
      });

      const notasExamenes = evaluaciones.map((ev) => {
        const resp = respuestasEvaluaciones.find(
          (r) => r.evaluacion_id === ev.id && r.estudiante_id === est.id
        );
        return resp?.calificacion ?? 0;
      });

      const notasUnidades = unidadesOrdenadas.map((u: any) => {
        const cu = est.calificacionesUnidades?.find(
          (item: any) => item.unidadId === u.id
        );
        return cu !== undefined ? cu.calificacion : 0;
      });

      return [
        idx + 1,
        `"${est.nombre_completo.replace(/"/g, '""')}"`,
        est.email,
        ...notasTareas,
        ...notasExamenes,
        `${est.asistenciasPresentes}/${est.totalSesiones}`,
        `${est.asistenciaPct}%`,
        ...notasUnidades,
        est.promedio,
        est.acredita ? 'ACREDITADO' : 'NO ACREDITADO',
        est.constancia?.folio || 'SIN EMITIR',
      ];
    });

    // BOM UTF-8 (\uFEFF) para que Microsoft Excel reconozca acentos y ñ perfectamente
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Acta_${grupo.clave_materia}_${grupo.periodo.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Acta oficial descargada en formato compatible con Excel.');
  };

  // ==========================================================================
  // INNOVACIÓN 2: AUTOCALIFICACIÓN MASIVA DE EXÁMENES EN 1 CLIC
  // ==========================================================================
  const handleAutocalificarExamenes = () => {
    startTransition(async () => {
      const res = await autocalificarEvaluacionesMasivoAction(grupo.id);
      showToast(res.message);
    });
  };

  // ==========================================================================
  // INNOVACIÓN 1 & 2: VISOR INTEGRADO SPLIT-VIEW Y RÚBRICAS INTERACTIVAS
  // ==========================================================================
  const [previewEntrega, setPreviewEntrega] = useState<{
    signedUrl: string;
    blobUrl: string;
    isPdf: boolean;
    isImg: boolean;
    tarea: any;
    entrega: any;
  } | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const handleCerrarVisor = () => {
    if (previewEntrega?.blobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewEntrega.blobUrl);
    }
    setPreviewEntrega(null);
  };

  const handleAbrirArchivoSeguro = (
    urlCompleta: string,
    tarea?: any,
    entrega?: any
  ) => {
    startTransition(async () => {
      setLoadingDoc(true);
      if (previewEntrega?.blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewEntrega.blobUrl);
      }
      setPreviewEntrega(null);

      const res = await obtenerUrlFirmadaEntregaAction(urlCompleta);
      const effectiveSignedUrl = (res.success && res.signedUrl) ? res.signedUrl : urlCompleta;
      const cleanPath = (urlCompleta || '').split('?')[0].toLowerCase();
      const isPdf = /\.pdf$/i.test(cleanPath);
      const isImg = /\.(png|jpg|jpeg|webp|gif)$/i.test(cleanPath);

      let blobUrl: string = effectiveSignedUrl;
      if (res.success && res.signedUrl) {
        try {
          const fetchRes = await fetch(res.signedUrl);
          if (fetchRes.ok) {
            const rawBlob = await fetchRes.blob();
            const finalBlob = new Blob([rawBlob], {
              type: isPdf
                ? 'application/pdf'
                : isImg
                ? rawBlob.type || 'image/jpeg'
                : rawBlob.type,
            });
            blobUrl = URL.createObjectURL(finalBlob);
          }
        } catch (err) {
          console.warn('Fallback a signedUrl:', err);
        }
      }

      setPreviewEntrega({
        signedUrl: effectiveSignedUrl,
        blobUrl,
        isPdf,
        isImg,
        tarea: tarea || null,
        entrega: entrega || null,
      });
      setLoadingDoc(false);
    });
  };

  const handleAplicarCriterioRubrica = (
    tareaId: string,
    criterio: { criterio: string; puntos: number }
  ) => {
    const currentCal = Number(gradeInputs[`tarea_${tareaId}`] || 0);
    const nuevaCal = Math.min(100, currentCal + Number(criterio.puntos));
    setGradeInputs((prev) => ({
      ...prev,
      [`tarea_${tareaId}`]: String(nuevaCal),
    }));

    const currentRetro = feedbackInputs[`tarea_${tareaId}`] || '';
    const textoCriterio = `✓ ${criterio.criterio} (+${criterio.puntos} pts)`;
    const nuevaRetro = currentRetro
      ? `${currentRetro} | ${textoCriterio}`
      : textoCriterio;
    setFeedbackInputs((prev) => ({
      ...prev,
      [`tarea_${tareaId}`]: nuevaRetro,
    }));
  };

  const handleGuardarNotaTarea = (tareaId: string, defaultCal: number) => {
    if (!alumnoActivo) return;
    const rawCal = gradeInputs[`tarea_${tareaId}`];
    const cal = rawCal !== undefined ? Number(rawCal) : defaultCal;
    const retro = feedbackInputs[`tarea_${tareaId}`] ?? '';

    startTransition(async () => {
      const res = await calificarTareaDirectaAlumnoAction(
        grupo.id,
        tareaId,
        alumnoActivo.id,
        cal,
        retro
      );
      showToast(res.message);
    });
  };

  const handleGuardarNotaExamen = (respuestaId: string, defaultCal: number) => {
    const rawCal = gradeInputs[`exam_${respuestaId}`];
    const cal = rawCal !== undefined ? Number(rawCal) : defaultCal;

    const fd = new FormData();
    fd.set('respuesta_id', respuestaId);
    fd.set('grupo_id', grupo.id);
    fd.set('calificacion', String(cal));
    fd.set('retroalimentacion_docente', '');

    startTransition(async () => {
      const res = await calificarEvaluacionAction(null, fd);
      showToast(res.message);
    });
  };

  const handleCambiarAsistencia = (claseId: string, presente: boolean) => {
    if (!alumnoActivo) return;
    startTransition(async () => {
      const res = await marcarAsistenciaManualDocenteAction(
        claseId,
        grupo.id,
        alumnoActivo.id,
        presente
      );
      showToast(res.message);
    });
  };

  const handleEmitirDescargarConstancia = (alumno: any) => {
    startTransition(async () => {
      let constanciaData = alumno.constancia;
      if (!constanciaData) {
        const res = await emitirConstanciaAction(grupo.id, alumno.id);
        if (!res.success) {
          showToast(res.message);
          return;
        }
        constanciaData = res.data?.constancia;
      }

      if (constanciaData) {
        const origin =
          typeof window !== 'undefined'
            ? window.location.origin
            : 'http://localhost:3000';
        const urlVerificacion = `${origin}/verificar/${encodeURIComponent(
          constanciaData.folio
        )}`;
        const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
          width: 220,
          margin: 1,
          color: { dark: '#1B396A', light: '#FFFFFF' },
        });

        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, 297, 210, 'F');
        doc.setDrawColor(27, 57, 106);
        doc.setLineWidth(3);
        doc.rect(10, 10, 277, 190);
        doc.setFillColor(27, 57, 106);
        doc.rect(13, 13, 271, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(
          'TECNOLÓGICO NACIONAL DE MÉXICO • CAMPUS CENTLA (ClassITSCe)',
          148.5,
          28,
          { align: 'center' }
        );
        doc.setTextColor(27, 57, 106);
        doc.setFontSize(22);
        doc.text('CONSTANCIA DE ACREDITACIÓN ACADÉMICA', 148.5, 58, {
          align: 'center',
        });
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(20);
        doc.text(alumno.nombre_completo.toUpperCase(), 148.5, 82, {
          align: 'center',
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(
          `Acreditó: ${grupo.nombre} (${grupo.clave_materia}) • Promedio: ${constanciaData.promedio_final} | Asistencia: ${constanciaData.porcentaje_asistencia}%`,
          148.5,
          108,
          { align: 'center' }
        );
        doc.setFont('helvetica', 'bold');
        doc.text(`Docente Titular: ${docenteNombre}`, 148.5, 165, {
          align: 'center',
        });
        doc.setFontSize(9);
        doc.text(`Folio: ${constanciaData.folio}`, 22, 175);
        doc.addImage(qrDataUrl, 'PNG', 240, 145, 35, 35);
        doc.save(`Constancia_${constanciaData.folio}.pdf`);
        showToast(`Constancia ${constanciaData.folio} descargada.`);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Banner de Notificación */}
      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-emerald-700 hover:underline text-[11px]"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Barra Superior de Automatización, Filtros y Exportación Excel */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100/90">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'todos'
                ? 'bg-white text-[#1B396A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({estudiantesProcesados.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('acreditados')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'acreditados'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Acreditados (
            {estudiantesProcesados.filter((e) => e.acredita).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('riesgo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'riesgo'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            En Riesgo ({estudiantesProcesados.filter((e) => !e.acredita).length}
            )
          </button>
        </div>

        {/* Botones de Automatización EdTech + Buscador */}
        <div className="flex flex-wrap items-center gap-2">
          {examenesPendientesCount > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleAutocalificarExamenes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-all"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Autocalificar {examenesPendientesCount} Exámenes
            </button>
          )}

          <button
            type="button"
            onClick={handleExportarActaExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exportar Acta Excel (CSV)
          </button>

          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar estudiante..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
            />
          </div>
        </div>
      </div>

      {/* Tabla Ejecutiva de Estudiantes */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {estudiantesFiltrados.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No se encontraron estudiantes con el criterio seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[430px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase z-10">
                <tr>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Asistencia</th>
                  <th className="py-3 px-4">Tareas / Exámenes</th>
                  <th className="py-3 px-4">Promedio Final</th>
                  <th className="py-3 px-4">Estado / Constancia</th>
                  <th className="py-3 px-4 text-right">Expediente 360°</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {estudiantesFiltrados.map((est) => (
                  <tr
                    key={est.id}
                    onClick={() => setSelectedStudentId(est.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">
                        {est.nombre_completo}
                      </p>
                      <p className="text-[11px] text-slate-400">{est.email}</p>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              est.asistenciaPct >=
                              grupo.asistencia_minima_porcentaje
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${est.asistenciaPct}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700">
                          {est.asistenciaPct}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {est.tareasEntregadasCount}/{tareas.length}
                      </span>{' '}
                      tareas •{' '}
                      <span className="font-semibold text-slate-800">
                        {est.examenesRespondidosCount}/{evaluaciones.length}
                      </span>{' '}
                      exám.
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          est.promedio >=
                          grupo.calificacion_minima_aprobatoria
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {est.promedio} / 100
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {est.constancia ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1B396A] border border-blue-200">
                          <Award className="w-3 h-3" /> {est.constancia.folio}
                        </span>
                      ) : est.acredita ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Acredita
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                          <AlertTriangle className="w-3 h-3" /> En riesgo
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(est.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-[11px] font-semibold shadow-xs"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        Gestionar Alumno
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DRAWER LATERAL 360° DEL ESTUDIANTE */}
      {alumnoActivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div
            className={`bg-white w-full ${
              previewEntrega ? 'max-w-5xl' : 'max-w-2xl'
            } h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200 transition-all`}
          >
            <div className="p-5 bg-[#1B396A] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  Expediente Académico Individual 360°
                </span>
                <h3 className="text-base font-bold mt-0.5">
                  {alumnoActivo.nombre_completo}
                </h3>
                <p className="text-xs text-blue-200">{alumnoActivo.email}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                  <span className="text-[10px] text-blue-200 block">
                    Promedio / Asist.
                  </span>
                  <span className="text-xs font-bold text-white">
                    {alumnoActivo.promedio} pts • {alumnoActivo.asistenciaPct}%
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleCerrarVisor();
                    setSelectedStudentId(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50 flex items-center gap-1 overflow-x-auto">
              {[
                {
                  key: 'tareas',
                  label: `Tareas y Notas (${tareas.length})`,
                  icon: FileText,
                },
                {
                  key: 'examenes',
                  label: `Exámenes (${evaluaciones.length})`,
                  icon: ClipboardList,
                },
                {
                  key: 'asistencia',
                  label: `Asistencias (${alumnoActivo.asistenciasPresentes}/${alumnoActivo.totalSesiones})`,
                  icon: Video,
                },
                {
                  key: 'constancia',
                  label: 'Constancia QR',
                  icon: Award,
                },
              ].map((t) => {
                const Icon = t.icon;
                const active = drawerTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setDrawerTab(t.key as any)}
                    className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
                      active
                        ? 'border-[#1B396A] text-[#1B396A] bg-white rounded-t-lg'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {/* 1. TAREAS CON APERTURA DE URL FIRMADA PRIVADA Y SPLIT-VIEW */}
              {drawerTab === 'tareas' &&
                (previewEntrega ? (
                  /* SPLIT-VIEW INTEGRADO: VISOR PDF/IMG A LA IZQUIERDA + CONTROLES A LA DERECHA */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {previewEntrega.tarea?.titulo || 'Visor de Entrega'}
                        </span>
                        {getUnidadBadge(previewEntrega.tarea?.unidad_id)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              previewEntrega.signedUrl,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 border border-blue-200 text-[#1B396A] hover:bg-blue-100 transition-colors shadow-2xs"
                          title="Abrir el documento original en pestaña nueva"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir documento en pestaña nueva
                        </button>
                        <button
                          type="button"
                          onClick={handleCerrarVisor}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cerrar visor
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Columna Izquierda: Visor embebido con barra superior obligatoria */}
                      <div className="lg:col-span-7 bg-white rounded-2xl overflow-hidden border border-slate-200 flex flex-col min-h-[560px]">
                        {/* Barra clara con nombre de archivo y botón destacado */}
                        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-[#1B396A] shrink-0" />
                            <span
                              className="font-semibold text-slate-800 truncate"
                              title={(previewEntrega.entrega?.archivo_entrega_url || '').split('/').pop()?.split('?')[0] || 'Archivo adjunto'}
                            >
                              {(previewEntrega.entrega?.archivo_entrega_url || '').split('/').pop()?.split('?')[0] || 'Archivo adjunto'}
                            </span>
                          </div>

                          <a
                            href={previewEntrega.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white transition-colors shadow-2xs shrink-0 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir / Descargar archivo en pestaña nueva ↗
                          </a>
                        </div>

                        {/* Contenido del Visor */}
                        <div className="flex-1 w-full bg-slate-900/5 flex items-center justify-center p-2 min-h-[520px]">
                          {loadingDoc ? (
                            <div className="text-slate-600 text-xs flex flex-col items-center gap-2 py-16">
                              <Loader2 className="w-6 h-6 animate-spin text-[#1B396A]" />
                              <span>Cargando documento para visualización...</span>
                            </div>
                          ) : previewEntrega.isImg ? (
                            <div className="w-full h-[520px] p-2 flex items-center justify-center overflow-auto">
                              <img
                                src={previewEntrega.blobUrl || previewEntrega.signedUrl}
                                alt="Entrega del alumno"
                                className="max-h-full max-w-full object-contain rounded-xl"
                              />
                            </div>
                          ) : (
                            <iframe
                              src={previewEntrega.blobUrl || previewEntrega.signedUrl}
                              className="w-full h-[520px] rounded-xl bg-white border border-slate-200"
                              title="Visor de Entrega PDF / Documento"
                            />
                          )}
                        </div>
                      </div>

                      {/* Columna Derecha: Controles de Calificación y Rúbrica */}
                      <div className="lg:col-span-5 space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Calificación Docente
                            </span>
                            <span className="text-xs font-bold text-[#1B396A]">
                              Valor: {previewEntrega.tarea?.ponderacion || 100}%
                            </span>
                          </div>

                          {/* Rúbrica Interactiva Clickeable */}
                          {previewEntrega.tarea?.rubrica &&
                            Array.isArray(previewEntrega.tarea.rubrica) &&
                            previewEntrega.tarea.rubrica.length > 0 && (
                              <div className="p-3 bg-white rounded-xl border border-blue-200/80 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1B396A] flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    Rúbrica Interactiva
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Clic para sumar
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {previewEntrega.tarea.rubrica.map((c: any) => (
                                    <button
                                      key={c.id || c.criterio}
                                      type="button"
                                      onClick={() =>
                                        handleAplicarCriterioRubrica(
                                          previewEntrega.tarea.id,
                                          c
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50/70 border border-blue-200 text-[#1B396A] hover:bg-[#1B396A] hover:text-white transition-colors"
                                    >
                                      <span className="font-bold text-emerald-600">
                                        +{c.puntos}
                                      </span>
                                      <span>{c.criterio}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Input de nota */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Nota (0 a 100)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="Ej. 95"
                              value={
                                gradeInputs[
                                  `tarea_${previewEntrega.tarea?.id}`
                                ] ??
                                (previewEntrega.entrega?.calificacion !== null &&
                                previewEntrega.entrega?.calificacion !==
                                  undefined
                                  ? String(previewEntrega.entrega.calificacion)
                                  : '')
                              }
                              onChange={(e) =>
                                setGradeInputs((prev) => ({
                                  ...prev,
                                  [`tarea_${previewEntrega.tarea.id}`]:
                                    e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 text-sm font-bold bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#1B396A]"
                            />
                          </div>

                          {/* Textarea de retroalimentación */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Retroalimentación para el alumno
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Observaciones de la entrega..."
                              value={
                                feedbackInputs[
                                  `tarea_${previewEntrega.tarea?.id}`
                                ] ??
                                (previewEntrega.entrega
                                  ?.retroalimentacion_docente || '')
                              }
                              onChange={(e) =>
                                setFeedbackInputs((prev) => ({
                                  ...prev,
                                  [`tarea_${previewEntrega.tarea.id}`]:
                                    e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#1B396A]"
                            />
                          </div>

                          {/* Desglose de retardo si aplica */}
                          {previewEntrega.entrega &&
                            Number(
                              previewEntrega.entrega.puntos_penalizados || 0
                            ) > 0 && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                                <div className="font-bold flex items-center gap-1 text-amber-800">
                                  <ClockAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  Retardo ({previewEntrega.entrega.dias_retraso}{' '}
                                  días)
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span>
                                    Base:{' '}
                                    {previewEntrega.entrega.calificacion_base} pts
                                  </span>
                                  <span className="text-red-700 font-bold">
                                    -{previewEntrega.entrega.puntos_penalizados}{' '}
                                    pts
                                  </span>
                                </div>
                              </div>
                            )}
                        </div>

                        {/* Botón Guardar */}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleGuardarNotaTarea(
                              previewEntrega.tarea.id,
                              Number(
                                previewEntrega.entrega?.calificacion ?? 100
                              )
                            )
                          }
                          className="w-full py-2.5 px-3 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm mt-3"
                        >
                          {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Guardar Calificación
                        </button>
                      </div>
                    </div>
                  </div>
                ) : tareas.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    No hay tareas registradas en este grupo.
                  </p>
                ) : (
                  tareas.map((t) => {
                    const ent = entregas.find(
                      (e) =>
                        e.tarea_id === t.id &&
                        e.estudiante_id === alumnoActivo.id
                    );
                    const currentCal =
                      gradeInputs[`tarea_${t.id}`] ??
                      (ent?.calificacion !== null &&
                      ent?.calificacion !== undefined
                        ? String(ent.calificacion)
                        : '');
                    const currentRetro =
                      feedbackInputs[`tarea_${t.id}`] ??
                      (ent?.retroalimentacion_docente || '');

                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {t.titulo}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#1B396A]">
                              Valor: {t.ponderacion}%
                            </span>
                            {getUnidadBadge(t.unidad_id)}
                          </div>

                          {ent?.archivo_entrega_url ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleAbrirArchivoSeguro(
                                  ent.archivo_entrega_url,
                                  t,
                                  ent
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#1B396A] hover:bg-blue-50 shadow-2xs"
                              title="Ver entrega en visor Split-View"
                            >
                              <Lock className="w-3 h-3 text-emerald-600" />
                              Abrir entrega segura (Split-View)
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium">
                              Sin archivo subido
                            </span>
                          )}
                        </div>

                        {/* Rúbrica Interactiva Clickeable en la tarjeta */}
                        {t.rubrica &&
                          Array.isArray(t.rubrica) &&
                          t.rubrica.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                                Rúbrica:
                              </span>
                              {t.rubrica.map((c: any) => (
                                <button
                                  key={c.id || c.criterio}
                                  type="button"
                                  onClick={() =>
                                    handleAplicarCriterioRubrica(t.id, c)
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-slate-200 text-[#1B396A] hover:bg-blue-50 transition-colors shadow-2xs"
                                >
                                  <span className="font-bold text-emerald-600">
                                    +{c.puntos}
                                  </span>
                                  <span>{c.criterio}</span>
                                </button>
                              ))}
                            </div>
                          )}

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Nota (0-100)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="Ej. 95"
                              value={currentCal}
                              onChange={(e) =>
                                setGradeInputs((prev) => ({
                                  ...prev,
                                  [`tarea_${t.id}`]: e.target.value,
                                }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-300"
                            />
                          </div>

                          <div className="sm:col-span-6">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Retroalimentación
                            </label>
                            <input
                              type="text"
                              placeholder="Observación opcional..."
                              value={currentRetro}
                              onChange={(e) =>
                                setFeedbackInputs((prev) => ({
                                  ...prev,
                                  [`tarea_${t.id}`]: e.target.value,
                                }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300"
                            />
                          </div>

                          <div className="sm:col-span-3 pt-4">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleGuardarNotaTarea(
                                  t.id,
                                  Number(ent?.calificacion ?? 100)
                                )
                              }
                              className="w-full py-1.5 px-3 rounded-lg bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center justify-center gap-1"
                            >
                              {isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              Guardar
                            </button>
                          </div>
                        </div>

                        {/* Desglose de penalización por retardo */}
                        {ent && Number(ent.puntos_penalizados || 0) > 0 && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-bold flex items-center gap-1 text-amber-800">
                              <ClockAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Retardo ({ent.dias_retraso}{' '}
                              {Number(ent.dias_retraso) === 1
                                ? 'día'
                                : 'días'}
                              )
                            </span>
                            <span>
                              Nota base: <strong>{ent.calificacion_base} pts</strong>
                            </span>
                            <span className="text-red-700">
                              Penalización:{' '}
                              <strong>-{ent.puntos_penalizados} pts</strong>
                            </span>
                            <span className="text-emerald-800 font-semibold">
                              Nota final:{' '}
                              <strong>{ent.calificacion} pts</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}

              {/* 2. EXÁMENES */}
              {drawerTab === 'examenes' &&
                (evaluaciones.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    No hay evaluaciones configuradas.
                  </p>
                ) : (
                  evaluaciones.map((ev) => {
                    const resp = respuestasEvaluaciones.find(
                      (r) =>
                        r.evaluacion_id === ev.id &&
                        r.estudiante_id === alumnoActivo.id
                    );

                    const currentExamCal =
                      resp && gradeInputs[`exam_${resp.id}`] !== undefined
                        ? gradeInputs[`exam_${resp.id}`]
                        : resp?.calificacion ?? '';

                    return (
                      <div
                        key={ev.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-slate-900">
                              {ev.titulo}
                            </p>
                            {getUnidadBadge(ev.unidad_id)}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Ponderación: {ev.ponderacion}% •{' '}
                            {resp
                              ? 'Examen respondido por el alumno'
                              : 'Sin respuesta enviada'}
                          </p>
                        </div>

                        {resp && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={currentExamCal}
                              onChange={(e) =>
                                setGradeInputs((prev) => ({
                                  ...prev,
                                  [`exam_${resp.id}`]: e.target.value,
                                }))
                              }
                              placeholder="Nota"
                              className="w-20 px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-300"
                            />
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleGuardarNotaExamen(
                                  resp.id,
                                  Number(resp.calificacion ?? 100)
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#1B396A] text-white text-xs font-semibold flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Calificar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}

              {/* 3. ASISTENCIA */}
              {drawerTab === 'asistencia' &&
                (clasesVirtuales.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">
                    No hay clases virtuales programadas.
                  </p>
                ) : (
                  clasesVirtuales.map((sesion) => {
                    const reg = asistencias.find(
                      (a) =>
                        a.clase_id === sesion.id &&
                        a.estudiante_id === alumnoActivo.id
                    );
                    const estaPresente = reg?.presente === true;

                    return (
                      <div
                        key={sesion.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-slate-900">
                              {sesion.titulo_sesion}
                            </p>
                            {getUnidadBadge(sesion.unidad_id)}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Fecha: {sesion.fecha_programada} (
                            {String(sesion.hora_inicio).slice(0, 5)})
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleCambiarAsistencia(sesion.id, true)
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                              estaPresente
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50'
                            }`}
                          >
                            Presente
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleCambiarAsistencia(sesion.id, false)
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                              reg && !estaPresente
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-red-50'
                            }`}
                          >
                            Falta
                          </button>
                        </div>
                      </div>
                    );
                  })
                ))}

              {/* 4. CONSTANCIA */}
              {drawerTab === 'constancia' && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Dictamen de Acreditación
                    </span>
                    {alumnoActivo.acredita ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        ✓ Alumno Acreditado
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        No cumple requisitos aún
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-slate-400 block">
                        Promedio Ponderado
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {alumnoActivo.promedio} / 100
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="text-slate-400 block">
                        Porcentaje de Asistencia
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {alumnoActivo.asistenciaPct}%
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!alumnoActivo.acredita || isPending}
                    onClick={() => handleEmitirDescargarConstancia(alumnoActivo)}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {alumnoActivo.constancia
                      ? `Descargar Constancia PDF (${alumnoActivo.constancia.folio})`
                      : 'Emitir y Descargar Constancia Oficial QR'}
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}