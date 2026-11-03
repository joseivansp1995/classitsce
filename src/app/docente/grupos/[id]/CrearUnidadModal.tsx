'use client';

import React, { useState, useActionState } from 'react';
import {
  FolderPlus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { crearUnidadAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { toCapitalizedSentence } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = { success: false, message: '' };

export default function CrearUnidadModal({
  grupoId,
  siguienteNumero = 1,
}: {
  grupoId: string;
  siguienteNumero?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    crearUnidadAction,
    initialState
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold shadow-xs transition-all"
      >
        <FolderPlus className="w-4 h-4 text-amber-600" />
        Nueva Unidad
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Crear Carpeta de Unidad Temática
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Unidad
                  </label>
                  <input
                    type="number"
                    name="numero_unidad"
                    min={1}
                    max={20}
                    defaultValue={siguienteNumero}
                    required
                    className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre de la Unidad
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    required
                    placeholder="Ej. Fundamentos de Ingeniería"
                    onBlur={(e) => { e.target.value = toCapitalizedSentence(e.target.value); }}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Competencia / Objetivo de la Unidad (Opcional)
                </label>
                <textarea
                  name="descripcion"
                  rows={2}
                  placeholder="Describe la competencia específica a evaluar en esta unidad..."
                  onBlur={(e) => { e.target.value = toCapitalizedSentence(e.target.value); }}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
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
                      Creando...
                    </>
                  ) : (
                    'Crear Carpeta de Unidad'
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