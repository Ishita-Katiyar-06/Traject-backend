import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Shield, Radio, Cpu, Key, ExternalLink } from 'lucide-react';

export interface AnalystProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalystProfileModal: React.FC<AnalystProfileModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Analyst Profile"
      subtitle="Operator identity, clearance credentials, and active telemetry privileges"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/settings');
            }}
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Preferences
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Header Avatar Card */}
        <div className="flex items-center gap-3.5 p-4 rounded-[16px] bg-[#F8FAFD] dark:bg-[#1D232A] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
          <div className="w-12 h-12 rounded-full bg-[#2F65F6]/15 text-[#2F65F6] dark:text-[#93C5FD] border border-[#2F65F6]/30 flex items-center justify-center font-bold text-base">
            AK
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                Analyst AK
              </span>
              <Badge variant="signal" size="sm">
                Active Session
              </Badge>
            </div>
            <p className="text-[12px] text-[#8591A5] dark:text-[#94A3B8] font-medium mt-0.5">
              Lead Intelligence Observer &amp; Triage Analyst
            </p>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-[14px] bg-slate-50/70 dark:bg-[#151A20] border border-slate-100 dark:border-[#252B32]">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1">
              <Shield className="w-3.5 h-3.5 text-[#2F65F6]" />
              Clearance Level
            </div>
            <div className="text-[13px] font-semibold text-[#111727] dark:text-slate-200">
              Tier-1 Analytical Access
            </div>
            <div className="text-[11px] text-[#8591A5] dark:text-slate-400 mt-0.5">
              Unrestricted telemetry &amp; temporal replay
            </div>
          </div>

          <div className="p-3.5 rounded-[14px] bg-slate-50/70 dark:bg-[#151A20] border border-slate-100 dark:border-[#252B32]">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1">
              <Radio className="w-3.5 h-3.5 text-emerald-500" />
              Signal Coverage
            </div>
            <div className="text-[13px] font-semibold text-[#111727] dark:text-slate-200">
              Multi-Channel Ingestion
            </div>
            <div className="text-[11px] text-[#8591A5] dark:text-slate-400 mt-0.5">
              Telegram, Discord &amp; Threads active
            </div>
          </div>

          <div className="p-3.5 rounded-[14px] bg-slate-50/70 dark:bg-[#151A20] border border-slate-100 dark:border-[#252B32]">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              Synthesizer Status
            </div>
            <div className="text-[13px] font-semibold text-[#111727] dark:text-slate-200">
              HDBSCAN + 4G Heuristics
            </div>
            <div className="text-[11px] text-[#8591A5] dark:text-slate-400 mt-0.5">
              Automated coordination &amp; friction analysis
            </div>
          </div>

          <div className="p-3.5 rounded-[14px] bg-slate-50/70 dark:bg-[#151A20] border border-slate-100 dark:border-[#252B32]">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8591A5] dark:text-slate-400 mb-1">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              Auth Mode
            </div>
            <div className="text-[13px] font-semibold text-[#111727] dark:text-slate-200">
              Local Secure Shell
            </div>
            <div className="text-[11px] text-[#8591A5] dark:text-slate-400 mt-0.5">
              Isolated workspace station
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
