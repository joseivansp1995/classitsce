'use client';

import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { loginAction, type ActionState } from '@/app/(auth)/actions';
import { toNormalizedEmail } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = {
  success: false,
  message: '',
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Columna Institucional */}
        <div className="md:col-span-5 bg-[#1B396A] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-medium mb-6">
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <span>TecNM Campus Centla</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">
              Plataforma Académica ClassITSCe
            </h1>
            <p className="text-sm text-blue-100 leading-relaxed">
              Control de grupos, asistencia en videollamadas, tareas,
              evaluaciones y expedición de constancias con validación QR.
            </p>
          </div>

          <div className="space-y-3 relative z-10 mt-8 pt-6 border-t border-white/15 text-xs text-blue-100">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Candado Ético RLS:</strong> Calificaciones protegidas a
                nivel PostgreSQL exclusivamente para el docente titular.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Dominio Institucional:</strong> Acceso estudiantil
                restringido a cuentas <code>@centla.tecnm.mx</code>.
              </span>
            </div>
          </div>
        </div>

        {/* Columna de Formulario */}
        <div className="md:col-span-7 p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Iniciar Sesión Institucional
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa tus credenciales para acceder a tu panel correspondiente.
            </p>
          </div>

          {state?.message && !state.success && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="usuario@centla.tecnm.mx"
                  onBlur={(e) => { e.target.value = toNormalizedEmail(e.target.value); }}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/15 transition-all"
                />
              </div>
              {state?.errors?.email && (
                <p className="text-[11px] text-red-600 mt-1">
                  {state.errors.email[0]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-[#1B396A] focus:ring-2 focus:ring-[#1B396A]/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
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
              disabled={isPending}
              className="w-full py-2.5 px-4 bg-[#1B396A] hover:bg-[#152c54] disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando sesión y rol...
                </>
              ) : (
                'Ingresar a ClassITSCe'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>¿Recibiste invitación de tu docente?</span>
            <Link
              href="/registro"
              className="text-[#1B396A] font-semibold hover:underline"
            >
              Validar token de invitación →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
