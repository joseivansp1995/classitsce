'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  Video,
  Award,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  LayoutGrid,
} from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import type { UserProfile } from '@/types/database';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  tabMatch?: string;
}

const ROLE_BADGE: Record<
  UserProfile['rol'],
  { label: string; classes: string; dotClass: string }
> = {
  admin: {
    label: 'Administrador General',
    classes: 'bg-purple-50 text-purple-700 border-purple-200/80 shadow-2xs',
    dotClass: 'bg-purple-500',
  },
  docente: {
    label: 'Docente Titular',
    classes: 'bg-blue-50 text-[#1B396A] border-blue-200/80 shadow-2xs',
    dotClass: 'bg-[#1B396A]',
  },
  estudiante: {
    label: 'Estudiante Institucional',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs',
    dotClass: 'bg-emerald-500',
  },
};

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardShell({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'resumen';
  const [mobileOpen, setMobileOpen] = useState(false);

  // Detectar si el Docente o Estudiante se encuentra dentro de un grupo específico
  const isInsideGroup =
    pathname.startsWith('/docente/grupos/') ||
    pathname.startsWith('/estudiante/grupos/');

  const getNavItems = (): NavItem[] => {
    if (profile.rol === 'admin') {
      return [
        { label: 'Plantilla Docente', href: '/admin', icon: Users },
        { label: 'Candado Ético RLS', href: '/admin#seguridad', icon: ShieldCheck },
      ];
    }

    const baseHome = profile.rol === 'docente' ? '/docente' : '/estudiante';
    const homeLabel =
      profile.rol === 'docente' ? 'Todos Mis Grupos' : 'Todos Mis Cursos';

    if (!isInsideGroup) {
      return [{ label: homeLabel, href: baseHome, icon: LayoutDashboard }];
    }

    // Si está dentro de un grupo, mostrar accesos sincronizados a cada pestaña
    return [
      { label: `← ${homeLabel}`, href: baseHome, icon: BookOpen },
      {
        label: 'Tablón y Resumen',
        href: `${pathname}?tab=resumen`,
        icon: LayoutGrid,
        tabMatch: 'resumen',
      },
      {
        label:
          profile.rol === 'docente'
            ? 'Trabajo y Calificaciones'
            : 'Tareas y Evaluaciones',
        href: `${pathname}?tab=evaluacion`,
        icon: ClipboardCheck,
        tabMatch: 'evaluacion',
      },
      {
        label: 'Material y Foro',
        href: `${pathname}?tab=comunidad`,
        icon: MessageSquare,
        tabMatch: 'comunidad',
      },
      {
        label: 'Sala Virtual y Asistencia',
        href: `${pathname}?tab=clases`,
        icon: Video,
        tabMatch: 'clases',
      },
      {
        label:
          profile.rol === 'docente'
            ? 'Alumnos y Constancias'
            : 'Mi Constancia QR',
        href: `${pathname}?tab=constancias`,
        icon: Award,
        tabMatch: 'constancias',
      },
    ];
  };

  const navItems = getNavItems();
  const badge = ROLE_BADGE[profile.rol];
  const userInitials = getInitials(profile.nombre_completo);

  // Contenido compartido del Sidebar (navegación y pie)
  const renderSidebarContent = () => (
    <>
      <div>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white leading-none">
                ClassITSCe
              </h1>
              <p className="text-[11px] text-blue-200 mt-1 font-medium">
                TecNM Campus Centla
              </p>
            </div>
          </div>
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300/80 px-3 mb-2">
            {isInsideGroup ? 'Secciones del Aula' : 'Panel Principal'}
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.tabMatch
                ? activeTab === item.tabMatch
                : pathname === item.href && !searchParams.get('tab');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-[#1B396A] font-bold shadow-xs'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1B396A]' : 'text-blue-200'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Pie del Sidebar con Avatar, Datos y Logout */}
      <div className="p-4 border-t border-white/10 bg-[#152d54]/90">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-xs border border-white/25 shrink-0 shadow-xs">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate" title={profile.nombre_completo}>
              {profile.nombre_completo}
            </p>
            <p className="text-[11px] text-blue-200 truncate" title={profile.email}>
              {profile.email}
            </p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-red-500/25 hover:text-red-200 text-xs text-blue-100 font-semibold flex items-center justify-center gap-2 transition-colors border border-white/10 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#F8FAFC] flex flex-col lg:flex-row lg:overflow-hidden text-slate-900">
      {/* 1. Sidebar Fijo de Escritorio */}
      <aside className="hidden lg:flex h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto z-40 bg-[#1B396A] text-white border-r border-blue-900/50 shadow-lg">
        {renderSidebarContent()}
      </aside>

      {/* Sidebar Móvil (Drawer flotante) - Renderizado estrictamente cuando mobileOpen === true */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex pointer-events-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-[#1B396A] text-white flex flex-col justify-between overflow-y-auto z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* 2. Contenedor Principal (Navbar + Main Canvas) */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 lg:h-screen lg:overflow-hidden min-w-0 bg-[#F8FAFC]">
        {/* Navbar Superior */}
        <header className="sticky top-0 lg:static min-h-16 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-0 flex items-center justify-between z-20 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden relative z-50 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer shadow-2xs"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight truncate">
                {profile.nombre_completo}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
                Plataforma Académica Institucional • TecNM Campus Centla
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold border ${badge.classes}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
              <ShieldCheck className="w-3.5 h-3.5" />
              {badge.label}
            </span>

            <div className="flex items-center gap-2 sm:gap-2.5 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1B396A] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-2xs shrink-0">
                {userInitials}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]">
                  {profile.nombre_completo}
                </p>
                <p className="text-[10px] text-slate-400 font-medium capitalize">
                  {profile.rol}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* 3. Área de Contenido con Scroll Vertical Nativo y Fluido */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
