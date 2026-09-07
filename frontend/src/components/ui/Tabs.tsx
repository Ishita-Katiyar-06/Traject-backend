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
      className={`flex items-center gap-1 border-b border-border overflow-x-auto ${className}`}
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
            className={`relative flex items-center gap-2 px-3 py-2 text-body-ui font-sans transition-colors duration-fast select-none whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? 'text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-[11px] font-mono px-1.5 py-0.2 rounded-sm ${
                  isActive
                    ? 'bg-signal/20 text-signal border border-signal/30'
                    : 'bg-surface-elevated text-text-secondary'
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <motion.span
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-signal"
                transition={{ type: 'tween', duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
