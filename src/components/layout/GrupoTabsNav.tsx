'use client';

import React from 'react';
import {
  LayoutGrid,
  Users,
  ClipboardCheck,
  MessageSquare,
  Video,
  Award,
} from 'lucide-react';

export type GrupoTabKey =
  | 'resumen'
  | 'estudiantes'
  | 'evaluacion'
  | 'comunidad'
  | 'clases'
  | 'constancias';

interface TabItem {
  key: GrupoTabKey;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export default function GrupoTabsNav({
  esDocente,
  activeTab,
  onSelectTab,
  counts,
}: {
  esDocente: boolean;
  activeTab: GrupoTabKey;
  onSelectTab: (tab: GrupoTabKey) => void;
  counts: {
    estudiantes: number;
    actividades: number;
    comunidad: number;
    clasesActivas: number;
    constancias: number;
  };
}) {
  const tabs: TabItem[] = [
    {
      key: 'resumen',
      label: 'Resumen',
      icon: LayoutGrid,
    },
    ...(esDocente
      ? [
          {
            key: 'estudiantes' as GrupoTabKey,
            label: 'Estudiantes 360°',
            icon: Users,
            badge: counts.estudiantes,
          },
        ]
      : []),
    {
      key: 'evaluacion',
      label: esDocente ? 'Tareas y Exámenes' : 'Mis Tareas y Exámenes',
      icon: ClipboardCheck,
      badge: counts.actividades,
    },
    {
      key: 'comunidad',
      label: 'Material y Foro',
      icon: MessageSquare,
      badge: counts.comunidad,
    },
    {
      key: 'clases',
      label: 'Sala Virtual',
      icon: Video,
      badge: counts.clasesActivas,
    },
    {
      key: 'constancias',
      label: 'Constancias QR',
      icon: Award,
      badge: counts.constancias,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white px-2 sm:px-4 pt-1 overflow-x-auto whitespace-nowrap pb-1.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <nav className="flex items-center gap-1 min-w-max" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectTab(tab.key)}
              className={`group relative inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold transition-all border-b-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'border-[#1B396A] text-[#1B396A]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors shrink-0 ${
                  isActive
                    ? 'text-[#1B396A]'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span>{tab.label}</span>

              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                    isActive
                      ? 'bg-[#1B396A] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
