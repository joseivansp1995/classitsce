import React from 'react';

export default function DocenteGrupoLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Banner / Header Skeleton */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 bg-slate-200 rounded-lg" />
              <div className="h-5 w-20 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-7 w-64 bg-slate-200 rounded-xl" />
            <div className="h-4 w-40 bg-slate-100 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-slate-200 rounded-xl" />
            <div className="h-9 w-32 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tabs Nav Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200/80">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-10 w-28 bg-slate-100 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Main Content Workspace Skeleton */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded-lg" />
        <div className="h-64 rounded-xl bg-slate-50 border border-slate-100" />
      </div>
    </div>
  );
}
