'use client';

import React, { useState, useActionState } from 'react';
import {
  UserPlus,
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { invitarEstudianteGrupoAction } from '../../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { copyToClipboard } from '@/utils/dom/clipboard';

const initialState: ActionState = {
  success: false,
  message: '',
};

export default function InvitarEstudianteModal({
  grupoId,
  nombreGrupo,
}: {
  grupoId: string;
  nombreGrupo: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const [state, formAction, isPending] = useActionState(
    invitarEstudianteGrupoAction,
    initialState
  );

  const isInstitutional =
    email.trim().toLowerCase().endsWith('@centla.tecnm.mx') &&
    email.trim().length > '@centla.tecnm.mx'.length;

  const linkGenerado = state?.data?.linkInvitacion as string | undefined;
  const tokenGenerado = state?.data?.token as string | undefined;

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        <span>Invitar Estudiante</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#1B396A]" />
                <h3 className="font-bold text-base text-slate-900">
                  Invitar Estudiante al Grupo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Asignatura: <strong className="text-slate-800">{nombreGrupo}</strong>
            </p>

            {state?.message && (
              <div
                className={`mt-4 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
                  state.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {state.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{state.message}</span>
              </div>
            )}

            {/* Si se generó un link para un alumno nuevo, mostrar caja para copiar */}
            {state?.success && linkGenerado && (
              <div className="mt-4 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                <p className="text-[11px] font-bold text-[#1B396A] uppercase">
                  Enlace de Invitación Generado:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={linkGenerado}
                    className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-white border border-blue-200 rounded-lg text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(linkGenerado)}
                    className="px-3 py-1.5 rounded-lg bg-[#1B396A] text-white text-xs font-semibold flex items-center gap-1 shrink-0 hover:bg-[#152c54] cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600">
                  Token UUID: <code className="font-mono">{tokenGenerado}</code>
                </p>
              </div>
            )}

            <form action={formAction} className="space-y-4 mt-4">
              <input type="hidden" name="grupo_id" value={grupoId} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo Institucional del Alumno
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="email"
                    name="email_estudiante"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="l22180001@centla.tecnm.mx"
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B396A]"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Si el estudiante ya tiene cuenta en ClassITSCe quedará inscrito de
                  inmediato; si es nuevo, obtendrás su link de registro.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={!isInstitutional || isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Enviar / Generar Invitación'
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
