import React from 'react';
import { PlatformMigrationSummary } from '../../data/mock/propagation';
import { Radio } from 'lucide-react';

export interface PlatformMigrationCardProps {
  migration: PlatformMigrationSummary;
  className?: string;
}

export const PlatformMigrationCard: React.FC<PlatformMigrationCardProps> = ({
  migration,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#2F65F6]" />
          <h4 className="text-[16px] font-bold text-[#111727]">
            Platform Migration Progression
          </h4>
        </div>
        <span className="font-mono text-[11px] text-[#8591A5]">
          {migration.period}
        </span>
      </div>

      {/* Relative Share Bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#EEF1F8] border border-[rgba(228,233,245,0.8)] p-[1px]">
        <div
          style={{ width: `${migration.xShare}%` }}
          className="bg-[#111727] rounded-l-full transition-all duration-normal"
          title={`X: ${migration.xShare}%`}
        />
        <div
          style={{ width: `${migration.telegramShare}%` }}
          className="bg-[#2F65F6] rounded-r-full transition-all duration-normal"
          title={`Telegram: ${migration.telegramShare}%`}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-[12px]">
        <span className="text-[#111727] font-medium">X Share: {migration.xShare}%</span>
        <span className="text-[#2F65F6] font-medium">Telegram Share: {migration.telegramShare}%</span>
      </div>

      <p className="text-[12px] text-[#475569] font-sans pt-2 border-t border-[rgba(228,233,245,0.8)] leading-relaxed">
        {migration.observedMovement}
      </p>
    </div>
  );
};
