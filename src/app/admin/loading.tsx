import React from 'react';

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-slate-200 rounded-xl" />
          <div className="h-4 w-80 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-40 bg-slate-200 rounded-xl" />
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
          >
            <div className="h-4 w-24 bg-slate-100 rounded-lg" />
            <div className="h-8 w-16 bg-slate-200 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="h-6 w-40 bg-slate-200 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl border border-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

