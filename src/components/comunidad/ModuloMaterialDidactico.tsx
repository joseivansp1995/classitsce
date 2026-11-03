'use client';

import React, { useState, useActionState, useTransition } from 'react';
import {
  FolderOpen,
  UploadCloud,
  FileText,
  ExternalLink,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Code2,
  Presentation,
} from 'lucide-react';
import {
  subirMaterialDidacticoAction,
  eliminarMaterialDidacticoAction,
} from '@/app/actions/comunidad';
import type { ActionState } from '@/app/(auth)/actions';
import { validateUploadedFile } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = { success: false, message: '' };

const TIPO_BADGE: Record<
  string,
  { label: string; classes: string; icon: React.ElementType }
> = {
  guia: {
    label: 'Guía / Apunte',
    classes: 'bg-blue-50 text-[#1B396A] border-blue-200',
    icon: FileText,
  },
  presentacion: {
    label: 'Diapositivas',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Presentation,
  },
  codigo: {
    label: 'Ejemplo / ZIP',
    classes: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Code2,
  },
  lectura: {
    label: 'Lectura / Libro',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: BookOpen,
  },
};

export default function ModuloMaterialDidactico({
  grupoId,
  currentUserId,
  esDocenteTitular,
  materiales,
}: {
  grupoId: string;
  currentUserId: string;
  esDocenteTitular: boolean;
  materiales: any[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
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
  const [isDeleting, startDeleteTransition] = useTransition();

  const [state, formAction, isPending] = useActionState(
    subirMaterialDidacticoAction,
    initialState
  );

  const materialesFiltrados =
    filtroTipo === 'todos'
      ? materiales
      : materiales.filter((m) => m.tipo_recurso === filtroTipo);

  const handleDelete = (materialId: string) => {
    startDeleteTransition(async () => {
      await eliminarMaterialDidacticoAction(materialId, grupoId);
    });
  };

  return (
    <div
      id="material"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Encabezado y Controles */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#1B396A]" />
            <h2 className="font-bold text-sm text-slate-900">
              Repositorio de Material Didáctico ({materiales.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Espacio colaborativo: el docente y los estudiantes pueden compartir
            guías, diapositivas y recursos de estudio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
          >
            <option value="todos">Todos los recursos</option>
            <option value="guia">Guías y Apuntes</option>
            <option value="presentacion">Presentaciones</option>
            <option value="codigo">Código / Prácticas</option>
            <option value="lectura">Lecturas y Artículos</option>
          </select>

          <button
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Aportar Material
          </button>
        </div>
      </div>

      {/* Lista de Materiales */}
      {materialesFiltrados.length === 0 ? (
        <div className="p-10 text-center">
          <FolderOpen className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">
            No hay recursos didácticos en esta categoría todavía
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Haz clic en &ldquo;Aportar Material&rdquo; para subir la primera guía o
            archivo de apoyo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
          {materialesFiltrados.map((item) => {
            const cfg = TIPO_BADGE[item.tipo_recurso] || TIPO_BADGE.guia;
            const Icon = cfg.icon;
            const esAutor = item.autor_id === currentUserId;
            const puedeEliminar = esAutor || esDocenteTitular;
            const rolAutor = item.profiles?.rol;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-[#1B396A]/50 bg-slate-50/50 flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.classes}`}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rolAutor === 'docente'
                          ? 'bg-blue-100 text-[#1B396A]'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {rolAutor === 'docente'
                        ? 'Aporte Docente'
                        : 'Aporte Estudiante'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900">
                    {item.titulo}
                  </h3>
                  {item.descripcion && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {item.descripcion}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate max-w-[180px]">
                    Por: <strong>{item.profiles?.nombre_completo}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <a
                      href={item.archivo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[#1B396A] font-semibold hover:bg-blue-50"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                    {puedeEliminar && (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar material"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Drag & Drop para Subir Material */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Subir Material Didáctico al Grupo
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
              <input type="hidden" name="grupo_id" value={grupoId} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título del Recurso
                </label>
                <input
                  type="text"
                  name="titulo"
                  required
                  placeholder="Ej. Guía de Estudio Unidad 2 / Cheatsheet SQL"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  name="tipo_recurso"
                  defaultValue="guia"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                >
                  <option value="guia">Guía / Apunte de Clase</option>
                  <option value="presentacion">Presentación / Diapositivas</option>
                  <option value="codigo">Archivo de Práctica / ZIP</option>
                  <option value="lectura">Lectura / Artículo PDF</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción breve (Opcional)
                </label>
                <textarea
                  name="descripcion"
                  rows={2}
                  placeholder="Explica para qué tarea o tema sirve este archivo..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

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
                className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#1B396A] bg-blue-50/60'
                    : 'border-slate-300 hover:border-[#1B396A] bg-slate-50'
                }`}
              >
                <UploadCloud className="w-6 h-6 text-[#1B396A] mb-1.5" />
                {selectedFile ? (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {selectedFile.name}
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-700">
                      Arrastra tu archivo o haz clic para seleccionar
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      PDF, DOCX, PPTX, ZIP o Imagen (Máx. 15 MB)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  name="archivo_material"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              {fileError && (
                <p className="text-[11px] text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fileError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    'Compartir con el Grupo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}