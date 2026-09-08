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
      className={`flex items-center gap-1 border-b border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] overflow-x-auto ${className}`}
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
            className={`relative flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-sans transition-colors duration-fast select-none whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isActive
                ? 'text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
                : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#111727] dark:hover:text-white hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] rounded-t-lg'
              }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${isActive
                    ? 'bg-[#2F65F6]/10 text-[#2F65F6] dark:text-[#93C5FD] border border-[#2F65F6]/25'
                    : 'bg-[#E5E9F4] dark:bg-[#191F26] text-[#475569] dark:text-[#94A3B8]'
                  }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.span
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2F65F6] dark:bg-[#5878C7]"
                transition={{ type: 'tween', duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
