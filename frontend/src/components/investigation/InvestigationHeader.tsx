import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertPriorityType, AlertStatusType } from '../../data/mock/alerts';
import { AlertStatus } from '../alerts/AlertStatus';
import { AlertPriority } from '../alerts/AlertPriority';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import {
  ArrowLeft,
  Eye,
  Check,
  Play,
  CheckCheck,
  Download,
} from 'lucide-react';

export interface InvestigationHeaderProps {
  id: string;
  title: string;
  status: AlertStatusType;
  priority: AlertPriorityType;
  detectedAt: string;
  originSource?: string;
  isWatching: boolean;
  onToggleWatch: () => void;
  onAcknowledge: () => void;
  onReview: () => void;
  onResolve: () => void;
}

export const InvestigationHeader: React.FC<InvestigationHeaderProps> = ({
  id,
  title,
  status,
  priority,
  detectedAt,
  originSource = 'Alerts',
  isWatching,
  onToggleWatch,
  onAcknowledge,
  onReview,
  onResolve,
}) => {
  const navigate = useNavigate();

  const exportMenuItems = [
    {
      id: 'pdf',
      label: 'Export Investigation Dossier (PDF)',
      onClick: () => console.log('Export PDF for', id),
    },
    {
      id: 'json',
      label: 'Export Normalized Evidence (JSON)',
      onClick: () => console.log('Export JSON for', id),
    },
    {
      id: 'csv',
      label: 'Export Activity Timeline (CSV)',
      onClick: () => console.log('Export CSV for', id),
    },
  ];

  return (
    <div className="space-y-4 font-sans pb-4 border-b border-[rgba(228,233,245,0.85)]">
      {/* Breadcrumb Row */}
      <div className="flex items-center gap-2 text-[13px] font-sans text-[#8591A5]">
        <button
          type="button"
          onClick={() => navigate('/alerts')}
          className="hover:text-[#111727] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{originSource}</span>
        </button>
        <span>/</span>
        <span className="text-[#111727] font-semibold">Investigation {id.toUpperCase()}</span>
      </div>

      {/* Title & Operational Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-bold text-[#111727] tracking-tight leading-tight">
            {title}
          </h1>
          <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[13px] text-[#8591A5]">
            <AlertPriority priority={priority} />
            <span className="text-slate-300">•</span>
            <AlertStatus status={status} />
            <span className="text-slate-300">•</span>
            <span>Detected {detectedAt}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Transitions */}
          {status === 'New' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Check className="w-3.5 h-3.5 text-[#2F65F6]" />}
              onClick={onAcknowledge}
            >
              Acknowledge
            </Button>
          )}

          {status === 'Acknowledged' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5 text-[#FF6D5A]" />}
              onClick={onReview}
            >
              Start Review
            </Button>
          )}

          {status === 'Under review' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={onResolve}
            >
              Resolve
            </Button>
          )}

          {/* Watch Toggle */}
          <Button
            variant={isWatching ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={isWatching ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            onClick={onToggleWatch}
          >
            {isWatching ? 'Watching' : 'Watch'}
          </Button>

          {/* Export Dropdown */}
          <Dropdown
            trigger={
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export
              </Button>
            }
            items={exportMenuItems}
            align="right"
          />
        </div>
      </div>
    </div>
  );
};
