import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, GraduationCap } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';

export default async function EstudianteDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matriculas } = await supabase
    .from('matriculas')
    .select(
      `
      id,
      created_at,
      grupos (
        id,
        nombre,
        clave_materia,
        periodo
      )
    `
    )
    .eq('estudiante_id', user!.id);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">
          Mis Cursos Matriculados
        </h3>
        <p className="text-xs text-slate-500">
          Haz clic en una asignatura para entregar tareas, presentar exámenes y
          consultar tus calificaciones.
        </p>
      </div>

      {!matriculas || matriculas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <GraduationCap className="w-10 h-10 text-[#1B396A] mx-auto mb-3 opacity-80" />
          <h4 className="text-sm font-bold text-slate-800">
            No tienes materias matriculadas todavía
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Solicita a tu docente un enlace de invitación institucional para inscribirte a tu grupo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matriculas.map((m: any) => (
            <Link
              key={m.id}
              href={`/estudiante/grupos/${m.grupos?.id}`}
              className="group bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-[#1B396A] hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative"
            >
              {/* Franja superior decorativa de 4px con degradado institucional */}
              <div className="h-1 w-full bg-gradient-to-r from-[#1B396A] via-blue-600 to-indigo-600 shrink-0" />

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#1B396A] border border-blue-100 uppercase tracking-wider">
                      {m.grupos?.clave_materia}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Inscrito
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#1B396A] transition-colors leading-snug">
                    {m.grupos?.nombre}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Periodo: {m.grupos?.periodo}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-500 font-medium">
                    Grupo activo
                  </span>
                  <span className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-50/80 group-hover:bg-[#1B396A] text-[#1B396A] group-hover:text-white font-semibold text-xs transition-all shadow-2xs">
                    Entrar al aula <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
