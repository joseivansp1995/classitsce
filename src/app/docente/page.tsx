import React from 'react';
import Link from 'next/link';
import { BookOpen, Users, KeyRound, ArrowRight, Award } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import CrearGrupoModal from './CrearGrupoModal';
import GestionarGrupoModal from './GestionarGrupoModal';

export default async function DocenteDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: grupos } = await supabase
    .from('grupos')
    .select(
      `
      id,
      nombre,
      clave_materia,
      periodo,
      codigo_acceso,
      calificacion_minima_aprobatoria,
      asistencia_minima_porcentaje,
      activo,
      matriculas ( count )
    `
    )
    .eq('docente_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Mis Grupos Asignados
          </h3>
          <p className="text-xs text-slate-500">
            Selecciona un grupo para invitar alumnos (@centla.tecnm.mx), asignar
            tareas y calificar.
          </p>
        </div>
        <CrearGrupoModal />
      </div>

      {!grupos || grupos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <BookOpen className="w-10 h-10 text-[#1B396A] mx-auto mb-3 opacity-80" />
          <h4 className="text-sm font-bold text-slate-800">
            Aún no has creado ningún grupo académico
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-4">
            Haz clic en el botón para registrar tu primera asignatura y comenzar a invitar estudiantes.
          </p>
          <CrearGrupoModal />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map((g: any) => {
            const totalAlumnos = g.matriculas?.[0]?.count ?? 0;
            return (
              <div
                key={g.id}
                className="group bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-[#1B396A] hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {/* Franja superior decorativa de 4px con degradado institucional */}
                <div className="h-1 w-full bg-gradient-to-r from-[#1B396A] via-blue-600 to-indigo-600 shrink-0" />

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#1B396A] border border-blue-100 uppercase tracking-wider">
                          {g.clave_materia}
                        </span>
                        {g.codigo_acceso && (
                          <span
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded-md border border-slate-200/60"
                            title="Código de acceso del grupo"
                          >
                            <KeyRound className="w-3 h-3 text-slate-400" />
                            {g.codigo_acceso}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {g.periodo}
                        </span>
                        <GestionarGrupoModal grupo={g} />
                      </div>
                    </div>

                    <Link
                      href={`/docente/grupos/${g.id}`}
                      className="block group/title"
                    >
                      <h4 className="font-bold text-slate-900 text-sm group-hover/title:text-[#1B396A] transition-colors leading-snug">
                        {g.nombre}
                      </h4>

                      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                          Mín: {g.calificacion_minima_aprobatoria} pts /{' '}
                          {g.asistencia_minima_porcentaje}% asist.
                        </span>
                      </div>
                    </Link>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#1B396A]" />
                      {totalAlumnos} {totalAlumnos === 1 ? 'alumno' : 'alumnos'}
                    </span>
                    <Link
                      href={`/docente/grupos/${g.id}`}
                      className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-50/80 hover:bg-[#1B396A] text-[#1B396A] hover:text-white font-semibold text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      Gestionar <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tarjeta de acceso rápido con borde punteado para crear nuevo grupo */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:border-[#1B396A] hover:bg-blue-50/30 transition-all min-h-[180px]">
            <div className="p-2.5 rounded-full bg-blue-50 text-[#1B396A] mb-2">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500 max-w-[210px] mb-3 leading-relaxed">
              ¿Impartes otra asignatura este semestre? Crea un nuevo grupo académico
            </p>
            <CrearGrupoModal />
          </div>
        </div>
      )}
    </div>
  );
}
