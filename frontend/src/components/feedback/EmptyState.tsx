import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center border border-[rgba(228,233,245,0.85)] rounded-[26px] bg-white shadow-dashboard ${className}`}
    >
      <div className="w-12 h-12 rounded-[16px] bg-[#F1F4F9] flex items-center justify-center text-[#8591A5] mb-3.5 shadow-xs">
        {icon || <Inbox className="w-5 h-5 text-[#8591A5]" />}
      </div>
      <h4 className="text-[15px] font-bold font-sans text-[#111727]">{title}</h4>
      {description && (
        <p className="text-[13px] text-[#8591A5] max-w-sm mt-1 mb-4 font-normal">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
