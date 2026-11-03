import React from 'react';

export default function DocenteLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-xl" />
          <div className="h-4 w-72 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
          >
            <div className="h-4 w-28 bg-slate-100 rounded-lg" />
            <div className="h-8 w-16 bg-slate-200 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Groups Grid Skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-36 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-6 w-20 bg-slate-100 rounded-lg" />
                <div className="h-6 w-12 bg-slate-100 rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-slate-200 rounded-lg" />
                <div className="h-3 w-1/2 bg-slate-100 rounded-md" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="h-4 w-24 bg-slate-100 rounded-md" />
                <div className="h-8 w-20 bg-slate-200 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

