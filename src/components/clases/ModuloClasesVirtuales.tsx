'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useActionState,
  useTransition,
} from 'react';
import {
  Video,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  PhoneOff,
  ExternalLink,
  Radio,
  Loader2,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  programarClaseVirtualAction,
  toggleEstadoClaseVirtualAction,
  registrarAsistenciaAutomaticaAction,
  marcarAsistenciaManualDocenteAction,
} from '@/app/actions/clases-virtuales';
import type { ActionState } from '@/app/(auth)/actions';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

const initialState: ActionState = { success: false, message: '' };

export default function ModuloClasesVirtuales({
  grupoId,
  nombreGrupo,
  currentUser,
  esDocenteTitular,
  clases,
  asistencias,
  matriculas,
  unidades = [],
}: {
  grupoId: string;
  nombreGrupo: string;
  currentUser: { id: string; nombre_completo: string; email: string };
  esDocenteTitular: boolean;
  clases: any[];
  asistencias: any[];
  matriculas: any[];
  unidades?: any[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [claseSeleccionadaId, setClaseSeleccionadaId] = useState<string | null>(
    clases[0]?.id || null
  );
  const [enVideollamada, setEnVideollamada] = useState(false);
  const [mensajeAsistenciaAuto, setMensajeAsistenciaAuto] = useState<
    string | null
  >(null);

  const jitsiContainerRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<any>(null);

  const [isToggling, startTransition] = useTransition();
  const [stateCrear, formActionCrear, isPendingCrear] = useActionState(
    programarClaseVirtualAction,
    initialState
  );

  const claseActiva =
    clases.find((c) => c.id === claseSeleccionadaId) || clases[0] || null;

  // Filtrar asistencias correspondientes a la sesión seleccionada
  const asistenciasDeLaClase = claseActiva
    ? asistencias.filter((a) => a.clase_id === claseActiva.id)
    : [];

  const mapaAsistenciaPorAlumno = new Map(
    asistenciasDeLaClase.map((a) => [a.estudiante_id, a])
  );

  // Calcular porcentaje de asistencia global del estudiante actual en este grupo
  const totalSesionesGrupo = clases.length;
  const misAsistenciasPresentes = asistencias.filter(
    (a) => a.estudiante_id === currentUser.id && a.presente
  ).length;
  const miPorcentajeAsistencia =
    totalSesionesGrupo > 0
      ? Math.round((misAsistenciasPresentes / totalSesionesGrupo) * 100)
      : 100;

  // Cargar e inicializar Jitsi Meet IFrame API cuando el usuario entra a la sala
  useEffect(() => {
    if (!enVideollamada || !claseActiva || !jitsiContainerRef.current) return;

    let isMounted = true;

    const iniciarJitsi = () => {
      if (!isMounted || !window.JitsiMeetExternalAPI || !jitsiContainerRef.current)
        return;

      jitsiContainerRef.current.innerHTML = '';

      const domain = 'meet.jit.si';
      const options = {
        roomName: claseActiva.codigo_sala_video,
        width: '100%',
        height: 460,
        parentNode: jitsiContainerRef.current,
        userInfo: {
          email: currentUser.email,
          displayName: `${currentUser.nombre_completo} (${
            esDocenteTitular ? 'Docente' : 'Estudiante'
          })`,
        },
        configOverwrite: {
          startWithAudioMuted: !esDocenteTitular,
          prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
        },
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = api;

      // Escuchar evento de entrada a la sala para registrar asistencia automática
      api.addEventListener('videoConferenceJoined', async () => {
        if (!esDocenteTitular && claseActiva.activa) {
          const res = await registrarAsistenciaAutomaticaAction(
            claseActiva.id,
            grupoId
          );
          if (isMounted && res.message) {
            setMensajeAsistenciaAuto(res.message);
          }
        }
      });

      api.addEventListener('readyToClose', () => {
        if (isMounted) setEnVideollamada(false);
      });
    };

    if (window.JitsiMeetExternalAPI) {
      iniciarJitsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = iniciarJitsi;
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [enVideollamada, claseActiva, currentUser, esDocenteTitular, grupoId]);

  // Generar enlace directo para añadir sesión a Google Calendar
  const generarGoogleCalendarUrl = (sesion: any) => {
    const fechaLimpia = String(sesion.fecha_programada).replace(/-/g, '');
    const inicioLimpio = String(sesion.hora_inicio)
      .slice(0, 5)
      .replace(':', '');
    const finLimpio = String(sesion.hora_fin).slice(0, 5).replace(':', '');
    const dates = `${fechaLimpia}T${inicioLimpio}00/${fechaLimpia}T${finLimpio}00`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `[ClassITSCe] ${nombreGrupo}: ${sesion.titulo_sesion}`,
      details: `Sesión virtual sincrónica en ClassITSCe.\nSala de video: ${sesion.url_sala_video}`,
      dates,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleToggleEstadoSala = (clase: any) => {
    startTransition(async () => {
      await toggleEstadoClaseVirtualAction(clase.id, grupoId, !clase.activa);
    });
  };

  const handleMarcarAsistenciaManual = (
    estudianteId: string,
    presente: boolean
  ) => {
    if (!claseActiva) return;
    startTransition(async () => {
      await marcarAsistenciaManualDocenteAction(
        claseActiva.id,
        grupoId,
        estudianteId,
        presente
      );
    });
  };

  // Respaldo por si el navegador bloquea scripts externos o el alumno desea registrar asistencia con un clic al unirse
  const handleUnirseSala = async () => {
    setEnVideollamada(true);
    if (!esDocenteTitular && claseActiva?.activa) {
      const res = await registrarAsistenciaAutomaticaAction(
        claseActiva.id,
        grupoId
      );
      if (res.message) setMensajeAsistenciaAuto(res.message);
    }
  };

  return (
    <div
      id="clases"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Encabezado del Módulo */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#1B396A]" />
            <h2 className="font-bold text-sm text-slate-900">
              Clases Virtuales y Control de Asistencia ({clases.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Videollamadas integradas con Jitsi Meet y registro automático de
            asistencia al conectarse.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!esDocenteTitular && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Mi Asistencia: {miPorcentajeAsistencia}% ({misAsistenciasPresentes}
              /{totalSesionesGrupo})
            </span>
          )}

          {esDocenteTitular && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Programar Clase Virtual
            </button>
          )}
        </div>
      </div>

      {clases.length === 0 ? (
        <div className="p-10 text-center">
          <Video className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">
            No hay sesiones virtuales programadas en el calendario
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {esDocenteTitular
              ? 'Haz clic en "Programar Clase Virtual" para crear una sala de video y habilitar el pase de lista.'
              : 'Cuando tu docente programe una clase virtual aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Columna Izquierda: Calendario de Sesiones */}
          <div className="lg:col-span-4 divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {clases.map((sesion) => {
              const selected = claseActiva?.id === sesion.id;
              const miRegistro = asistencias.find(
                (a) =>
                  a.clase_id === sesion.id && a.estudiante_id === currentUser.id
              );

              return (
                <button
                  key={sesion.id}
                  type="button"
                  onClick={() => {
                    setClaseSeleccionadaId(sesion.id);
                    setEnVideollamada(false);
                    setMensajeAsistenciaAuto(null);
                  }}
                  className={`w-full text-left p-4 transition-all space-y-1.5 ${
                    selected
                      ? 'bg-blue-50/70 border-l-4 border-[#1B396A]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {sesion.activa ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <Radio className="w-3 h-3 animate-pulse text-emerald-600" />
                        Sala Abierta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                        Finalizada
                      </span>
                    )}

                    {!esDocenteTitular && (
                      <span
                        className={`text-[10px] font-bold ${
                          miRegistro?.presente
                            ? 'text-emerald-700'
                            : 'text-amber-600'
                        }`}
                      >
                        {miRegistro?.presente ? '✓ Asistencia' : 'Sin registro'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-xs text-slate-900">
                    {sesion.titulo_sesion}
                  </h3>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {sesion.fecha_programada}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {String(sesion.hora_inicio).slice(0, 5)} -{' '}
                      {String(sesion.hora_fin).slice(0, 5)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Columna Derecha: Sala de Videollamada Embebida y Pase de Lista */}
          {claseActiva && (
            <div className="lg:col-span-8 p-5 space-y-5">
              {/* Tarjeta de Cabecera de la Sesión */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">
                      {claseActiva.titulo_sesion}
                    </h3>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {claseActiva.codigo_sala_video}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Fecha: <strong>{claseActiva.fecha_programada}</strong> •
                    Horario:{' '}
                    <strong>
                      {String(claseActiva.hora_inicio).slice(0, 5)} a{' '}
                      {String(claseActiva.hora_fin).slice(0, 5)} hrs
                    </strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={generarGoogleCalendarUrl(claseActiva)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#1B396A]" />
                    Añadir a Google Calendar
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {esDocenteTitular && (
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleEstadoSala(claseActiva)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        claseActiva.activa
                          ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {claseActiva.activa
                        ? 'Cerrar Sala Virtual'
                        : 'Reabrir Sala Virtual'}
                    </button>
                  )}
                </div>
              </div>

              {/* Aviso de Asistencia Automática Registrada */}
              {mensajeAsistenciaAuto && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{mensajeAsistenciaAuto}</span>
                </div>
              )}

              {/* Contenedor de la Videollamada Embebida (Jitsi Meet) */}
              {!enVideollamada ? (
                <div className="rounded-2xl bg-[#1B396A] text-white p-8 text-center space-y-4 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto">
                    <Video className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h4 className="font-bold text-base">
                      Sala de Videollamada Institucional Lista
                    </h4>
                    <p className="text-xs text-blue-100">
                      {esDocenteTitular
                        ? 'Inicia la transmisión embebida para impartir tu clase y supervisar la asistencia en tiempo real.'
                        : 'Al hacer clic en "Entrar a la Clase Virtual", tu asistencia se registrará automáticamente en la lista del docente.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={!claseActiva.activa && !esDocenteTitular}
                      onClick={handleUnirseSala}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md transition-all"
                    >
                      <Video className="w-4 h-4" />
                      {esDocenteTitular
                        ? 'Iniciar Videollamada en ClassITSCe'
                        : 'Entrar a la Clase Virtual (Registrar Asistencia)'}
                    </button>

                    <a
                      href={claseActiva.url_sala_video}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15"
                    >
                      Abrir en pestaña externa{' '}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-t-2xl">
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      Conectado a {claseActiva.codigo_sala_video}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnVideollamada(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      Salir de la Sala
                    </button>
                  </div>
                  <div
                    ref={jitsiContainerRef}
                    className="w-full min-h-[460px] bg-slate-950 rounded-b-2xl overflow-hidden border border-slate-800"
                  />
                </div>
              )}

              {/* Lista de Asistencia en Tiempo Real (Exclusivo Vista Docente) */}
              {esDocenteTitular && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#1B396A]" />
                      <h4 className="font-bold text-xs text-slate-900 uppercase">
                        Pase de Lista de la Sesión ({asistenciasDeLaClase.filter((a) => a.presente).length}/{matriculas.length} presentes)
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Se actualiza automáticamente o puedes marcar manualmente
                    </span>
                  </div>

                  {matriculas.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No hay estudiantes matriculados en el grupo para tomar
                      asistencia.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase bg-white">
                            <th className="py-2.5 px-4">Estudiante</th>
                            <th className="py-2.5 px-4">Estado</th>
                            <th className="py-2.5 px-4">Origen / Hora</th>
                            <th className="py-2.5 px-4 text-right">
                              Control Manual Docente
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {matriculas.map((m: any) => {
                            const alumno = m.profiles;
                            const reg = mapaAsistenciaPorAlumno.get(alumno?.id);
                            const estaPresente = reg?.presente === true;

                            return (
                              <tr
                                key={m.id}
                                className="hover:bg-slate-50/80 transition-colors"
                              >
                                <td className="py-3 px-4 font-semibold text-slate-900">
                                  {alumno?.nombre_completo}
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    {alumno?.email}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {estaPresente ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />{' '}
                                      Presente
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      <XCircle className="w-3 h-3" /> Ausente
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-[11px] text-slate-500">
                                  {reg ? (
                                    <>
                                      <span className="font-medium text-slate-700">
                                        {reg.origen === 'virtual_auto'
                                          ? 'Automática (Video)'
                                          : 'Manual (Docente)'}
                                      </span>{' '}
                                      •{' '}
                                      {new Date(
                                        reg.hora_registro
                                      ).toLocaleTimeString('es-MX', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </>
                                  ) : (
                                    'Sin conexión'
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right space-x-1.5">
                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={() =>
                                      handleMarcarAsistenciaManual(
                                        alumno.id,
                                        true
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                      estaPresente
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                                    }`}
                                  >
                                    Presente
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={() =>
                                      handleMarcarAsistenciaManual(
                                        alumno.id,
                                        false
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                      reg && !estaPresente
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50'
                                    }`}
                                  >
                                    Falta
                                  </button>
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
        </div>
      )}

      {/* Modal para Programar Nueva Clase Virtual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Programar Clase Virtual
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {stateCrear?.message && (
              <div
                className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  stateCrear.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {stateCrear.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{stateCrear.message}</span>
              </div>
            )}

            <form action={formActionCrear} className="space-y-4 mt-4">
              <input type="hidden" name="grupo_id" value={grupoId} />


              {unidades.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unidad Temática (Opcional)
                  </label>
                  <select
                    name="unidad_id"
                    defaultValue=""
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A] bg-white"
                  >
                    <option value="">— Sin unidad asignada —</option>
                    {unidades.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        U{u.numero_unidad}: {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título o Tema de la Sesión
                </label>
                <input
                  type="text"
                  name="titulo_sesion"
                  required
                  placeholder="Ej. Sesión 1: Revisión de Arquitectura en Tiempo Real"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha Programada
                </label>
                <input
                  type="date"
                  name="fecha_programada"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hora de Inicio
                  </label>
                  <input
                    type="time"
                    name="hora_inicio"
                    required
                    defaultValue="10:00"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hora de Fin
                  </label>
                  <input
                    type="time"
                    name="hora_fin"
                    required
                    defaultValue="11:30"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPendingCrear}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPendingCrear ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creando Sala...
                    </>
                  ) : (
                    'Agendar y Crear Sala'
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