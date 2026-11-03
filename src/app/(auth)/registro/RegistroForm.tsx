'use client';

import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  registrarEstudiantePorInvitacionAction,
  type ActionState,
} from '@/app/(auth)/actions';
import { toTitleCase, toNormalizedEmail } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = {
  success: false,
  message: '',
};

export default function RegistroForm({
  initialToken,
  initialEmail,
}: {
  initialToken: string;
  initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    registrarEstudiantePorInvitacionAction,
    initialState
  );

  const trimmedEmail = email.trim().toLowerCase();
  const isInstitutionalValid =
    trimmedEmail.endsWith('@centla.tecnm.mx') &&
    trimmedEmail.length > '@centla.tecnm.mx'.length;

  return (
    <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
      <div className="flex items-center justify-between mb-5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1B396A] border border-blue-200">
          <UserPlus className="w-3.5 h-3.5" />
          Registro por Invitación Docente
        </span>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Login
        </Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900">
        Alta de Estudiante Institucional
      </h1>
      <p className="text-xs text-slate-500 mt-1 mb-6">
        Completa tu registro con el token proporcionado por tu docente titular.
      </p>

      {state?.message && !state.success && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Token de Invitación (UUID)
          </label>
          <input
            type="text"
            name="token"
            defaultValue={initialToken}
            required
            placeholder="Ej. 550e8400-e29b-41d4-a716-446655440000"
            className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/15 transition-all"
          />
          {state?.errors?.token && (
            <p className="text-[11px] text-red-600 mt-1">
              {state.errors.token[0]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nombre Completo
          </label>
          <input
            type="text"
            name="nombre_completo"
            required
            placeholder="Ej. Luis Fernando Chablé Cruz"
            onBlur={(e) => { e.target.value = toTitleCase(e.target.value); }}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/15 transition-all"
          />
          {state?.errors?.nombre_completo && (
            <p className="text-[11px] text-red-600 mt-1">
              {state.errors.nombre_completo[0]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Correo Institucional Obligatorio
          </label>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => setEmail(toNormalizedEmail(e.target.value))}
            required
            placeholder="matricula@centla.tecnm.mx"
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all ${
              email.length === 0
                ? 'border-slate-300 focus:border-[#1B396A] focus:ring-[#1B396A]/15'
                : isInstitutionalValid
                ? 'border-emerald-400 bg-emerald-50/30 focus:border-emerald-600 focus:ring-emerald-600/15'
                : 'border-red-400 bg-red-50/40 focus:border-red-600 focus:ring-red-600/15'
            }`}
          />
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
            {isInstitutionalValid ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Dominio
                @centla.tecnm.mx verificado correctamente.
              </span>
            ) : (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Debe terminar
                obligatoriamente en @centla.tecnm.mx
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Crear Contraseña (mínimo 8 caracteres)
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/15 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {state?.errors?.password && (
            <p className="text-[11px] text-red-600 mt-1">
              {state.errors.password[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!isInstitutionalValid || isPending}
          className="w-full py-2.5 px-4 bg-[#1B396A] hover:bg-[#152c54] disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creando cuenta y matriculando...
            </>
          ) : (
            'Completar Registro e Ingresar al Grupo'
          )}
        </button>
      </form>
    </div>
  );
}
