'use client';

import React, { useState, useActionState } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { responderEvaluacionAction } from '../../actions';
import type { ActionState } from '@/app/(auth)/actions';

const initialState: ActionState = { success: false, message: '' };

export default function ResolverEvaluacionModal({
  grupoId,
  evaluacion,
  respuestaExistente,
}: {
  grupoId: string;
  evaluacion: any;
  respuestaExistente: any | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const preguntas = evaluacion.preguntas || [];
  const [respuestas, setRespuestas] = useState<number[]>(
    Array(preguntas.length).fill(-1)
  );

  const [state, formAction, isPending] = useActionState(
    responderEvaluacionAction,
    initialState
  );

  if (respuestaExistente) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {respuestaExistente.calificacion !== null
          ? `Calificación: ${respuestaExistente.calificacion}/100`
          : 'Enviada (En revisión docente)'}
      </span>
    );
  }

  const todasRespondidas = respuestas.every((r) => r >= 0);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3.5 py-1.5 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm"
      >
        Presentar Evaluación
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  {evaluacion.titulo}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {state?.message && (
              <div
                className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  state.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {state.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{state.message}</span>
              </div>
            )}

            <form action={formAction} className="space-y-4 mt-4">
              <input type="hidden" name="evaluacion_id" value={evaluacion.id} />
              <input type="hidden" name="grupo_id" value={grupoId} />
              <input
                type="hidden"
                name="respuestas_json"
                value={JSON.stringify(respuestas)}
              />

              <div className="space-y-4">
                {preguntas.map((q: any, qIdx: number) => (
                  <div
                    key={q.id || qIdx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <p className="text-xs font-bold text-slate-900">
                      {qIdx + 1}. {q.pregunta}
                    </p>
                    <div className="space-y-1.5">
                      {(q.opciones || []).map((opt: string, optIdx: number) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-white"
                        >
                          <input
                            type="radio"
                            name={`pregunta_${qIdx}`}
                            checked={respuestas[qIdx] === optIdx}
                            onChange={() =>
                              setRespuestas((prev) =>
                                prev.map((val, i) =>
                                  i === qIdx ? optIdx : val
                                )
                              )
                            }
                            className="accent-[#1B396A]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!todasRespondidas || isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando respuestas...
                    </>
                  ) : (
                    'Terminar y Enviar Evaluación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}