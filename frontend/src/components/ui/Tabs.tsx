import React from 'react';
import { motion } from 'motion/react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-[#181C22]/90 border border-slate-200/90 dark:border-[#2B323D] p-1 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium rounded-full transition-colors duration-150 select-none whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              isActive
                ? 'text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            {/* Smooth animated active pill capsule */}
            {isActive && (
              <motion.span
                layoutId="activeTabPill"
                className="absolute inset-0 rounded-full bg-[#21252C] dark:bg-[#282E37] shadow-xs z-0"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}

            <span className="relative z-10">{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`relative z-10 text-[10.5px] font-mono font-bold px-1.5 py-0.2 rounded-full leading-tight transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
