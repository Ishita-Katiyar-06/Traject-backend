import React from 'react';

export const EmergingTrendsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-[26px] sm:rounded-[30px] bg-white/95 dark:bg-[#181C22]/95 border border-slate-200/80 dark:border-[#2B323D] p-6 sm:p-7 space-y-4 shadow-xs"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="w-28 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
            <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <div className="w-3/4 h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="w-1/3 h-4 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
          </div>

          {/* Score Box */}
          <div className="p-4 rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] space-y-2">
            <div className="flex justify-between items-center">
              <div className="w-28 h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>

          {/* Signal Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] rounded-[18px]" />
            <div className="h-16 bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] rounded-[18px]" />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-[#252B32]">
            <div className="w-full h-10 bg-[#FAFBFD] dark:bg-[#151921] border border-slate-200/80 dark:border-[#2B323D] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};
