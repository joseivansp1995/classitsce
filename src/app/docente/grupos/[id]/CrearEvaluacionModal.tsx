'use client';

import React, { useState, useActionState } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { crearEvaluacionAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';

const initialState: ActionState = { success: false, message: '' };

interface Reactivo {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
}

export default function CrearEvaluacionModal({
  grupoId,
  unidades = [],
  defaultUnidadId = '',
}: {
  grupoId: string;
  unidades?: any[];
  defaultUnidadId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [preguntas, setPreguntas] = useState<Reactivo[]>([
    {
      id: 'q1',
      pregunta: '',
      opciones: ['', '', ''],
      respuesta_correcta: 0,
    },
  ]);

  const [state, formAction, isPending] = useActionState(
    crearEvaluacionAction,
    initialState
  );

  const agregarPregunta = () => {
    setPreguntas((prev) => [
      ...prev,
      {
        id: `q${Date.now()}`,
        pregunta: '',
        opciones: ['', '', ''],
        respuesta_correcta: 0,
      },
    ]);
  };

  const eliminarPregunta = (index: number) => {
    if (preguntas.length <= 1) return;
    setPreguntas((prev) => prev.filter((_, i) => i !== index));
  };

  const actualizarPregunta = (index: number, texto: string) => {
    setPreguntas((prev) =>
      prev.map((q, i) => (i === index ? { ...q, pregunta: texto } : q))
    );
  };

  const actualizarOpcion = (qIndex: number, optIndex: number, texto: string) => {
    setPreguntas((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              opciones: q.opciones.map((o, j) => (j === optIndex ? texto : o)),
            }
          : q
      )
    );
  };

  const cambiarRespuestaCorrecta = (qIndex: number, optIndex: number) => {
    setPreguntas((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, respuesta_correcta: optIndex } : q
      )
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#1B396A] border border-slate-300 text-xs font-semibold shadow-xs transition-all"
      >
        <ClipboardList className="w-4 h-4" />
        Crear Evaluación
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Constructor de Evaluación por Unidad
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
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
              <input type="hidden" name="grupo_id" value={grupoId} />
              <input
                type="hidden"
                name="preguntas_json"
                value={JSON.stringify(preguntas)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Carpeta de Unidad
                  </label>
                  <select
                    name="unidad_id"
                    defaultValue={defaultUnidadId}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50"
                  >
                    <option value="">General (Sin unidad)</option>
                    {unidades.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        Unidad {u.numero_unidad}: {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Título de la Evaluación
                  </label>
                  <input
                    type="text"
                    name="titulo"
                    required
                    placeholder="Ej. Examen Unidad 1"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Ponderación (%)
                    </label>
                    <span className="text-[10px] text-slate-400">Opcional</span>
                  </div>
                  <input
                    type="number"
                    name="ponderacion"
                    defaultValue={100}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    El valor final se calcula automáticamente según el Encuadre de la Unidad.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apertura del Examen
                  </label>
                  <input
                    type="datetime-local"
                    name="fecha_inicio"
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cierre del Examen
                  </label>
                  <input
                    type="datetime-local"
                    name="fecha_cierre"
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Reactivos de Opción Múltiple ({preguntas.length})
                  </span>
                  <button
                    type="button"
                    onClick={agregarPregunta}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B396A] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir Reactivo
                  </button>
                </div>

                {preguntas.map((q, qIndex) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#1B396A]">
                        Pregunta #{qIndex + 1}
                      </span>
                      {preguntas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarPregunta(qIndex)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={q.pregunta}
                      onChange={(e) =>
                        actualizarPregunta(qIndex, e.target.value)
                      }
                      required
                      placeholder="Escribe el enunciado de la pregunta..."
                      className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300"
                    />

                    <div className="space-y-1.5 pt-1">
                      {q.opciones.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct_${q.id}`}
                            checked={q.respuesta_correcta === optIndex}
                            onChange={() =>
                              cambiarRespuestaCorrecta(qIndex, optIndex)
                            }
                            className="accent-[#1B396A]"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              actualizarOpcion(qIndex, optIndex, e.target.value)
                            }
                            required
                            placeholder={`Opción ${optIndex + 1}`}
                            className="w-full px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300"
                          />
                        </div>
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
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPending ? 'Guardando...' : 'Publicar Evaluación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}