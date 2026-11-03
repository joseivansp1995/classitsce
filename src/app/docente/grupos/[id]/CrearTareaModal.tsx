'use client';

import React, { useState, useActionState } from 'react';
import {
  FilePlus2,
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ClockAlert,
  Sparkles,
  Plus,
} from 'lucide-react';
import { crearTareaAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { validateUploadedFile, toCapitalizedSentence } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = { success: false, message: '' };

export default function CrearTareaModal({
  grupoId,
  unidades = [],
  defaultUnidadId = '',
}: {
  grupoId: string;
  unidades?: any[];
  defaultUnidadId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validation = validateUploadedFile(file, { maxSizeMB: 15 });
    if (!validation.valid) {
      setFileError(validation.error || 'Archivo no permitido (máx. 15 MB).');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };
  const [state, formAction, isPending] = useActionState(
    crearTareaAction,
    initialState
  );

  interface CriterioRubrica {
    id: string;
    criterio: string;
    puntos: number;
  }
  const [criterios, setCriterios] = useState<CriterioRubrica[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevosPuntos, setNuevosPuntos] = useState<number>(20);

  const handleGenerarEstandar = () => {
    setCriterios([
      { id: 'crit-1', criterio: 'Estructura y Formato', puntos: 20 },
      { id: 'crit-2', criterio: 'Contenido y Desarrollo', puntos: 50 },
      { id: 'crit-3', criterio: 'Conclusiones y Referencias', puntos: 30 },
    ]);
  };

  const handleAgregarCriterio = () => {
    if (!nuevoNombre.trim() || nuevosPuntos <= 0) return;
    setCriterios((prev) => [
      ...prev,
      {
        id: `crit-${Date.now()}`,
        criterio: nuevoNombre.trim(),
        puntos: Number(nuevosPuntos),
      },
    ]);
    setNuevoNombre('');
  };

  const handleEliminarCriterio = (id: string) => {
    setCriterios((prev) => prev.filter((c) => c.id !== id));
  };

  const sumaPuntosRubrica = criterios.reduce(
    (acc, c) => acc + Number(c.puntos || 0),
    0
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm transition-all"
      >
        <FilePlus2 className="w-4 h-4" />
        Nueva Tarea
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Asignar Nueva Tarea por Unidad
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

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Carpeta de Unidad
                  </label>
                  <select
                    name="unidad_id"
                    defaultValue={defaultUnidadId}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  >
                    <option value="">General (Sin unidad)</option>
                    {unidades.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        Unidad {u.numero_unidad}: {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-7">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Título de la Tarea
                  </label>
                  <input
                    type="text"
                    name="titulo"
                    required
                    placeholder="Ej. Práctica 1: Modelo Relacional"
                    onBlur={(e) => { e.target.value = toCapitalizedSentence(e.target.value); }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instrucciones y Criterios de Evaluación
                </label>
                <textarea
                  name="descripcion"
                  rows={2}
                  required
                  placeholder="Describe los entregables y rúbrica..."
                  onBlur={(e) => { e.target.value = toCapitalizedSentence(e.target.value); }}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Ponderación base (%)
                    </label>
                    <span className="text-[10px] text-slate-400">Opcional</span>
                  </div>
                  <input
                    type="number"
                    name="ponderacion"
                    defaultValue={100}
                    min={1}
                    max={100}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    El valor final se calcula automáticamente según el Encuadre de la Unidad.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha y Hora Límite
                  </label>
                  <input
                    type="datetime-local"
                    name="fecha_limite"
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              {/* Regla de Penalización Automática por Retardo */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                  <ClockAlert className="w-4 h-4 text-amber-600" />
                  <span>Penalización Automática por Entrega con Retardo</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-amber-900 mb-1">
                      Puntos menos por día tarde
                    </label>
                    <input
                      type="number"
                      name="penalizacion_diaria_pct"
                      defaultValue={10}
                      min={0}
                      max={100}
                      className="w-full px-3 py-1.5 text-xs font-bold bg-white rounded-lg border border-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-amber-900 mb-1">
                      Descuento máximo tope (pts)
                    </label>
                    <input
                      type="number"
                      name="penalizacion_maxima_pct"
                      defaultValue={30}
                      min={0}
                      max={100}
                      className="w-full px-3 py-1.5 text-xs font-bold bg-white rounded-lg border border-amber-300"
                    />
                  </div>
                </div>
              </div>

              {/* Constructor de Rúbrica Rápida */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Sparkles className="w-4 h-4 text-[#1B396A]" />
                    <span>Rúbrica de Evaluación Interactiva (100 pts)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerarEstandar}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B396A] hover:underline"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Generar 20/50/30 en 1 clic
                  </button>
                </div>

                {criterios.length > 0 ? (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      {criterios.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {c.criterio}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 text-[#1B396A]">
                              +{c.puntos} pts
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEliminarCriterio(c.id)}
                              className="text-slate-400 hover:text-red-500 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-medium">
                        Suma de la rúbrica:
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          sumaPuntosRubrica === 100
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {sumaPuntosRubrica} / 100 pts
                        {sumaPuntosRubrica !== 100 && ' (Debe sumar 100)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Opcional. Al configurar una rúbrica, podrás calificar con 1 clic desde el Directorio 360°.
                  </p>
                )}

                {/* Agregar criterio manual */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Nuevo criterio (ej. Ortografía)..."
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="Pts"
                    value={nuevosPuntos}
                    onChange={(e) => setNuevosPuntos(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 text-xs font-bold text-center bg-white rounded-lg border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleAgregarCriterio}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir
                  </button>
                </div>

                <input
                  type="hidden"
                  name="rubrica_json"
                  value={criterios.length > 0 ? JSON.stringify(criterios) : ''}
                />
              </div>

              {/* Zona Drag & Drop para Archivo Guía */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Archivo Guía / Rúbrica Opcional
                </label>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#1B396A] bg-blue-50/60'
                      : 'border-slate-300 hover:border-[#1B396A] bg-slate-50/60'
                  }`}
                >
                  <UploadCloud className="w-5 h-5 text-[#1B396A] mb-1" />
                  {selectedFile ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {selectedFile.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-slate-600">
                        Arrastra tu archivo guía o haz clic para explorar
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        PDF, Word, PPT, ZIP o Imagen (Máx. 15 MB)
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    name="archivo_guia"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.webp"
                    onChange={(e) =>
                      handleFileChange(e.target.files?.[0] || null)
                    }
                    className="hidden"
                  />
                </label>
                {fileError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {fileError}
                  </p>
                )}
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
                      Publicando...
                    </>
                  ) : (
                    'Publicar Tarea'
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