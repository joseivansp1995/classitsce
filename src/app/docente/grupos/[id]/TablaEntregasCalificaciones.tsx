'use client';

import React, { useState, useActionState } from 'react';
import {
  ArrowUpDown,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck,
  X,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { calificarEntregaAction, calificarEvaluacionAction, obtenerUrlFirmadaEntregaAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';

const initialState: ActionState = { success: false, message: '' };

export default function TablaEntregasCalificaciones({
  grupoId,
  entregas,
  respuestasEvaluaciones,
}: {
  grupoId: string;
  entregas: any[];
  respuestasEvaluaciones: any[];
}) {
  const [sortBy, setSortBy] = useState<'alumno' | 'calificacion' | 'estado'>(
    'alumno'
  );
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedEntrega, setSelectedEntrega] = useState<any | null>(null);
  const [selectedRespuestaExam, setSelectedRespuestaExam] = useState<any | null>(
    null
  );
  const [previewData, setPreviewData] = useState<{
    signedUrl: string;
    blobUrl: string;
    isPdf: boolean;
    isImg: boolean;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleCerrarEntrega = () => {
    if (previewData?.blobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewData.blobUrl);
    }
    setSelectedEntrega(null);
    setPreviewData(null);
  };

  const handleOpenEntrega = async (ent: any) => {
    setSelectedEntrega(ent);
    if (previewData?.blobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewData.blobUrl);
    }
    setPreviewData(null);

    if (ent.archivo_entrega_url) {
      setLoadingPreview(true);
      const cleanPath = (ent.archivo_entrega_url || '').split('?')[0].toLowerCase();
      const isPdf = /\.pdf$/i.test(cleanPath);
      const isImg = /\.(png|jpg|jpeg|webp|gif)$/i.test(cleanPath);

      const res = await obtenerUrlFirmadaEntregaAction(ent.archivo_entrega_url);
      const effectiveSignedUrl = (res.success && res.signedUrl) ? res.signedUrl : ent.archivo_entrega_url;
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
        } catch (e) {
          console.warn('Fallback a signedUrl', e);
        }
      }

      setPreviewData({
        signedUrl: effectiveSignedUrl,
        blobUrl,
        isPdf,
        isImg,
      });
      setLoadingPreview(false);
    }
  };

  const [stateTarea, formActionTarea, isPendingTarea] = useActionState(
    calificarEntregaAction,
    initialState
  );

  const [stateExam, formActionExam, isPendingExam] = useActionState(
    calificarEvaluacionAction,
    initialState
  );

  const handleSort = (field: 'alumno' | 'calificacion' | 'estado') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  const sortedEntregas = [...entregas].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortBy === 'alumno') {
      return (
        (a.profiles?.nombre_completo || '').localeCompare(
          b.profiles?.nombre_completo || ''
        ) * dir
      );
    }
    if (sortBy === 'calificacion') {
      return ((a.calificacion ?? -1) - (b.calificacion ?? -1)) * dir;
    }
    return (a.estado || '').localeCompare(b.estado || '') * dir;
  });

  // Calcular puntaje sugerido automático para un examen enviado
  const calcularPuntajeSugerido = (resp: any) => {
    const preguntas = resp.evaluaciones?.preguntas || [];
    const respuestasAlumno = resp.respuestas || [];
    if (!preguntas.length) return 0;

    let aciertos = 0;
    preguntas.forEach((q: any, idx: number) => {
      if (Number(respuestasAlumno[idx]) === Number(q.respuesta_correcta)) {
        aciertos++;
      }
    });
    return Math.round((aciertos / preguntas.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* 1. TABLA ORDENABLE DE ENTREGAS DE TAREAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Entregas de Tareas Recibidas ({entregas.length})
            </h3>
            <p className="text-xs text-slate-500">
              Haz clic en los encabezados para ordenar o en &ldquo;Calificar&rdquo; para
              asentar nota con tu firma docente.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-[#1B396A] border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Candado Ético Docente Activo
          </span>
        </div>

        {sortedEntregas.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Aún no hay entregas de tareas registradas por los estudiantes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th
                    onClick={() => handleSort('alumno')}
                    className="py-3 px-4 cursor-pointer hover:text-[#1B396A]"
                  >
                    <span className="inline-flex items-center gap-1">
                      Estudiante <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-3 px-4">Tarea</th>
                  <th className="py-3 px-4">Archivo Entregado</th>
                  <th
                    onClick={() => handleSort('estado')}
                    className="py-3 px-4 cursor-pointer hover:text-[#1B396A]"
                  >
                    <span className="inline-flex items-center gap-1">
                      Estado <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('calificacion')}
                    className="py-3 px-4 cursor-pointer hover:text-[#1B396A]"
                  >
                    <span className="inline-flex items-center gap-1">
                      Calificación <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {sortedEntregas.map((ent) => (
                  <tr key={ent.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {ent.profiles?.nombre_completo}
                      <div className="text-[11px] text-slate-400 font-normal">
                        {ent.profiles?.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {ent.tareas?.titulo}
                    </td>
                    <td className="py-3.5 px-4">
                      {ent.archivo_entrega_url ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEntrega(ent)}
                          className="inline-flex items-center gap-1 text-[#1B396A] font-semibold hover:underline text-xs"
                        >
                          Ver entrega (Split-View) <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-slate-400">Sin adjunto</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {ent.estado === 'calificado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Calificado
                        </span>
                      ) : ent.estado === 'tardio' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          <Clock className="w-3 h-3" /> Entrega Tardía
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Por Calificar
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {ent.calificacion !== null
                        ? `${ent.calificacion} / 100`
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEntrega(ent)}
                        className="px-3 py-1.5 rounded-lg bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-xs"
                      >
                        {ent.calificacion !== null ? 'Editar Nota' : 'Calificar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. TABLA DE EVALUACIONES RESPONDIDAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-900">
            Exámenes / Evaluaciones Recibidas ({respuestasEvaluaciones.length})
          </h3>
          <p className="text-xs text-slate-500">
            Revisa el puntaje automático sugerido y asienta la calificación
            oficial en el acta del grupo.
          </p>
        </div>

        {respuestasEvaluaciones.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Ningún estudiante ha enviado respuestas de evaluación todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Evaluación</th>
                  <th className="py-3 px-4">Puntaje Automático</th>
                  <th className="py-3 px-4">Calificación Oficial</th>
                  <th className="py-3 px-4 text-right">Acción Docente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {respuestasEvaluaciones.map((resp) => {
                  const sugerido = calcularPuntajeSugerido(resp);
                  return (
                    <tr key={resp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {resp.profiles?.nombre_completo}
                      </td>
                      <td className="py-3 px-4">{resp.evaluaciones?.titulo}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1B396A] font-semibold">
                          Sugerido: {sugerido} / 100
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {resp.calificacion !== null ? (
                          <span className="text-emerald-700">
                            {resp.calificacion} / 100
                          </span>
                        ) : (
                          <span className="text-amber-600">
                            Pendiente de firma
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            setSelectedRespuestaExam({
                              ...resp,
                              sugerido,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold"
                        >
                          {resp.calificacion !== null
                            ? 'Modificar'
                            : 'Validar y Calificar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CON VISOR INTEGRADO SPLIT-VIEW PARA CALIFICAR ENTREGA DE TAREA */}
      {selectedEntrega && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl ${
              selectedEntrega.archivo_entrega_url ? 'max-w-5xl' : 'max-w-md'
            } w-full p-6 shadow-2xl border border-slate-200 transition-all`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Calificar Entrega de Tarea
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {previewData && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        previewData.signedUrl,
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
                )}
                <button
                  onClick={handleCerrarEntrega}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selectedEntrega.archivo_entrega_url ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4">
                {/* Columna Izquierda: Visor embebido con barra superior obligatoria */}
                <div className="lg:col-span-7 bg-white rounded-2xl overflow-hidden border border-slate-200 flex flex-col min-h-[560px]">
                  {/* Barra clara con nombre de archivo y botón destacado */}
                  <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#1B396A] shrink-0" />
                      <span
                        className="font-semibold text-slate-800 truncate"
                        title={selectedEntrega.archivo_entrega_url.split('/').pop()?.split('?')[0] || 'Archivo adjunto'}
                      >
                        {selectedEntrega.archivo_entrega_url.split('/').pop()?.split('?')[0] || 'Archivo adjunto'}
                      </span>
                    </div>

                    <a
                      href={previewData?.signedUrl || selectedEntrega.archivo_entrega_url}
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
                    {loadingPreview ? (
                      <div className="text-slate-600 text-xs flex flex-col items-center gap-2 py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-[#1B396A]" />
                        <span>Cargando documento para visualización...</span>
                      </div>
                    ) : previewData?.isImg ? (
                      <div className="w-full h-[520px] p-2 flex items-center justify-center overflow-auto">
                        <img
                          src={previewData.blobUrl || previewData.signedUrl}
                          alt="Entrega del alumno"
                          className="max-h-full max-w-full object-contain rounded-xl"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={previewData?.blobUrl || previewData?.signedUrl || selectedEntrega.archivo_entrega_url}
                        className="w-full h-[520px] rounded-xl bg-white border border-slate-200"
                        title="Visor de Entrega PDF / Documento"
                      />
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Formulario de calificación */}
                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p>
                        <strong>Alumno:</strong>{' '}
                        {selectedEntrega.profiles?.nombre_completo}
                      </p>
                      <p>
                        <strong>Tarea:</strong> {selectedEntrega.tareas?.titulo}
                      </p>
                      {selectedEntrega.comentario_estudiante && (
                        <p className="text-slate-600 italic mt-1">
                          &ldquo;{selectedEntrega.comentario_estudiante}&rdquo;
                        </p>
                      )}
                    </div>

                    {stateTarea?.message && (
                      <div
                        className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                          stateTarea.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {stateTarea.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{stateTarea.message}</span>
                      </div>
                    )}

                    <form action={formActionTarea} className="space-y-3.5">
                      <input
                        type="hidden"
                        name="entrega_id"
                        value={selectedEntrega.id}
                      />
                      <input type="hidden" name="grupo_id" value={grupoId} />

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Calificación (0 - 100)
                        </label>
                        <input
                          type="number"
                          name="calificacion"
                          defaultValue={selectedEntrega.calificacion ?? 100}
                          min={0}
                          max={100}
                          step="0.01"
                          required
                          className="w-full px-3.5 py-2 text-sm font-bold rounded-xl border border-slate-300"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Retroalimentación para el Estudiante
                        </label>
                        <textarea
                          name="retroalimentacion_docente"
                          rows={4}
                          defaultValue={
                            selectedEntrega.retroalimentacion_docente || ''
                          }
                          placeholder="Escribe observaciones sobre su entrega..."
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleCerrarEntrega}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cerrar
                        </button>
                        <button
                          type="submit"
                          disabled={isPendingTarea}
                          className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          {isPendingTarea ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Firmando...
                            </>
                          ) : (
                            'Guardar Calificación'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p>
                    <strong>Alumno:</strong>{' '}
                    {selectedEntrega.profiles?.nombre_completo}
                  </p>
                  <p>
                    <strong>Tarea:</strong> {selectedEntrega.tareas?.titulo}
                  </p>
                  {selectedEntrega.comentario_estudiante && (
                    <p className="text-slate-600 italic mt-1">
                      &ldquo;{selectedEntrega.comentario_estudiante}&rdquo;
                    </p>
                  )}
                </div>

                {stateTarea?.message && (
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                      stateTarea.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {stateTarea.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{stateTarea.message}</span>
                  </div>
                )}

                <form action={formActionTarea} className="space-y-4">
                  <input
                    type="hidden"
                    name="entrega_id"
                    value={selectedEntrega.id}
                  />
                  <input type="hidden" name="grupo_id" value={grupoId} />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Calificación (0 - 100)
                    </label>
                    <input
                      type="number"
                      name="calificacion"
                      defaultValue={selectedEntrega.calificacion ?? 100}
                      min={0}
                      max={100}
                      step="0.01"
                      required
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Retroalimentación para el Estudiante
                    </label>
                    <textarea
                      name="retroalimentacion_docente"
                      rows={3}
                      defaultValue={
                        selectedEntrega.retroalimentacion_docente || ''
                      }
                      placeholder="Escribe observaciones sobre su entrega..."
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEntrega(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={isPendingTarea}
                      className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      {isPendingTarea ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Firmando...
                        </>
                      ) : (
                        'Guardar Calificación'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA VALIDAR Y CALIFICAR EXAMEN */}
      {selectedRespuestaExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Asentar Calificación de Evaluación
              </h3>
              <button
                onClick={() => setSelectedRespuestaExam(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1">
              <p>
                <strong>Estudiante:</strong>{' '}
                {selectedRespuestaExam.profiles?.nombre_completo}
              </p>
              <p>
                <strong>Puntaje calculado por aciertos:</strong>{' '}
                <span className="font-bold text-[#1B396A]">
                  {selectedRespuestaExam.sugerido} / 100
                </span>
              </p>
            </div>

            {stateExam?.message && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs font-medium ${
                  stateExam.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {stateExam.message}
              </div>
            )}

            <form action={formActionExam} className="space-y-4 mt-4">
              <input
                type="hidden"
                name="respuesta_id"
                value={selectedRespuestaExam.id}
              />
              <input type="hidden" name="grupo_id" value={grupoId} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Calificación Oficial a Asentar (0 - 100)
                </label>
                <input
                  type="number"
                  name="calificacion"
                  defaultValue={
                    selectedRespuestaExam.calificacion ??
                    selectedRespuestaExam.sugerido
                  }
                  min={0}
                  max={100}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones del Docente
                </label>
                <textarea
                  name="retroalimentacion_docente"
                  rows={2}
                  defaultValue={
                    selectedRespuestaExam.retroalimentacion_docente || ''
                  }
                  placeholder="Retroalimentación opcional..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRespuestaExam(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPendingExam}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold"
                >
                  {isPendingExam ? 'Guardando...' : 'Confirmar Calificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}