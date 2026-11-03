'use client';

import React, { useState, useActionState, useTransition } from 'react';
import {
  MessageSquare,
  Plus,
  Pin,
  Lock,
  Unlock,
  Reply,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  crearTemaForoAction,
  toggleCerrarTemaForoAction,
  crearComentarioForoAction,
} from '@/app/actions/comunidad';
import type { ActionState } from '@/app/(auth)/actions';

const initialState: ActionState = { success: false, message: '' };

export default function ModuloForoGrupo({
  grupoId,
  esDocenteTitular,
  temas,
  comentarios,
}: {
  grupoId: string;
  esDocenteTitular: boolean;
  temas: any[];
  comentarios: any[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [temaActivoId, setTemaActivoId] = useState<string | null>(
    temas[0]?.id || null
  );
  const [replyToComment, setReplyToComment] = useState<any | null>(null);
  const [isToggling, startToggleTransition] = useTransition();

  const [stateTema, formActionTema, isPendingTema] = useActionState(
    crearTemaForoAction,
    initialState
  );

  const [stateComentario, formActionComentario, isPendingComentario] =
    useActionState(crearComentarioForoAction, initialState);

  const temaActivo =
    temas.find((t) => t.id === temaActivoId) || temas[0] || null;

  const comentariosDelTema = temaActivo
    ? comentarios.filter((c) => c.tema_id === temaActivo.id)
    : [];

  const comentariosRaiz = comentariosDelTema.filter(
    (c) => !c.comentario_padre_id
  );
  const respuestasPorPadre = (padreId: string) =>
    comentariosDelTema.filter((c) => c.comentario_padre_id === padreId);

  const handleToggleLock = (tema: any) => {
    startToggleTransition(async () => {
      await toggleCerrarTemaForoAction(tema.id, grupoId, !tema.cerrado);
    });
  };

  return (
    <div
      id="foro"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Encabezado del Foro */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#1B396A]" />
            <h2 className="font-bold text-sm text-slate-900">
              Foro de Discusión y Debate Académico ({temas.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            El docente titular abre los temas de discusión y los estudiantes
            debaten entre sí.
          </p>
        </div>

        {esDocenteTitular && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Abrir Entrada en el Foro
          </button>
        )}
      </div>

      {temas.length === 0 ? (
        <div className="p-10 text-center">
          <MessageSquare className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">
            Aún no hay debates abiertos en este grupo
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {esDocenteTitular
              ? 'Haz clic en "Abrir Entrada en el Foro" para iniciar la primera discusión con tus alumnos.'
              : 'Cuando tu docente publique un tema de debate, aparecerá aquí para que puedas participar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Columna Izquierda: Lista de Entradas del Docente */}
          <div className="lg:col-span-4 divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {temas.map((t) => {
              const selected = temaActivo?.id === t.id;
              const numComentarios = comentarios.filter(
                (c) => c.tema_id === t.id
              ).length;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemaActivoId(t.id);
                    setReplyToComment(null);
                  }}
                  className={`w-full text-left p-4 transition-colors space-y-1.5 ${
                    selected
                      ? 'bg-blue-50/70 border-l-4 border-[#1B396A]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {t.fijado && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Pin className="w-2.5 h-2.5" /> Fijado
                        </span>
                      )}
                      {t.cerrado && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                          <Lock className="w-2.5 h-2.5" /> Cerrado
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {numComentarios} coment.
                    </span>
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 line-clamp-2">
                    {t.titulo}
                  </h3>

                  <p className="text-[11px] text-slate-500">
                    Publicado el{' '}
                    {new Date(t.created_at).toLocaleDateString('es-MX')}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Columna Derecha: Hilo de Debate Activo */}
          {temaActivo && (
            <div className="lg:col-span-8 p-5 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                {/* Planteamiento Principal del Docente */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1B396A]">
                      Planteamiento del Docente •{' '}
                      {temaActivo.profiles?.nombre_completo}
                    </span>

                    {esDocenteTitular && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleLock(temaActivo)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {temaActivo.cerrado ? (
                          <>
                            <Unlock className="w-3 h-3 text-emerald-600" />
                            Reabrir Debate
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-amber-600" />
                            Cerrar Debate
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900">
                    {temaActivo.titulo}
                  </h3>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {temaActivo.contenido}
                  </p>
                </div>

                {/* Hilos de Comentarios y Respuestas */}
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {comentariosRaiz.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-6">
                      Sé el primero en comentar y abrir el debate en este hilo.
                    </p>
                  ) : (
                    comentariosRaiz.map((com) => {
                      const respuestas = respuestasPorPadre(com.id);
                      const esDocenteAutor = com.profiles?.rol === 'docente';

                      return (
                        <div key={com.id} className="space-y-2">
                          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">
                                  {com.profiles?.nombre_completo}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    esDocenteAutor
                                      ? 'bg-blue-50 text-[#1B396A]'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {esDocenteAutor ? 'Docente' : 'Estudiante'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {new Date(com.created_at).toLocaleString(
                                  'es-MX',
                                  {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  }
                                )}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700">
                              {com.contenido}
                            </p>

                            {!temaActivo.cerrado && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => setReplyToComment(com)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B396A] hover:underline"
                                >
                                  <Reply className="w-3 h-3" />
                                  Responder a {com.profiles?.nombre_completo}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Respuestas Anidadas al Comentario */}
                          {respuestas.length > 0 && (
                            <div className="pl-6 space-y-2 border-l-2 border-slate-200 ml-3">
                              {respuestas.map((resp) => (
                                <div
                                  key={resp.id}
                                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-xs text-slate-900">
                                        {resp.profiles?.nombre_completo}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                          resp.profiles?.rol === 'docente'
                                            ? 'bg-blue-50 text-[#1B396A]'
                                            : 'bg-emerald-50 text-emerald-700'
                                        }`}
                                      >
                                        {resp.profiles?.rol === 'docente'
                                          ? 'Docente'
                                          : 'Estudiante'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(resp.created_at).toLocaleString(
                                        'es-MX',
                                        {
                                          dateStyle: 'short',
                                          timeStyle: 'short',
                                        }
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-700">
                                    {resp.contenido}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Caja para Publicar Comentario o Respuesta */}
              {temaActivo.cerrado ? (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-center text-xs text-slate-600 font-medium flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Este tema de debate ha sido cerrado por el docente titular.
                </div>
              ) : (
                <form
                  action={formActionComentario}
                  className="pt-3 border-t border-slate-200 space-y-2"
                >
                  <input type="hidden" name="grupo_id" value={grupoId} />
                  <input type="hidden" name="tema_id" value={temaActivo.id} />
                  <input
                    type="hidden"
                    name="comentario_padre_id"
                    value={replyToComment?.id || ''}
                  />

                  {replyToComment && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-blue-50 text-[#1B396A] text-[11px] font-medium">
                      <span>
                        Respondiendo en hilo a{' '}
                        <strong>
                          {replyToComment.profiles?.nombre_completo}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyToComment(null)}
                        className="hover:underline font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="contenido"
                      required
                      placeholder={
                        replyToComment
                          ? 'Escribe tu respuesta al compañero...'
                          : 'Escribe tu aportación o argumento en el debate...'
                      }
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                    />
                    <button
                      type="submit"
                      disabled={isPendingComentario}
                      className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                    >
                      {isPendingComentario ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Comentar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal para que el Docente abra una nueva entrada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Nueva Entrada de Debate
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {stateTema?.message && (
              <div
                className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  stateTema.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {stateTema.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{stateTema.message}</span>
              </div>
            )}

            <form action={formActionTema} className="space-y-4 mt-4">
              <input type="hidden" name="grupo_id" value={grupoId} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título o Pregunta Detonadora
                </label>
                <input
                  type="text"
                  name="titulo"
                  required
                  placeholder="Ej. ¿Cuándo conviene usar RLS frente a lógica en backend?"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contexto e Instrucciones del Debate
                </label>
                <textarea
                  name="contenido"
                  rows={4}
                  required
                  placeholder="Explica las reglas de participación para los alumnos..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="fijado"
                  className="rounded accent-[#1B396A]"
                />
                Fijar este tema al inicio del foro
              </label>

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
                  disabled={isPendingTema}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPendingTema ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    'Publicar Debate'
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