import React from 'react';
import {
  Users,
  BookOpen,
  GraduationCap,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import AltaDocenteModal from './AltaDocenteModal';

function getInitials(nombre?: string) {
  if (!nombre) return 'D';
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Consultas reales en paralelo a Supabase
  const [
    { data: docentes },
    { count: totalEstudiantes },
    { count: totalGrupos },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre_completo, email, activo, created_at')
      .eq('rol', 'docente')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'estudiante'),
    supabase.from('grupos').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Docentes Registrados
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {docentes?.length || 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1B396A] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Estudiantes (@centla.tecnm.mx)
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {totalEstudiantes || 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Grupos Activos</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {totalGrupos || 0}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Candado Ético Activo - Barra ejecutiva institucional */}
      <div
        id="seguridad"
        className="bg-gradient-to-r from-slate-900 to-[#1B396A] text-white rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 text-amber-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Candado Ético de Calificaciones Activo
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Integridad garantizada: solo el docente titular del grupo puede asentar notas (protegido por <code className="bg-white/10 px-1 py-0.5 rounded text-[11px] text-amber-300 font-mono">trg_candado_etico_entregas</code>).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Trigger & RLS Activos en PostgreSQL
          </span>
        </div>
      </div>

      {/* Tabla de Docentes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Plantilla Docente Institucional
            </h3>
            <p className="text-xs text-slate-500">
              El Administrador da de alta a los Docentes para que puedan crear
              grupos e invitar alumnos.
            </p>
          </div>
          <AltaDocenteModal />
        </div>

        {!docentes || docentes.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              Aún no hay docentes registrados
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Usa el botón &ldquo;Registrar Nuevo Docente&rdquo; para dar de alta al
              primer profesor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Docente</th>
                  <th className="py-3.5 px-4">Correo Electrónico</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-5 text-right">Fecha de Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {docentes.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1B396A] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                          {getInitials(doc.nombre_completo)}
                        </div>
                        <span className="font-semibold text-slate-900">
                          {doc.nombre_completo}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-mono text-[11px]">
                      {doc.email}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Activo
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
