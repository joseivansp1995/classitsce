import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Calendar,
  Award,
  Hash,
} from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/server';

export default async function VerificarConstanciaPublicaPage({
  params,
}: {
  params: Promise<{ folio: string }>;
}) {
  const { folio } = await params;
  const decodedFolio = decodeURIComponent(folio).trim().toUpperCase();

  // Usamos cliente con privilegios de servicio para validar de forma pública sin requerir sesión
  const supabase = createAdminClient();

  const { data: constancia } = await supabase
    .from('constancias')
    .select(
      `
      id,
      folio,
      promedio_final,
      porcentaje_asistencia,
      hash_verificacion,
      fecha_emision,
      estudiante:estudiante_id (
        nombre_completo,
        email
      ),
      grupo:grupo_id (
        nombre,
        clave_materia,
        periodo,
        docente:docente_id (
          nombre_completo
        )
      )
    `
    )
    .eq('folio', decodedFolio)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Franja superior decorativa institucional */}
        <div className="h-1 w-full bg-gradient-to-r from-[#1B396A] via-blue-600 to-indigo-600 shrink-0" />

        {/* Encabezado Institucional */}
        <div className="bg-[#1B396A] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight">
                Verificador Oficial de Constancias QR
              </h1>
              <p className="text-xs text-blue-200">
                ClassITSCe • Tecnológico Nacional de México Campus Centla
              </p>
            </div>
          </div>
          <ShieldCheck className="w-7 h-7 text-amber-400 shrink-0" />
        </div>

        {!constancia ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Folio No Encontrado ({decodedFolio})
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No existe ninguna constancia académica registrada en ClassITSCe
              con este número de folio. Verifica que el código QR sea legítimo.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-emerald-950">
                  Documento Auténtico y Vigente
                </h2>
                <p className="text-xs text-emerald-800">
                  Esta constancia fue emitida y certificada oficialmente por la plataforma
                  académica ClassITSCe.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Folio Oficial
                </span>
                <span className="font-mono font-bold text-sm text-[#1B396A]">
                  {constancia.folio}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Fecha de Emisión
                </span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1B396A]" />
                  {new Date(constancia.fecha_emision).toLocaleDateString(
                    'es-MX',
                    {
                      dateStyle: 'long',
                    }
                  )}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-3 text-xs bg-white">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Estudiante Acreditado
                </span>
                <p className="font-bold text-sm text-slate-900 mt-0.5">
                  {(constancia.estudiante as any)?.nombre_completo}
                </p>
                <p className="text-slate-500 font-mono text-[11px]">
                  {(constancia.estudiante as any)?.email}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                  Asignatura / Curso Acreditado
                </span>
                <p className="font-bold text-sm text-[#1B396A] mt-0.5">
                  {(constancia.grupo as any)?.nombre} (
                  {(constancia.grupo as any)?.clave_materia})
                </p>
                <p className="text-slate-500 mt-0.5">
                  Periodo: {(constancia.grupo as any)?.periodo} • Docente Titular:{' '}
                  <strong>
                    {(constancia.grupo as any)?.docente?.nombre_completo}
                  </strong>
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Promedio Final: {constancia.promedio_final} / 100
                </span>
                <span className="font-semibold text-slate-700">
                  Asistencia: {constancia.porcentaje_asistencia}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 font-mono flex items-center gap-2 break-all">
              <Hash className="w-4 h-4 text-slate-400 shrink-0" />
              <span>UUID: {constancia.hash_verificacion}</span>
            </div>
          </div>
        )}

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Verificación criptográfica en tiempo real</span>
          <Link
            href="/login"
            className="text-[#1B396A] font-semibold hover:underline"
          >
            Ir a ClassITSCe →
          </Link>
        </div>
      </div>
    </div>
  );
}
