'use client';

import React, { useState, useActionState } from 'react';
import {
  Plus,
  BookOpen,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { crearGrupoAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { toTitleCase, toNormalizedCode } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = {
  success: false,
  message: '',
};

export default function CrearGrupoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    crearGrupoAction,
    initialState
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm transition-all"
      >
        <Plus className="w-4 h-4" />
        Crear Nuevo Grupo
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Nuevo Grupo Académico
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Asignatura / Curso
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  placeholder="Ej. Ingeniería de Software / Estructura de Datos"
                  onBlur={(e) => { e.target.value = toTitleCase(e.target.value); }}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clave de Materia
                  </label>
                  <input
                    type="text"
                    name="clave_materia"
                    required
                    placeholder="Ej. SCD-1011 - 5A"
                    onBlur={(e) => { e.target.value = toNormalizedCode(e.target.value); }}
                    className="w-full px-3.5 py-2 text-sm uppercase rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periodo Escolar
                  </label>
                  <input
                    type="text"
                    name="periodo"
                    required
                    defaultValue="Ago - Dic 2026"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Reglas de Acreditación (Para Expedición de Constancia)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Calificación Mínima (0 - 100)
                    </label>
                    <input
                      type="number"
                      name="calificacion_minima_aprobatoria"
                      defaultValue={70}
                      min={0}
                      max={100}
                      required
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Asistencia Mínima (%)
                    </label>
                    <input
                      type="number"
                      name="asistencia_minima_porcentaje"
                      defaultValue={80}
                      min={0}
                      max={100}
                      required
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Crear Grupo'
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