'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ExternalLink,
  ChevronRight,
  Users,
  Mail,
  SlidersHorizontal,
  X,
  Copy,
  Check,
  TrendingUp,
  Activity,
  FolderOpen,
  MessageSquare,
  Award,
  ArrowLeft,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { copyToClipboard } from '@/utils/dom/clipboard';
import GrupoTabsNav, {
  type GrupoTabKey,
} from '@/components/layout/GrupoTabsNav';
import dynamic from 'next/dynamic';
import InvitarEstudianteModal from '@/app/docente/grupos/[id]/InvitarEstudianteModal';

const WorkspaceTabSkeleton = () => (
  <div className="h-64 rounded-2xl bg-slate-100/80 animate-pulse border border-slate-200/60" />
);

const ModuloDirectorioEstudiantes = dynamic(
  () => import('./ModuloDirectorioEstudiantes'),
  { loading: WorkspaceTabSkeleton }
);

const ExploradorUnidadesDrive = dynamic(
  () => import('./ExploradorUnidadesDrive'),
  { loading: WorkspaceTabSkeleton }
);

const TablaEntregasCalificaciones = dynamic(
  () => import('@/app/docente/grupos/[id]/TablaEntregasCalificaciones'),
  { loading: WorkspaceTabSkeleton }
);

const ModuloMaterialDidactico = dynamic(
  () => import('@/components/comunidad/ModuloMaterialDidactico'),
  { loading: WorkspaceTabSkeleton }
);

const ModuloForoGrupo = dynamic(
  () => import('@/components/comunidad/ModuloForoGrupo'),
  { loading: WorkspaceTabSkeleton }
);

const ModuloClasesVirtuales = dynamic(
  () => import('@/components/clases/ModuloClasesVirtuales'),
  { loading: WorkspaceTabSkeleton }
);

const ModuloConstanciasGrupo = dynamic(
  () => import('@/components/constancias/ModuloConstanciasGrupo'),
  { loading: WorkspaceTabSkeleton }
);

import ConfigurarPonderacionModal from '@/app/docente/grupos/[id]/ConfigurarPonderacionModal';

import GestionarGrupoModal from '@/app/docente/GestionarGrupoModal';
import { calcularCalificacionUnidadYCurso } from '@/utils/academico/calculo-ponderado';

function RadialProgress({
  value,
  size = 52,
  strokeWidth = 5,
  colorClass = 'text-[#1B396A]',
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  label?: string;
}) {
  const safeVal = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeVal / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-500 ease-out`}
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-slate-800">
        {label ?? `${safeVal}%`}
      </span>
    </div>
  );
}

export default function MinimalGroupWorkspace({
  esDocente,
  grupo,
  docenteNombre,
  currentUser,
  unidades = [],
  matriculas,
  invitaciones,
  tareas,
  evaluaciones,
  entregas,
  respuestasEvaluaciones,
  materiales,
  foroTemas,
  foroComentarios,
  clasesVirtuales,
  asistencias,
  constancias,
}: {
  esDocente: boolean;
  grupo: any;
  docenteNombre: string;
  currentUser: { id: string; nombre_completo: string; email: string };
  unidades?: any[];
  matriculas: any[];
  invitaciones: any[];
  tareas: any[];
  evaluaciones: any[];
  entregas: any[];
  respuestasEvaluaciones: any[];
  materiales: any[];
  foroTemas: any[];
  foroComentarios: any[];
  clasesVirtuales: any[];
  asistencias: any[];
  constancias: any[];
}) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchParams = useSearchParams();
  const urlTab = (searchParams.get('tab') as GrupoTabKey) || 'resumen';
  const [activeTab, setActiveTab] = useState<GrupoTabKey>(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  // Sincronización en tiempo real con Supabase Realtime (protegida para HTTP/móvil)
  useEffect(() => {
    let channel: any = null;
    let refreshTimeout: NodeJS.Timeout | null = null;
    let supabase: any = null;

    try {
      supabase = createClient();

      const triggerRefresh = () => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          router.refresh();
        }, 300);
      };

      channel = supabase
        .channel(`workspace-sync-${grupo.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'unidades',
            filter: `grupo_id=eq.${grupo.id}`,
          },
          triggerRefresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tareas',
            filter: `grupo_id=eq.${grupo.id}`,
          },
          triggerRefresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'evaluaciones',
            filter: `grupo_id=eq.${grupo.id}`,
          },
          triggerRefresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clases_virtuales',
            filter: `grupo_id=eq.${grupo.id}`,
          },
          triggerRefresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'entregas',
          },
          triggerRefresh
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase Realtime subscription error (ignorado en red móvil no segura):', err);
    }

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, [grupo.id, router]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  };

  // Cambio de pestaña instantáneo en cliente (0ms) sin recargar el servidor
  const handleSelectTab = (tab: GrupoTabKey) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        console.warn('Error al actualizar parámetro de pestaña en URL:', err);
      }
    }
  };

  const [evalSubView, setEvalSubView] = useState<
    'tareas' | 'examenes' | 'calificaciones'
  >('tareas');
  const [comunidadSubView, setComunidadSubView] = useState<'material' | 'foro'>(
    'material'
  );
  const [cierreSubView, setCierreSubView] = useState<
    'constancias' | 'invitaciones'
  >('constancias');

  const [drawerItem, setDrawerItem] = useState<{
    type: 'tarea' | 'examen';
    data: any;
  } | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [copiedCodigo, setCopiedCodigo] = useState(false);

  const handleCopyCodigo = async () => {
    if (!grupo?.codigo_acceso) return;
    await copyToClipboard(grupo.codigo_acceso);
    setCopiedCodigo(true);
    setTimeout(() => setCopiedCodigo(false), 2000);
  };






  const telemetry = useMemo(() => {
    const totalAlumnos = matriculas.length;
    const totalTareas = tareas.length;
    const totalEval = evaluaciones.length;
    const totalSesiones = clasesVirtuales.length;

    const pesoTareas = Number(grupo?.peso_tareas_pct ?? 50);
    const pesoEval = Number(grupo?.peso_examenes_pct ?? 40);
    const pesoAsist = Number(grupo?.peso_asistencia_pct ?? 10);
    const ponderacionTotal = pesoTareas + pesoEval + pesoAsist;

    if (esDocente) {
      const entregasEsperadas = Math.max(1, totalAlumnos * totalTareas);
      const tasaEntrega =
        totalTareas > 0
          ? Math.min(
              100,
              Math.round((entregas.length / entregasEsperadas) * 100)
            )
          : 0;

      let promedioGrupal = 0;
      if (matriculas.length > 0) {
        const promediosAlumnos = matriculas.map((m) => {
          const res = calcularCalificacionUnidadYCurso({
            grupo,
            unidades,
            tareas,
            evaluaciones,
            clases: clasesVirtuales,
            entregas,
            respuestas: respuestasEvaluaciones,
            asistencias,
            estudianteId: m.estudiante_id,
          });
          return res.promedio;
        });
        promedioGrupal = Math.round(
          promediosAlumnos.reduce((a, b) => a + b, 0) / promediosAlumnos.length
        );
      } else {
        const calificacionesValidas = [
          ...entregas
            .filter((e) => e.calificacion !== null)
            .map((e) => Number(e.calificacion)),
          ...respuestasEvaluaciones
            .filter((r) => r.calificacion !== null)
            .map((r) => Number(r.calificacion)),
        ];
        promedioGrupal =
          calificacionesValidas.length > 0
            ? Math.round(
                calificacionesValidas.reduce((a, b) => a + b, 0) /
                  calificacionesValidas.length
              )
            : 0;
      }

      const asistenciasEsperadas = Math.max(1, totalAlumnos * totalSesiones);
      const presentesTotales = asistencias.filter((a) => a.presente).length;
      const asistenciaGrupal =
        totalSesiones > 0
          ? Math.min(
              100,
              Math.round((presentesTotales / asistenciasEsperadas) * 100)
            )
          : 100;

      const pendientesRevisar =
        entregas.filter((e) => e.calificacion === null).length +
        respuestasEvaluaciones.filter((r) => r.calificacion === null).length;

      return {
        metric1: {
          label: 'Promedio Grupal',
          value: promedioGrupal,
          suffix: 'pts',
          color: 'text-[#1B396A]',
        },
        metric2: {
          label: 'Tasa de Entregas',
          value: tasaEntrega,
          suffix: '%',
          color: 'text-emerald-600',
        },
        metric3: {
          label: 'Asistencia Media',
          value: asistenciaGrupal,
          suffix: '%',
          color: 'text-indigo-600',
        },
        metric4: { label: 'Por Calificar', value: pendientesRevisar },
        pesoTareas,
        pesoEval,
        pesoAsist,
        ponderacionTotal,
      };
    } else {
      const misEntregasCount = entregas.length;
      const misRespCount = respuestasEvaluaciones.length;
      const totalActividades = totalTareas + totalEval;
      const miAvance =
        totalActividades > 0
          ? Math.round(
              ((misEntregasCount + misRespCount) / totalActividades) * 100
            )
          : 100;

      const resCalculo = calcularCalificacionUnidadYCurso({
        grupo,
        unidades,
        tareas,
        evaluaciones,
        clases: clasesVirtuales,
        entregas,
        respuestas: respuestasEvaluaciones,
        asistencias,
        estudianteId: currentUser?.id,
      });

      const miPromedio = resCalculo.promedio;
      const miAsistenciaPct = resCalculo.asistenciaPct;

      return {
        metric1: {
          label: 'Mi Promedio',
          value: miPromedio,
          suffix: 'pts',
          color:
            miPromedio >= (grupo?.calificacion_minima_aprobatoria ?? 70)
              ? 'text-emerald-600'
              : 'text-amber-500',
        },
        metric2: {
          label: 'Avance de Entregas',
          value: miAvance,
          suffix: '%',
          color: 'text-[#1B396A]',
        },
        metric3: {
          label: 'Mi Asistencia',
          value: miAsistenciaPct,
          suffix: '%',
          color:
            miAsistenciaPct >= (grupo?.asistencia_minima_porcentaje ?? 80)
              ? 'text-indigo-600'
              : 'text-red-500',
        },
        metric4: {
          label: 'Pendientes',
          value: Math.max(
            0,
            totalActividades - (misEntregasCount + misRespCount)
          ),
        },
        pesoTareas,
        pesoEval,
        pesoAsist,
        ponderacionTotal,
      };
    }
  }, [
    esDocente,
    matriculas,
    tareas,
    evaluaciones,
    entregas,
    respuestasEvaluaciones,
    clasesVirtuales,
    asistencias,
    grupo,
    unidades,
    currentUser,
  ]);

  // Fix: evitar typeof window durante el render inicial (causa prerendering inestable):
  // Se inicializa en '' y se rellena en cliente via useEffect.
  const [baseUrl, setBaseUrl] = useState('')
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return (
    <div className="space-y-4">
      {/* CABECERA COMPACTA + PESTAÑAS INSTANTÁNEAS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={esDocente ? '/docente' : '/estudiante'}
              className="p-2 rounded-xl border border-slate-200/80 text-slate-500 hover:text-[#1B396A] hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#1B396A]">
                  {grupo.clave_materia}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {grupo.periodo}
                </span>
                {esDocente ? (
                  <button
                    type="button"
                    onClick={handleCopyCodigo}
                    title="Clic para copiar código de acceso al grupo"
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md text-slate-700 transition-colors border border-slate-200/80 cursor-pointer shadow-2xs"
                  >
                    <KeyRound className="w-2.5 h-2.5 text-[#1B396A]" />
                    <span>{grupo.codigo_acceso}</span>
                    {copiedCodigo ? (
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 text-slate-400" />
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Docente: <strong>{docenteNombre}</strong>
                  </span>
                )}
              </div>
              <h1 className="text-base font-bold text-slate-900 mt-0.5">
                {grupo.nombre}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Sincronizar datos del grupo en tiempo real"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs hover:border-slate-300 transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#1B396A] ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">
                {isRefreshing ? 'Sincronizando...' : 'Sincronizar'}
              </span>
            </button>

            {esDocente && (
              <>
                <GestionarGrupoModal grupo={grupo} enDetalleGrupo={true} />
                <ConfigurarPonderacionModal
                  grupoId={grupo.id}
                  grupoConfig={grupo}
                  unidades={unidades}
                />
                <InvitarEstudianteModal
                  grupoId={grupo.id}
                  nombreGrupo={grupo.nombre}
                />
              </>
            )}
          </div>
        </div>

        <GrupoTabsNav
          esDocente={esDocente}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          counts={{
            estudiantes: matriculas.length,
            actividades: tareas.length + evaluaciones.length,
            comunidad: materiales.length + foroTemas.length,
            clasesActivas: clasesVirtuales.filter((c) => c.activa).length,
            constancias: constancias.length,
          }}
        />
      </div>

      {/* BARRA DE TELEMETRÍA CON ANILLOS SVG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {telemetry.metric1.label}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-slate-900">
                {telemetry.metric1.value}
              </span>
              <span className="text-[11px] text-slate-400">
                / 100 {telemetry.metric1.suffix}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Mínimo: {grupo.calificacion_minima_aprobatoria}
            </span>
          </div>
          <RadialProgress
            value={telemetry.metric1.value}
            colorClass={telemetry.metric1.color}
            label={`${telemetry.metric1.value}`}
          />
        </div>

        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {telemetry.metric2.label}
            </span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block">
              {telemetry.metric2.value}%
            </span>
            <span className="text-[10px] text-slate-400">
              {unidades.length} unidades • {tareas.length} tareas •{' '}
              {evaluaciones.length} exám.
            </span>
          </div>
          <RadialProgress
            value={telemetry.metric2.value}
            colorClass={telemetry.metric2.color}
          />
        </div>

        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {telemetry.metric3.label}
            </span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block">
              {telemetry.metric3.value}%
            </span>
            <span className="text-[10px] text-slate-400">
              Mínimo: {grupo.asistencia_minima_porcentaje}%
            </span>
          </div>
          <RadialProgress
            value={telemetry.metric3.value}
            colorClass={telemetry.metric3.color}
          />
        </div>

        <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {telemetry.metric4.label}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
              {telemetry.metric4.value}
            </span>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Encuadre</span>
              <span className="font-mono font-bold text-slate-700">
                {telemetry.pesoTareas}% T • {telemetry.pesoEval}% E • {telemetry.pesoAsist}% A
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${telemetry.pesoTareas}%`,
                }}
                className="bg-[#1B396A] h-full"
                title={`Tareas: ${telemetry.pesoTareas}%`}
              />
              <div
                style={{
                  width: `${telemetry.pesoEval}%`,
                }}
                className="bg-purple-500 h-full"
                title={`Exámenes: ${telemetry.pesoEval}%`}
              />
              <div
                style={{
                  width: `${telemetry.pesoAsist}%`,
                }}
                className="bg-emerald-500 h-full"
                title={`Asistencia: ${telemetry.pesoAsist}%`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PESTAÑA 1: RESUMEN EJECUTIVO
         ===================================================================== */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#1B396A]" />
                Actividades Recientes
              </span>
              <button
                onClick={() => handleSelectTab('evaluacion')}
                className="text-xs font-semibold text-[#1B396A] hover:underline flex items-center gap-1"
              >
                Explorar unidades <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {tareas.length === 0 && evaluaciones.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay actividades registradas todavía.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                {tareas.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setDrawerItem({ type: 'tarea', data: t })}
                    className="px-5 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#1B396A] shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {t.titulo}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Vence:{' '}
                          {new Date(t.fecha_limite).toLocaleDateString('es-MX')}{' '}
                          • {t.ponderacion}%
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#1B396A]" />
                Accesos Directos del Curso
              </span>
              <p className="text-xs text-slate-500">
                Navega sin recargas entre los módulos del aula:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {esDocente && (
                <button
                  onClick={() => handleSelectTab('estudiantes')}
                  className="p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 text-xs font-bold text-[#1B396A] flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Abrir Expediente 360° de Estudiantes ({matriculas.length})
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleSelectTab('evaluacion')}
                className="p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 text-xs font-semibold text-amber-900 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                  Carpetas por Unidad Temática ({unidades.length})
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSelectTab('clases')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 flex items-center justify-between"
              >
                <span>Sala Virtual y Pase de Lista</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSelectTab('constancias')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 flex items-center justify-between"
              >
                <span>Emisión de Constancias QR</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: ESTUDIANTES 360° (LISTA UNIFICADA CON DRAWER INDIVIDUAL)
         ===================================================================== */}
      {activeTab === 'estudiantes' && esDocente && (
        <ModuloDirectorioEstudiantes
          grupo={grupo}
          docenteNombre={docenteNombre}
          matriculas={matriculas}
          tareas={tareas}
          evaluaciones={evaluaciones}
          entregas={entregas}
          respuestasEvaluaciones={respuestasEvaluaciones}
          clasesVirtuales={clasesVirtuales}
          asistencias={asistencias}
          constancias={constancias}
          unidades={unidades}
        />
      )}

      {/* =====================================================================
          PESTAÑA 3: UNIDADES TEMÁTICAS (ESTILO DRIVE), TAREAS Y CALIFICACIONES
         ===================================================================== */}
      {activeTab === 'evaluacion' && (
        <div className="space-y-4">
          {evalSubView === 'calificaciones' && esDocente ? (
            <div className="space-y-4">
              <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setEvalSubView('tareas')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                    Carpetas por Unidad ({unidades.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvalSubView('calificaciones')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#1B396A] shadow-xs font-bold transition-all cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Calificar Entregas ({entregas.length + respuestasEvaluaciones.length})
                  </button>
                </div>
              </div>

              <TablaEntregasCalificaciones
                grupoId={grupo.id}
                entregas={entregas}
                respuestasEvaluaciones={respuestasEvaluaciones}
              />
            </div>
          ) : (
            <ExploradorUnidadesDrive
              esDocente={esDocente}
              grupoId={grupo.id}
              grupo={grupo}
              unidades={unidades}
              tareas={tareas}
              evaluaciones={evaluaciones}
              clasesVirtuales={clasesVirtuales}
              asistencias={asistencias}
              entregas={entregas}
              respuestasEvaluaciones={respuestasEvaluaciones}
              matriculasCount={matriculas.length}
              subView={evalSubView}
              onSubViewChange={setEvalSubView}
              conteoCalificaciones={entregas.length + respuestasEvaluaciones.length}
              onOpenCalificaciones={() => setEvalSubView('calificaciones')}
              onInspectTarea={(t) => setDrawerItem({ type: 'tarea', data: t })}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: COMUNIDAD (MATERIAL Y FORO)
         ===================================================================== */}
      {activeTab === 'comunidad' && (
        <div className="space-y-4">
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-xl bg-slate-100/90 overflow-x-auto whitespace-nowrap max-w-full pb-1 scrollbar-none [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => setComunidadSubView('material')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                  comunidadSubView === 'material'
                    ? 'bg-white text-[#1B396A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Material Didáctico ({materiales.length})
              </button>
              <button
                type="button"
                onClick={() => setComunidadSubView('foro')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                  comunidadSubView === 'foro'
                    ? 'bg-white text-[#1B396A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Foro de Debate ({foroTemas.length})
              </button>
            </div>
          </div>

          {comunidadSubView === 'material' ? (
            <ModuloMaterialDidactico
              grupoId={grupo.id}
              currentUserId={currentUser.id}
              esDocenteTitular={esDocente}
              materiales={materiales}
            />
          ) : (
            <ModuloForoGrupo
              grupoId={grupo.id}
              esDocenteTitular={esDocente}
              temas={foroTemas}
              comentarios={foroComentarios}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 5: SALA VIRTUAL Y ASISTENCIA
         ===================================================================== */}
      {activeTab === 'clases' && (
        <ModuloClasesVirtuales
          grupoId={grupo.id}
          nombreGrupo={grupo.nombre}
          currentUser={currentUser}
          esDocenteTitular={esDocente}
          clases={clasesVirtuales}
          asistencias={asistencias}
          matriculas={matriculas}
          unidades={unidades}
        />
      )}

      {/* =====================================================================
          PESTAÑA 6: CONSTANCIAS QR E INVITACIONES
         ===================================================================== */}
      {activeTab === 'constancias' && (
        <div className="space-y-4">
          {esDocente && (
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-xl bg-slate-100/90 overflow-x-auto whitespace-nowrap max-w-full pb-1 scrollbar-none [scrollbar-width:none]">
                <button
                  type="button"
                  onClick={() => setCierreSubView('constancias')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    cierreSubView === 'constancias'
                      ? 'bg-white text-[#1B396A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Dictamen y Constancias QR
                </button>
                <button
                  type="button"
                  onClick={() => setCierreSubView('invitaciones')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    cierreSubView === 'invitaciones'
                      ? 'bg-white text-[#1B396A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Enlaces de Invitación ({invitaciones.length})
                </button>
              </div>
              {cierreSubView === 'invitaciones' && (
                <InvitarEstudianteModal grupoId={grupo.id} nombreGrupo={grupo?.nombre || ''} />
              )}
            </div>
          )}

          {(!esDocente || cierreSubView === 'constancias') && (
            <ModuloConstanciasGrupo
              grupo={grupo}
              docenteNombre={docenteNombre}
              currentUser={currentUser}
              esDocenteTitular={esDocente}
              matriculas={matriculas}
              tareas={tareas}
              evaluaciones={evaluaciones}
              entregas={entregas}
              respuestasEvaluaciones={respuestasEvaluaciones}
              clases={clasesVirtuales}
              asistencias={asistencias}
              constancias={constancias}
              unidades={unidades}
            />
          )}

          {esDocente && cierreSubView === 'invitaciones' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              {invitaciones.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No se han generado invitaciones todavía</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Genera un enlace de invitación institucional para matricular alumnos en este grupo.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-5">Correo Institucional</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4">Fecha de Registro</th>
                        <th className="py-3.5 px-5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {invitaciones.map((inv: any) => {
                        const url = `${baseUrl}/registro?token=${inv.token}&email=${encodeURIComponent(
                          inv.email_estudiante
                        )}`;
                        const isAceptada = inv.estado === 'aceptada';
                        const fechaRegistro = inv.created_at
                          ? new Date(inv.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—';

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-5 font-semibold text-slate-800">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-[#1B396A]/70 shrink-0" />
                                <span>{inv.email_estudiante}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {isAceptada ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Aceptada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-medium">
                              {fechaRegistro}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {inv.estado === 'pendiente' ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await copyToClipboard(url);
                                    setCopiedTokenId(inv.id);
                                    setTimeout(() => setCopiedTokenId(null), 2000);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                                  title="Copiar enlace de registro"
                                >
                                  {copiedTokenId === inv.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                                      Copiar link
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  Matriculado
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DRAWER RÁPIDO PARA DETALLE DE TAREA */}
      {drawerItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#1B396A]">
                  Ficha de Actividad
                </span>
                <button
                  onClick={() => setDrawerItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {drawerItem.data.titulo}
              </h3>
              {drawerItem.data.descripcion && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 whitespace-pre-line">
                  {drawerItem.data.descripcion}
                </div>
              )}
              {drawerItem.data.archivo_guia_url && (
                <a
                  href={drawerItem.data.archivo_guia_url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-[#1B396A] flex items-center justify-center gap-2"
                >
                  Descargar Material Guía <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <button
              onClick={() => setDrawerItem(null)}
              className="w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}