import React from 'react';

export const EmergingTrendsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-[#12161f]/60 border border-slate-800/60 rounded-xl p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-800 rounded-lg" />
              <div className="w-24 h-5 bg-slate-800 rounded-md" />
            </div>
            <div className="w-16 h-5 bg-slate-800 rounded-md" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="w-3/4 h-5 bg-slate-800 rounded" />
            <div className="w-1/3 h-3 bg-slate-850 rounded" />
          </div>

          {/* Score Box */}
          <div className="bg-slate-900/60 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between">
              <div className="w-28 h-3 bg-slate-800 rounded" />
              <div className="w-12 h-6 bg-slate-800 rounded" />
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full" />
          </div>

          {/* Signal Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="h-14 bg-slate-900/40 rounded-lg" />
            <div className="h-14 bg-slate-900/40 rounded-lg" />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800/60 flex justify-between">
            <div className="w-20 h-4 bg-slate-800 rounded" />
            <div className="w-24 h-4 bg-slate-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
