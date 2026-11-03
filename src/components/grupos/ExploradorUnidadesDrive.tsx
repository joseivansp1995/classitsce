'use client';

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  FileText,
  ClipboardList,
  Video,
  ClockAlert,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  LayoutGrid,
  Calendar,
  Clock,
  RadioIcon,
  GripVertical,
  Copy,
  Move,
  Trash2,
  MoreVertical,
  FolderInput,
  Sparkles,
  AlertCircle,
  Loader2,
  X,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import CrearUnidadModal from '@/app/docente/grupos/[id]/CrearUnidadModal';
import ClonarGrupoModal from '@/app/docente/grupos/[id]/ClonarGrupoModal';
import CrearTareaModal from '@/app/docente/grupos/[id]/CrearTareaModal';
import CrearEvaluacionModal from '@/app/docente/grupos/[id]/CrearEvaluacionModal';
import GestionarUnidadModal from '@/app/docente/grupos/[id]/GestionarUnidadModal';
import EntregarTareaModal from '@/app/estudiante/grupos/[id]/EntregarTareaModal';
import ResolverEvaluacionModal from '@/app/estudiante/grupos/[id]/ResolverEvaluacionModal';
import {
  moverOCopiarActividadAction,
  eliminarActividadAction,
} from '@/app/docente/grupos/[id]/actions';
import { calcularCalificacionUnidadYCurso } from '@/utils/academico/calculo-ponderado';

export default function ExploradorUnidadesDrive({
  esDocente,
  grupoId,
  grupo,
  unidades,
  tareas,
  evaluaciones,
  clasesVirtuales,
  asistencias = [],
  entregas,
  respuestasEvaluaciones,
  matriculasCount = 0,
  onOpenCalificaciones,
  onInspectTarea,
  subView,
  onSubViewChange,
  conteoCalificaciones,
}: {
  esDocente: boolean;
  grupoId: string;
  grupo?: any;
  unidades: any[];
  tareas: any[];
  evaluaciones: any[];
  clasesVirtuales: any[];
  asistencias?: any[];
  entregas: any[];
  respuestasEvaluaciones: any[];
  matriculasCount?: number;
  onOpenCalificaciones?: () => void;
  onInspectTarea?: (tarea: any) => void;
  subView?: 'tareas' | 'examenes' | 'calificaciones';
  onSubViewChange?: (view: 'tareas' | 'examenes' | 'calificaciones') => void;
  conteoCalificaciones?: number;
}) {
  // null = vista raíz de carpetas de unidades; string = ID de unidad abierta (o 'general')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Fix: evitar new Date() directo en SSR para prevenir hydration mismatch
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
  }, []);

  // Estados interactivos estilo Google Drive
  const [modoArrastre, setModoArrastre] = useState<'mover' | 'copiar'>('mover');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPendingAction, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Modal para Mover / Copiar / Eliminar actividad mediante botones accesibles
  const [activeItemModal, setActiveItemModal] = useState<{
    item: any;
    tipo: 'tarea' | 'examen';
    accion: 'mover' | 'copiar' | 'eliminar';
  } | null>(null);
  const [selectedTargetFolder, setSelectedTargetFolder] = useState<string>('');

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const entregasMap = useMemo(
    () => new Map(entregas.map((e) => [e.tarea_id, e])),
    [entregas]
  );
  const respuestasMap = useMemo(
    () => new Map(respuestasEvaluaciones.map((r) => [r.evaluacion_id, r])),
    [respuestasEvaluaciones]
  );

  // Construir carpetas de Unidades + carpeta de "Actividades Generales" si hay ítems sin unidad
  const folders = useMemo(() => {
    const unitFolders = unidades.map((u) => {
      const uTareas = tareas.filter((t) => t.unidad_id === u.id);
      const uEval = evaluaciones.filter((e) => e.unidad_id === u.id);
      const uClases = clasesVirtuales.filter((c) => c.unidad_id === u.id);

      const pesoTareas = Number(
        u.peso_tareas_pct ?? grupo?.peso_tareas_pct ?? 50
      );
      const pesoEval = Number(
        u.peso_examenes_pct ?? grupo?.peso_examenes_pct ?? 40
      );
      const pesoAsist = Number(
        u.peso_asistencia_pct ?? grupo?.peso_asistencia_pct ?? 10
      );
      const encuadreTotal = pesoTareas + pesoEval + pesoAsist;

      // Calcular completados
      let completados = 0;
      uTareas.forEach((t) => {
        if (entregasMap.get(t.id)) completados++;
      });
      uEval.forEach((ev) => {
        if (respuestasMap.get(ev.id)) completados++;
      });

      const totalItems = uTareas.length + uEval.length;
      const progresoPct =
        totalItems > 0 ? Math.round((completados / totalItems) * 100) : 0;

      let promedioUnidad: number | null = null;
      if (!esDocente) {
        const resCalc = calcularCalificacionUnidadYCurso({
          grupo: grupo || {
            calificacion_minima_aprobatoria: 70,
            asistencia_minima_porcentaje: 80,
            peso_tareas_pct: pesoTareas,
            peso_examenes_pct: pesoEval,
            peso_asistencia_pct: pesoAsist,
          },
          unidades: [u],
          tareas: uTareas,
          evaluaciones: uEval,
          clases: uClases,
          entregas,
          respuestas: respuestasEvaluaciones,
          asistencias,
        });
        promedioUnidad = resCalc.unidades[0]?.calificacion ?? null;
      }

      return {
        id: u.id,
        numero: u.numero_unidad,
        nombre: u.nombre,
        descripcion: u.descripcion,
        rawUnidad: u,
        tareas: uTareas,
        evaluaciones: uEval,
        clases: uClases,
        totalItems,
        progresoPct,
        promedioUnidad,
        pesoTareas,
        pesoEval,
        pesoAsist,
        sumaPond: encuadreTotal,
      };
    });

    const tareasSinUnidad = tareas.filter((t) => !t.unidad_id);
    const evalSinUnidad = evaluaciones.filter((e) => !e.unidad_id);
    const clasesSinUnidad = clasesVirtuales.filter((c) => !c.unidad_id);

    if (
      tareasSinUnidad.length > 0 ||
      evalSinUnidad.length > 0 ||
      unitFolders.length === 0
    ) {
      unitFolders.push({
        id: 'general',
        numero: 0,
        nombre: 'Actividades Generales (Sin unidad asignada)',
        descripcion: 'Tareas y evaluaciones globales del curso.',
        rawUnidad: null,
        tareas: tareasSinUnidad,
        evaluaciones: evalSinUnidad,
        clases: clasesSinUnidad,
        totalItems: tareasSinUnidad.length + evalSinUnidad.length,
        progresoPct: 0,
        promedioUnidad: null,
        pesoTareas: Number(grupo?.peso_tareas_pct ?? 50),
        pesoEval: Number(grupo?.peso_examenes_pct ?? 40),
        pesoAsist: Number(grupo?.peso_asistencia_pct ?? 10),
        sumaPond: 100,
      });
    }

    return unitFolders;
  }, [
    unidades,
    tareas,
    evaluaciones,
    clasesVirtuales,
    entregasMap,
    respuestasMap,
    esDocente,
    grupo,
    entregas,
    respuestasEvaluaciones,
    asistencias,
  ]);

  const activeFolder = folders.find((f) => f.id === selectedFolderId) || null;
  const siguienteNumeroUnidad =
    unidades.length > 0
      ? Math.max(...unidades.map((u) => Number(u.numero_unidad))) + 1
      : 1;

  // Tareas y exámenes sin unidad para la bandeja en vista raíz
  const tareasSinUnidadRaiz = useMemo(
    () => tareas.filter((t) => !t.unidad_id),
    [tareas]
  );
  const evalSinUnidadRaiz = useMemo(
    () => evaluaciones.filter((e) => !e.unidad_id),
    [evaluaciones]
  );

  // Manejador central de Drop HTML5 en cualquier carpeta
  const handleDropOnFolder = (destinoFolderId: string, dataTransferStr: string) => {
    if (!dataTransferStr) return;
    try {
      const { tipo, id, titulo } = JSON.parse(dataTransferStr);
      if (!id || !tipo) return;

      const targetUnidadId =
        destinoFolderId === 'general' ? null : destinoFolderId;

      startTransition(async () => {
        const res = await moverOCopiarActividadAction({
          grupoId,
          tipo,
          itemId: id,
          destinoUnidadId: targetUnidadId,
          accion: modoArrastre,
        });

        if (res.success) {
          const targetFolder = folders.find((f) => f.id === destinoFolderId);
          const targetName = targetFolder
            ? targetFolder.numero > 0
              ? `Unidad ${targetFolder.numero}`
              : targetFolder.nombre
            : 'la carpeta';

          setToastMessage({
            text:
              modoArrastre === 'mover'
                ? `✓ "${titulo}" movida a ${targetName}`
                : `✓ Copia de "${titulo}" creada en ${targetName}`,
            type: 'success',
          });
        } else {
          setToastMessage({ text: res.message, type: 'error' });
        }
      });
    } catch (err) {
      console.warn('Error al procesar soltado:', err);
    }
  };

  // Ejecución desde el modal accesible para Mover / Copiar / Eliminar
  const handleConfirmarModalAction = () => {
    if (!activeItemModal) return;

    startTransition(async () => {
      if (
        activeItemModal.accion === 'mover' ||
        activeItemModal.accion === 'copiar'
      ) {
        const targetUnidadId =
          selectedTargetFolder === 'general' ? null : selectedTargetFolder;

        const res = await moverOCopiarActividadAction({
          grupoId,
          tipo: activeItemModal.tipo,
          itemId: activeItemModal.item.id,
          destinoUnidadId: targetUnidadId,
          accion: activeItemModal.accion,
        });

        if (res.success) {
          const targetFolder = folders.find(
            (f) => f.id === selectedTargetFolder
          );
          const targetName = targetFolder
            ? targetFolder.numero > 0
              ? `Unidad ${targetFolder.numero}`
              : targetFolder.nombre
            : 'la carpeta';

          setToastMessage({
            text:
              activeItemModal.accion === 'mover'
                ? `✓ "${activeItemModal.item.titulo}" movida a ${targetName}`
                : `✓ Copia creada en ${targetName}`,
            type: 'success',
          });
          setActiveItemModal(null);
        } else {
          setToastMessage({ text: res.message, type: 'error' });
        }
      } else if (activeItemModal.accion === 'eliminar') {
        const res = await eliminarActividadAction(
          grupoId,
          activeItemModal.tipo,
          activeItemModal.item.id
        );
        if (res.success) {
          setToastMessage({
            text: `✓ ${
              activeItemModal.tipo === 'tarea' ? 'Tarea' : 'Evaluación'
            } eliminada correctamente`,
            type: 'success',
          });
          setActiveItemModal(null);
        } else {
          setToastMessage({ text: res.message, type: 'error' });
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toast flotante de confirmación instantánea */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          BARRA SUPERIOR FUSIONADA (SELECTOR DE VISTA + ACCIONES + IMPORTAR)
         ===================================================================== */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Selector de sub-vista horizontal fusionado / Breadcrumbs */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap max-w-full pb-1 scrollbar-none [scrollbar-width:none]">
          {esDocente && onSubViewChange && (
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/60 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(null);
                  onSubViewChange('tareas');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subView !== 'calificaciones'
                    ? 'bg-white text-[#1B396A] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                Carpetas por Unidad ({unidades.length})
              </button>
              <button
                type="button"
                onClick={() => onSubViewChange('calificaciones')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subView === 'calificaciones'
                    ? 'bg-white text-[#1B396A] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Calificar Entregas ({conteoCalificaciones ?? (entregas.length + respuestasEvaluaciones.length)})
              </button>
            </div>
          )}

          {activeFolder && (
            <div className="flex items-center gap-1.5 text-xs font-semibold pl-1">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="text-slate-500 hover:text-[#1B396A] px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Inicio
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1B396A] font-bold">
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                {activeFolder.numero > 0
                  ? `Unidad ${activeFolder.numero}: ${activeFolder.nombre}`
                  : activeFolder.nombre}
              </span>
            </div>
          )}

          {!esDocente && !activeFolder && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#1B396A] font-bold text-xs">
              <LayoutGrid className="w-3.5 h-3.5" />
              Unidades Temáticas ({unidades.length})
            </span>
          )}
        </div>

        {/* Botones de acción del docente en una sola fila */}
        {esDocente && (
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap max-w-full pb-1 scrollbar-none [scrollbar-width:none]">
            <ClonarGrupoModal grupoDestinoId={grupoId} />
            <CrearUnidadModal
              grupoId={grupoId}
              siguienteNumero={siguienteNumeroUnidad}
            />
            <CrearTareaModal
              grupoId={grupoId}
              unidades={unidades}
              defaultUnidadId={
                activeFolder && activeFolder.id !== 'general'
                  ? activeFolder.id
                  : ''
              }
            />
            <CrearEvaluacionModal
              grupoId={grupoId}
              unidades={unidades}
              defaultUnidadId={
                activeFolder && activeFolder.id !== 'general'
                  ? activeFolder.id
                  : ''
              }
            />
          </div>
        )}
      </div>

      {/* =====================================================================
          BARRA DE DROP ZONES RÁPIDAS (MOSTRADA SOLO SI HAY > 1 UNIDAD O ARRASTRE ACTIVO)
         ===================================================================== */}
      {esDocente && (unidades.length > 1 || isDragging) && (
        <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 max-w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <FolderInput className="w-3.5 h-3.5 text-[#1B396A]" />
              Drop Zones:
            </span>

            {folders.map((f) => {
              const isOver = dragOverFolderId === f.id;
              return (
                <div
                  key={`dropzone-${f.id}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = modoArrastre === 'copiar' ? 'copy' : 'move';
                    setDragOverFolderId(f.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverFolderId(null);
                    handleDropOnFolder(
                      f.id,
                      e.dataTransfer.getData('application/json')
                    );
                  }}
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                    isOver
                      ? 'ring-2 ring-[#1B396A] bg-blue-100 text-[#1B396A] border-blue-300 scale-105 shadow-sm'
                      : f.id === selectedFolderId
                      ? 'bg-white border-[#1B396A] text-[#1B396A] shadow-2xs font-bold'
                      : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                  title={`Arrastra aquí para ${modoArrastre} a esta carpeta`}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate max-w-[130px]">
                    {f.numero > 0 ? `U${f.numero}: ${f.nombre}` : 'General'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({f.totalItems})
                  </span>
                </div>
              );
            })}
          </div>

          {/* Toggle de Modo al Soltar (Mover vs Copiar) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5">
              Al soltar:
            </span>
            <button
              type="button"
              onClick={() => setModoArrastre('mover')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                modoArrastre === 'mover'
                  ? 'bg-[#1B396A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Move className="w-3 h-3" />
              Mover
            </button>
            <button
              type="button"
              onClick={() => setModoArrastre('copiar')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                modoArrastre === 'copiar'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Copy className="w-3 h-3" />
              Copiar
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 1: CUADRÍCULA DE CARPETAS DE UNIDADES (ESTILO GOOGLE DRIVE)
         ===================================================================== */}
      {!activeFolder ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => {
              const isOver = dragOverFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  onDragOver={(e) => {
                    if (!esDocente) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = modoArrastre === 'copiar' ? 'copy' : 'move';
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => {
                    if (!esDocente) return;
                    e.preventDefault();
                    setDragOverFolderId(null);
                    handleDropOnFolder(
                      folder.id,
                      e.dataTransfer.getData('application/json')
                    );
                  }}
                  className={`group bg-white p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    isOver
                      ? 'ring-2 ring-[#1B396A] bg-blue-50/80 border-[#1B396A] scale-[1.02] shadow-md'
                      : 'border-slate-200/80 shadow-xs hover:border-[#1B396A] hover:shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                        <Folder className="w-5 h-5 fill-amber-400/30" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!esDocente && folder.promedioUnidad !== null && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Nota: {folder.promedioUnidad} pts
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          {folder.sumaPond}% encuadre
                        </span>

                        {/* Botón de configuración/eliminación de la unidad para el docente */}
                        {esDocente && folder.rawUnidad && (
                          <GestionarUnidadModal
                            grupoId={grupoId}
                            unidad={folder.rawUnidad}
                            compact={true}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      {folder.numero > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1B396A] block">
                          Unidad {folder.numero}
                        </span>
                      )}
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-[#1B396A] transition-colors line-clamp-1">
                        {folder.nombre}
                      </h3>
                      {folder.descripcion && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {folder.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[#1B396A]" />
                        {folder.tareas.length} tareas
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3 h-3 text-purple-600" />
                        {folder.evaluaciones.length} exám.
                      </span>
                      {folder.clases.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Video className="w-3 h-3 text-indigo-500" />
                          {folder.clases.length} ses.
                        </span>
                      )}
                      <span className="text-[#1B396A] font-semibold flex items-center gap-0.5">
                        Abrir <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>

                    {!esDocente && folder.totalItems > 0 && (
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${folder.progresoPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* =================================================================
              BANDEJA DE ACTIVIDADES SIN UNIDAD (SOLO DOCENTE EN VISTA RAÍZ)
             ================================================================= */}
          {esDocente &&
            (tareasSinUnidadRaiz.length > 0 || evalSinUnidadRaiz.length > 0) && (
              <div className="bg-amber-50/60 border-2 border-dashed border-amber-200/90 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                      <FolderInput className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        Bandeja de Actividades sin Unidad (
                        {tareasSinUnidadRaiz.length + evalSinUnidadRaiz.length})
                      </h4>
                      <p className="text-[11px] text-amber-700">
                        Arrastra cualquiera de estas actividades hacia una
                        carpeta de Unidad arriba para organizarla.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId('general')}
                    className="text-xs font-semibold text-amber-900 hover:underline flex items-center gap-1"
                  >
                    Ver carpeta completa <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {/* Tareas sin unidad */}
                  {tareasSinUnidadRaiz.map((t: any) => (
                    <div
                      key={`sin-u-t-${t.id}`}
                      draggable={true}
                        onDragEnd={() => setIsDragging(false)}
                      onDragStart={(e) => {
                          setIsDragging(true);
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            tipo: 'tarea',
                            id: t.id,
                            titulo: t.titulo,
                          })
                        );
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing hover:border-[#1B396A] transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1B396A] flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {t.titulo}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Ponderación: {t.ponderacion}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemModal({
                              item: t,
                              tipo: 'tarea',
                              accion: 'mover',
                            });
                            setSelectedTargetFolder(
                              unidades[0]?.id || 'general'
                            );
                          }}
                          className="p-1 rounded text-slate-400 hover:text-[#1B396A] hover:bg-slate-100"
                          title="Mover a..."
                        >
                          <Move className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemModal({
                              item: t,
                              tipo: 'tarea',
                              accion: 'copiar',
                            });
                            setSelectedTargetFolder(
                              unidades[0]?.id || 'general'
                            );
                          }}
                          className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-slate-100"
                          title="Copiar a..."
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveItemModal({
                              item: t,
                              tipo: 'tarea',
                              accion: 'eliminar',
                            })
                          }
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Exámenes sin unidad */}
                  {evalSinUnidadRaiz.map((ev: any) => (
                    <div
                      key={`sin-u-ev-${ev.id}`}
                      draggable={true}
                        onDragEnd={() => setIsDragging(false)}
                      onDragStart={(e) => {
                          setIsDragging(true);
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            tipo: 'examen',
                            id: ev.id,
                            titulo: ev.titulo,
                          })
                        );
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing hover:border-purple-600 transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {ev.titulo}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Ponderación: {ev.ponderacion}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemModal({
                              item: ev,
                              tipo: 'examen',
                              accion: 'mover',
                            });
                            setSelectedTargetFolder(
                              unidades[0]?.id || 'general'
                            );
                          }}
                          className="p-1 rounded text-slate-400 hover:text-[#1B396A] hover:bg-slate-100"
                          title="Mover a..."
                        >
                          <Move className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveItemModal({
                              item: ev,
                              tipo: 'examen',
                              accion: 'copiar',
                            });
                            setSelectedTargetFolder(
                              unidades[0]?.id || 'general'
                            );
                          }}
                          className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-slate-100"
                          title="Copiar a..."
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveItemModal({
                              item: ev,
                              tipo: 'examen',
                              accion: 'eliminar',
                            })
                          }
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100"
                          title="Eliminar examen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      ) : (
        /* =====================================================================
           VISTA 2: CONTENIDO INTERNO DE LA UNIDAD SELECCIONADA
           ===================================================================== */
        <div className="space-y-4">
          {/* Cabecera interna de la carpeta */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                title="Volver a carpetas de unidades"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {activeFolder.numero > 0
                    ? `Unidad ${activeFolder.numero}: ${activeFolder.nombre}`
                    : activeFolder.nombre}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeFolder.descripcion ||
                    'Tareas y evaluaciones pertenecientes a esta unidad temática.'}
                </p>
              </div>
            </div>

            {/* ── INDICADOR VISUAL DE ENCUADRE DE LA UNIDAD + AJUSTES DOCENTE ── */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#1B396A] border border-blue-200/60 font-bold flex items-center gap-1.5">
                <span>
                  Encuadre Unidad: <strong>{activeFolder.sumaPond}%</strong>
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Tareas: {activeFolder.pesoTareas}% • Exámenes:{' '}
                  {activeFolder.pesoEval}% • Asistencia:{' '}
                  {activeFolder.pesoAsist}%)
                </span>
              </div>

              {!esDocente && activeFolder.promedioUnidad !== null && (
                <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Nota Unidad: {activeFolder.promedioUnidad} pts
                </span>
              )}

              {esDocente && activeFolder.rawUnidad && (
                <GestionarUnidadModal
                  grupoId={grupoId}
                  unidad={activeFolder.rawUnidad}
                  onDeleted={() => setSelectedFolderId(null)}
                />
              )}
            </div>
          </div>

          {/* Lista de Tareas dentro de la Unidad */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1B396A]" />
                Tareas de la Unidad ({activeFolder.tareas.length})
              </span>
              {esDocente && (
                <span className="text-[11px] text-slate-400">
                  ⠿ Arrastra filas a las Drop Zones arriba para mover o copiar
                </span>
              )}
            </div>

            {activeFolder.tareas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay tareas asignadas dentro de esta unidad todavía.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeFolder.tareas.map((t: any) => {
                  const miEntrega = entregasMap.get(t.id) || null;
                  const numEntregas = entregas.filter(
                    (e) => e.tarea_id === t.id
                  ).length;
                  const vencida =
                    ahora !== null && ahora > new Date(t.fecha_limite);

                  return (
                    <div
                      key={t.id}
                      draggable={esDocente}
                        onDragEnd={() => setIsDragging(false)}
                      onDragStart={(e) => {
                          setIsDragging(true);
                        if (!esDocente) return;
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            tipo: 'tarea',
                            id: t.id,
                            titulo: t.titulo,
                          })
                        );
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      className="p-4 hover:bg-slate-50/80 flex flex-wrap items-center justify-between gap-4 group transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {esDocente && (
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0"
                            title="Arrastrar tarea para mover o copiar"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                        )}

                        <div
                          onClick={() => onInspectTarea?.(t)}
                          className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1B396A] font-bold text-xs flex items-center justify-center shrink-0">
                            {t.ponderacion}%
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold text-slate-900 group-hover:text-[#1B396A] transition-colors">
                                {t.titulo}
                              </p>
                              {Number(t.penalizacion_diaria_pct) > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  <ClockAlert className="w-3 h-3 text-amber-600" />
                                  Retardo: -{t.penalizacion_diaria_pct}%/día (máx
                                  -{t.penalizacion_maxima_pct}%)
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-1">
                              {t.descripcion}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              <span
                                className={
                                  vencida && !miEntrega
                                    ? 'text-red-600 font-semibold'
                                    : ''
                                }
                              >
                                Fecha límite:{' '}
                                {new Date(t.fecha_limite).toLocaleString(
                                  'es-MX',
                                  {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  }
                                )}
                              </span>
                              {t.archivo_guia_url && (
                                <a
                                  href={t.archivo_guia_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[#1B396A] font-semibold hover:underline"
                                >
                                  Descargar guía{' '}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {esDocente ? (
                          <>
                            <span className="text-xs text-slate-600 mr-1">
                              <strong>
                                {numEntregas}/{matriculasCount}
                              </strong>{' '}
                              entregas
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenCalificaciones?.()}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                            >
                              Calificar →
                            </button>

                            {/* Acciones directas (Mover / Copiar / Eliminar) */}
                            <div className="flex items-center border border-slate-200 rounded-xl bg-white p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveItemModal({
                                    item: t,
                                    tipo: 'tarea',
                                    accion: 'mover',
                                  });
                                  setSelectedTargetFolder(
                                    unidades[0]?.id || 'general'
                                  );
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B396A] hover:bg-slate-50 transition-colors"
                                title="Mover a otra unidad..."
                              >
                                <Move className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveItemModal({
                                    item: t,
                                    tipo: 'tarea',
                                    accion: 'copiar',
                                  });
                                  setSelectedTargetFolder(
                                    unidades[0]?.id || 'general'
                                  );
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-50 transition-colors"
                                title="Duplicar tarea..."
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveItemModal({
                                    item: t,
                                    tipo: 'tarea',
                                    accion: 'eliminar',
                                  })
                                }
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors"
                                title="Eliminar tarea"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <EntregarTareaModal
                            grupoId={grupoId}
                            tarea={t}
                            entregaExistente={miEntrega}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista de Evaluaciones dentro de la Unidad */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-purple-700" />
                Evaluaciones de la Unidad ({activeFolder.evaluaciones.length})
              </span>
              {esDocente && (
                <span className="text-[11px] text-slate-400">
                  ⠿ Arrastra filas a las Drop Zones arriba para mover o copiar
                </span>
              )}
            </div>

            {activeFolder.evaluaciones.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay exámenes configurados en esta unidad.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeFolder.evaluaciones.map((ev: any) => {
                  const miRespuesta = respuestasMap.get(ev.id) || null;
                  return (
                    <div
                      key={ev.id}
                      draggable={esDocente}
                        onDragEnd={() => setIsDragging(false)}
                      onDragStart={(e) => {
                          setIsDragging(true);
                        if (!esDocente) return;
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            tipo: 'examen',
                            id: ev.id,
                            titulo: ev.titulo,
                          })
                        );
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      className="p-4 hover:bg-slate-50/80 flex flex-wrap items-center justify-between gap-4 group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {esDocente && (
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0"
                            title="Arrastrar examen para mover o copiar"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                        )}

                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {ev.ponderacion}%
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                            {ev.titulo}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {(ev.preguntas || []).length} reactivos • Cierra:{' '}
                            {new Date(ev.fecha_cierre).toLocaleString('es-MX', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {esDocente ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenCalificaciones?.()}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                            >
                              Ver respuestas →
                            </button>

                            {/* Acciones directas (Mover / Copiar / Eliminar) */}
                            <div className="flex items-center border border-slate-200 rounded-xl bg-white p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveItemModal({
                                    item: ev,
                                    tipo: 'examen',
                                    accion: 'mover',
                                  });
                                  setSelectedTargetFolder(
                                    unidades[0]?.id || 'general'
                                  );
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B396A] hover:bg-slate-50 transition-colors"
                                title="Mover a otra unidad..."
                              >
                                <Move className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveItemModal({
                                    item: ev,
                                    tipo: 'examen',
                                    accion: 'copiar',
                                  });
                                  setSelectedTargetFolder(
                                    unidades[0]?.id || 'general'
                                  );
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-50 transition-colors"
                                title="Duplicar examen..."
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveItemModal({
                                    item: ev,
                                    tipo: 'examen',
                                    accion: 'eliminar',
                                  })
                                }
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors"
                                title="Eliminar examen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <ResolverEvaluacionModal
                            grupoId={grupoId}
                            evaluacion={ev}
                            respuestaExistente={miRespuesta}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================================================================
              SECCIÓN 3: CLASES Y ASISTENCIA DE LA UNIDAD
             ================================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-indigo-600" />
                Clases y Asistencia de la Unidad ({activeFolder.clases.length}{' '}
                {activeFolder.clases.length === 1 ? 'sesión' : 'sesiones'})
              </span>
            </div>

            {activeFolder.clases.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay sesiones virtuales vinculadas a esta unidad.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeFolder.clases.map((sesion: any) => (
                  <div
                    key={sesion.id}
                    className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">
                            {sesion.titulo_sesion}
                          </p>
                          {sesion.activa ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <RadioIcon className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                              En vivo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Finalizada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {sesion.fecha_programada}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {String(sesion.hora_inicio).slice(0, 5)} –{' '}
                            {String(sesion.hora_fin).slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {sesion.activa && (
                      <a
                        href={sesion.url_sala_video}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Entrar a la sala
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DE ACCIONES (MOVER / COPIAR / ELIMINAR ACTIVIDAD)
         ===================================================================== */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {activeItemModal.accion === 'mover' ? (
                  <div className="p-2 rounded-xl bg-blue-50 text-[#1B396A]">
                    <Move className="w-4 h-4" />
                  </div>
                ) : activeItemModal.accion === 'copiar' ? (
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                    <Copy className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-red-50 text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {activeItemModal.accion === 'mover'
                      ? 'Mover Actividad'
                      : activeItemModal.accion === 'copiar'
                      ? 'Duplicar Actividad'
                      : 'Eliminar Actividad'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                    {activeItemModal.item.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveItemModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {activeItemModal.accion === 'eliminar' ? (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-2">
                  <p className="font-bold">
                    ¿Estás seguro de eliminar esta {activeItemModal.tipo}?
                  </p>
                  <p className="text-[11px] text-red-700 leading-relaxed">
                    Esta acción eliminará la actividad y sus registros de
                    entregas/respuestas. No se puede revertir.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Selecciona la Carpeta de Destino:
                  </label>
                  <select
                    value={selectedTargetFolder}
                    onChange={(e) => setSelectedTargetFolder(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  >
                    {unidades.map((u) => (
                      <option key={`dest-${u.id}`} value={u.id}>
                        Unidad {u.numero_unidad}: {u.nombre}
                      </option>
                    ))}
                    <option value="general">
                      Actividades Generales (Sin unidad)
                    </option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {activeItemModal.accion === 'mover'
                      ? 'La actividad cambiará de unidad de forma inmediata.'
                      : 'Se creará una copia con el mismo contenido en la unidad elegida.'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItemModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPendingAction}
                  onClick={handleConfirmarModalAction}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs ${
                    activeItemModal.accion === 'eliminar'
                      ? 'bg-red-600 hover:bg-red-700'
                      : activeItemModal.accion === 'copiar'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-[#1B396A] hover:bg-[#152c54]'
                  }`}
                >
                  {isPendingAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Procesando...
                    </>
                  ) : activeItemModal.accion === 'eliminar' ? (
                    'Eliminar definitivamente'
                  ) : activeItemModal.accion === 'copiar' ? (
                    'Crear Copia'
                  ) : (
                    'Mover Actividad'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
