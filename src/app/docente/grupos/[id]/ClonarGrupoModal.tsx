'use client';

import React, { useState, useEffect } from 'react';
import {
  CopyPlus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  clonarEstructuraGrupoAction,
  obtenerOtrosGruposDocenteAction,
} from './actions';

export default function ClonarGrupoModal({
  grupoDestinoId,
  grupoActualId,
}: {
  grupoDestinoId?: string;
  grupoActualId?: string;
}) {
  const targetId = grupoDestinoId || grupoActualId || '';
  const [isOpen, setIsOpen] = useState(false);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [otrosGrupos, setOtrosGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && targetId) {
      setLoadingGrupos(true);
      setFeedback(null);
      obtenerOtrosGruposDocenteAction(targetId).then((res) => {
        setLoadingGrupos(false);
        if (res.success && res.data) {
          setOtrosGrupos(res.data);
          if (res.data.length > 0) {
            setSelectedGrupoId(res.data[0].id);
          }
        }
      });
    }
  }, [isOpen, targetId]);

  const handleClonar = async () => {
    if (!selectedGrupoId || !targetId) return;
    setIsPending(true);
    setFeedback(null);
    try {
      const res = await clonarEstructuraGrupoAction(
        targetId,
        selectedGrupoId
      );
      setFeedback({ success: res.success, message: res.message });
      if (res.success) {
        setTimeout(() => {
          setIsOpen(false);
          window.location.reload();
        }, 1200);
      }
    } catch {
      setFeedback({
        success: false,
        message: 'Ocurrió un error inesperado al clonar la estructura.',
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
        title="Importar unidades, tareas y exámenes de otro grupo"
      >
        <CopyPlus className="w-3.5 h-3.5 text-[#1B396A]" />
        Importar de otro Grupo
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#1B396A]">
                  <CopyPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Importar Estructura desde otro Grupo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Reutiliza unidades temáticas, tareas y exámenes de materias anteriores.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notificaciones */}
            {feedback && (
              <div
                className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  feedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {feedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <div className="space-y-4 mt-4">
              {loadingGrupos ? (
                <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1B396A]" />
                  <span>Consultando tus grupos disponibles...</span>
                </div>
              ) : otrosGrupos.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No hay otros grupos registrados</p>
                  <p className="mt-1">
                    Crea primero otro grupo con contenido o diseña las unidades manualmente en este curso.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Selecciona el Grupo de Origen (Plantilla):
                    </label>
                    <select
                      value={selectedGrupoId}
                      onChange={(e) => setSelectedGrupoId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                    >
                      {otrosGrupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre} ({g.clave_materia || 'S/C'} • {g.periodo || 'Periodo'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Resumen de lo que se clonará */}
                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2 text-xs text-slate-700">
                    <span className="font-bold text-[#1B396A] flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                      <Layers className="w-3.5 h-3.5" /> ¿Qué elementos se clonarán?
                    </span>
                    <ul className="space-y-1.5 text-[11px] text-slate-600 pl-1">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span><strong>Unidades Temáticas:</strong> Nombres, descripciones y % de encuadre.</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span><strong>Tareas:</strong> Criterios de rúbrica, guías adjuntas y fechas ajustadas a <strong>+7 días</strong>.</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span><strong>Evaluaciones:</strong> Preguntas de opción múltiple y fechas renovadas.</span>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                {otrosGrupos.length > 0 && (
                  <button
                    type="button"
                    disabled={isPending || !selectedGrupoId}
                    onClick={handleClonar}
                    className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Importando estructura...
                      </>
                    ) : (
                      <>
                        <span>Importar al Grupo</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
