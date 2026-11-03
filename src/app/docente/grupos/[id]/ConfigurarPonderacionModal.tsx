'use client';

import React, { useState, useActionState, useEffect } from 'react';
import {
  SlidersHorizontal,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ClipboardList,
  Video,
  Check,
} from 'lucide-react';
import { guardarConfiguracionPonderacionAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';

const initialState: ActionState = { success: false, message: '' };

export default function ConfigurarPonderacionModal({
  grupoId,
  grupoConfig,
  unidades = [],
  defaultUnidadId,
}: {
  grupoId: string;
  grupoConfig?: {
    peso_tareas_pct?: number | string | null;
    peso_examenes_pct?: number | string | null;
    peso_asistencia_pct?: number | string | null;
  };
  unidades?: any[];
  defaultUnidadId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const initialTareas = Number(grupoConfig?.peso_tareas_pct ?? 50);
  const initialExamenes = Number(grupoConfig?.peso_examenes_pct ?? 40);
  const initialAsistencia = Number(grupoConfig?.peso_asistencia_pct ?? 10);

  const [selectedUnidadId, setSelectedUnidadId] = useState<string>(
    defaultUnidadId || ''
  );
  const [aplicarATodas, setAplicarATodas] = useState(true);

  const [pesoTareas, setPesoTareas] = useState(initialTareas);
  const [pesoExamenes, setPesoExamenes] = useState(initialExamenes);
  const [pesoAsistencia, setPesoAsistencia] = useState(initialAsistencia);

  const [state, formAction, isPending] = useActionState(
    guardarConfiguracionPonderacionAction,
    initialState
  );

  // Al cambiar la unidad seleccionada en el dropdown del modal, sincronizar sus pesos
  useEffect(() => {
    if (selectedUnidadId) {
      const u = unidades.find((item) => item.id === selectedUnidadId);
      if (u) {
        setPesoTareas(Number(u.peso_tareas_pct ?? initialTareas));
        setPesoExamenes(Number(u.peso_examenes_pct ?? initialExamenes));
        setPesoAsistencia(Number(u.peso_asistencia_pct ?? initialAsistencia));
        setAplicarATodas(false);
      }
    } else {
      setPesoTareas(initialTareas);
      setPesoExamenes(initialExamenes);
      setPesoAsistencia(initialAsistencia);
      setAplicarATodas(true);
    }
  }, [selectedUnidadId, unidades, initialTareas, initialExamenes, initialAsistencia]);

  const total = Number(pesoTareas) + Number(pesoExamenes) + Number(pesoAsistencia);
  const esValido = total === 100;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all hover:border-[#1B396A] cursor-pointer"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-[#1B396A]" />
        <span>Encuadre / Ponderación (100%)</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1B396A] flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Configurador Automático de Ponderación
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Modelo de Evaluación TecNM (Total reglamentario: 100%)
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

            {/* Notificaciones de estado */}
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
              {selectedUnidadId && (
                <input type="hidden" name="unidad_id" value={selectedUnidadId} />
              )}

              {/* Selector de alcance: General o Unidad Específica */}
              {unidades.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alcance del Encuadre
                  </label>
                  <select
                    value={selectedUnidadId}
                    onChange={(e) => setSelectedUnidadId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  >
                    <option value="">Encuadre General del Grupo</option>
                    {unidades.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        Unidad {u.numero_unidad}: {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Barra Tricolor en Tiempo Real */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Distribución de Calificación
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                      esValido
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Total: {total}% {esValido ? '✓' : '(Debe sumar 100%)'}
                  </span>
                </div>

                <div className="w-full h-3 rounded-full overflow-hidden bg-slate-200 flex">
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, pesoTareas))}%` }}
                    className="bg-[#1B396A] transition-all duration-200"
                    title={`Tareas: ${pesoTareas}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, pesoExamenes))}%` }}
                    className="bg-purple-600 transition-all duration-200"
                    title={`Exámenes: ${pesoExamenes}%`}
                  />
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, pesoAsistencia))}%` }}
                    className="bg-emerald-500 transition-all duration-200"
                    title={`Asistencia: ${pesoAsistencia}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                  <span className="flex items-center gap-1 text-[#1B396A] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#1B396A]" />
                    Tareas {pesoTareas}%
                  </span>
                  <span className="flex items-center gap-1 text-purple-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Exámenes {pesoExamenes}%
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Asistencia {pesoAsistencia}%
                  </span>
                </div>
              </div>

              {/* Sliders / Inputs Numéricos */}
              <div className="space-y-3">
                {/* 1. Tareas y Prácticas */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#1B396A]" />
                      % Tareas y Prácticas de Laboratorio
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        name="peso_tareas_pct"
                        min={0}
                        max={100}
                        value={pesoTareas}
                        onChange={(e) => setPesoTareas(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1B396A]"
                      />
                      <span className="text-xs font-bold text-slate-600">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={pesoTareas}
                    onChange={(e) => setPesoTareas(Number(e.target.value))}
                    className="w-full accent-[#1B396A] cursor-pointer"
                  />
                </div>

                {/* 2. Evaluaciones / Exámenes */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                      % Evaluaciones y Exámenes Escritos
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        name="peso_examenes_pct"
                        min={0}
                        max={100}
                        value={pesoExamenes}
                        onChange={(e) => setPesoExamenes(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      />
                      <span className="text-xs font-bold text-slate-600">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={pesoExamenes}
                    onChange={(e) => setPesoExamenes(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {/* 3. Asistencia */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-emerald-600" />
                      % Asistencia y Participación Sincrónica
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        name="peso_asistencia_pct"
                        min={0}
                        max={100}
                        value={pesoAsistencia}
                        onChange={(e) => setPesoAsistencia(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-600">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={pesoAsistencia}
                    onChange={(e) => setPesoAsistencia(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Checkbox aplicar a todas las unidades */}
              {!selectedUnidadId && unidades.length > 0 && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    name="aplicar_a_todas_las_unidades"
                    checked={aplicarATodas}
                    onChange={(e) => setAplicarATodas(e.target.checked)}
                    className="mt-0.5 rounded text-[#1B396A] focus:ring-[#1B396A]"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      Aplicar este encuadre a todas las Unidades del grupo
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Sincroniza automáticamente la ponderación en las {unidades.length} unidades temáticas existentes.
                    </span>
                  </div>
                </label>
              )}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={!esValido || isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Guardar Encuadre
                    </>
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

