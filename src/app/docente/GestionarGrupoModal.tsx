'use client';

import React, { useState, useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Save,
  BookOpen,
} from 'lucide-react';
import { editarGrupoAction, eliminarGrupoAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { toTitleCase, toNormalizedCode } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = { success: false, message: '' };

interface GestionarGrupoModalProps {
  grupo: {
    id: string;
    nombre: string;
    clave_materia: string;
    periodo: string;
    calificacion_minima_aprobatoria?: number | string | null;
    asistencia_minima_porcentaje?: number | string | null;
    [key: string]: any;
  };
  enDetalleGrupo?: boolean;
}

export default function GestionarGrupoModal({
  grupo,
  enDetalleGrupo = false,
}: GestionarGrupoModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(
    editarGrupoAction,
    initialState
  );

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmDelete(false);
    setDeleteError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setConfirmDelete(false);
    setDeleteError(null);
  };

  const handleEliminar = () => {
    startDeleteTransition(async () => {
      try {
        const res = await eliminarGrupoAction(grupo.id);
        if (res.success) {
          setIsOpen(false);
          setConfirmDelete(false);
          if (enDetalleGrupo) {
            router.push('/docente');
          } else {
            router.refresh();
          }
        } else {
          setDeleteError(res.message);
        }
      } catch {
        setDeleteError('Ocurrió un error al eliminar el grupo.');
      }
    });
  };

  return (
    <>
      {enDetalleGrupo ? (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 text-slate-600 hover:text-[#1B396A] hover:bg-slate-50 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          title="Configuración y ajustes del grupo"
        >
          <Settings className="w-3.5 h-3.5 text-slate-500" />
          <span>Ajustes del Grupo</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Editar o eliminar grupo"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#1B396A]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Ajustes de la Asignatura
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {grupo.clave_materia} • {grupo.periodo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensajes de feedback */}
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

            {deleteError && (
              <div className="mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Formulario de edición */}
            <form action={formAction} className="space-y-3.5 mt-4">
              <input type="hidden" name="grupo_id" value={grupo.id} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Asignatura
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  defaultValue={grupo.nombre}
                  onBlur={(e) => { e.target.value = toTitleCase(e.target.value); }}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clave Oficial
                  </label>
                  <input
                    type="text"
                    name="clave_materia"
                    required
                    defaultValue={grupo.clave_materia}
                    onBlur={(e) => { e.target.value = toNormalizedCode(e.target.value); }}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
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
                    defaultValue={grupo.periodo}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Calificación Mínima (pts)
                  </label>
                  <input
                    type="number"
                    name="calificacion_minima_aprobatoria"
                    min={0}
                    max={100}
                    defaultValue={grupo.calificacion_minima_aprobatoria ?? 70}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Asistencia Mínima (%)
                  </label>
                  <input
                    type="number"
                    name="asistencia_minima_porcentaje"
                    min={0}
                    max={100}
                    defaultValue={grupo.asistencia_minima_porcentaje ?? 80}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar Cambios
                </button>
              </div>
            </form>

            {/* Zona de peligro: Eliminar grupo */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Zona de Peligro: Eliminar Grupo</span>
                </div>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  Esta acción eliminará de forma irreversible el grupo académico, sus unidades,
                  tareas, exámenes y calificaciones de alumnos.
                </p>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-300 bg-white hover:bg-red-100/50 text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    Eliminar este Grupo
                  </button>
                ) : (
                  <div className="p-3 rounded-lg bg-white border border-red-300 space-y-2">
                    <p className="text-xs font-bold text-red-900">
                      ¿Confirmas que deseas eliminar permanentemente este grupo?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(false);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminar();
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Eliminando...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            Sí, eliminar definitivamente
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

