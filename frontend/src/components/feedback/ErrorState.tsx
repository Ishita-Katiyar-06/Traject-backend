import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load telemetry data',
  message = 'A connection or retrieval issue occurred while fetching stream records. Verify service status.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center border border-rose-200 rounded-[26px] bg-white shadow-dashboard ${className}`}
    >
      <div className="w-12 h-12 rounded-[16px] bg-rose-50 border border-rose-200/80 flex items-center justify-center text-[#C0503E] mb-3.5 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-[#C0503E]" />
      </div>
      <h4 className="text-[15px] font-bold font-sans text-[#111727]">{title}</h4>
      <p className="text-[13px] text-[#8591A5] max-w-sm mt-1 mb-4 font-normal">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Retry request
        </Button>
      )}
    </div>
  );
};
