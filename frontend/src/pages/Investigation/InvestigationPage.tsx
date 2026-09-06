import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { InvestigationHeader } from '../../components/investigation/InvestigationHeader';
import { SituationSummary } from '../../components/investigation/SituationSummary';
import { AnalysisChain } from '../../components/investigation/AnalysisChain';
import { ContextualPropagationSummary } from '../../components/investigation/ContextualPropagationSummary';
import { AnalystNotes } from '../../components/investigation/AnalystNotes';
import { EvidenceSection } from '../../components/evidence/EvidenceSection';
import { ForesightSection } from '../../components/foresight/ForesightSection';
import { ErrorState } from '../../components/feedback/ErrorState';
import { investigationService } from '../../services/investigationService';
import { evidenceService } from '../../services/evidenceService';
import { foresightService } from '../../services/foresightService';
import { alertService } from '../../services/alertService';
import { InvestigationDetail } from '../../data/mock/investigations';
import { EvidenceItem } from '../../data/mock/evidence';
import { ForesightDetail } from '../../data/mock/foresight';
import { Clock } from 'lucide-react';

export const InvestigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const targetId = id || 'alt-601';

  const [investigation, setInvestigation] = useState<InvestigationDetail | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [foresight, setForesight] = useState<ForesightDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const inv = await investigationService.getInvestigationById(targetId);
      if (inv) {
        setInvestigation(inv);
        const [evList, fore] = await Promise.all([
          evidenceService.getEvidenceByInvestigationId(inv.id),
          foresightService.getForesightByInvestigationId(inv.id),
        ]);
        setEvidenceList(evList);
        setForesight(fore || null);
      } else {
        setIsError(true);
      }
    } catch (e) {
      console.error('Failed to load investigation:', e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetId]);

  const handleAcknowledge = async () => {
    if (!investigation) return;
    await alertService.acknowledgeAlert(investigation.id);
    const updated = await investigationService.updateStatus(investigation.id, 'Acknowledged');
    if (updated) setInvestigation(updated);
  };

  const handleReview = async () => {
    if (!investigation) return;
    await alertService.startReview(investigation.id);
    const updated = await investigationService.updateStatus(investigation.id, 'Under review');
    if (updated) setInvestigation(updated);
  };

  const handleResolve = async () => {
    if (!investigation) return;
    await alertService.resolveAlert(investigation.id);
    const updated = await investigationService.updateStatus(investigation.id, 'Resolved');
    if (updated) setInvestigation(updated);
  };

  const handleAddNote = async (text: string) => {
    if (!investigation) return;
    await investigationService.addNote(investigation.id, text);
    const refreshed = await investigationService.getInvestigationById(investigation.id);
    if (refreshed) setInvestigation(refreshed);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!investigation) return;
    await investigationService.deleteNote(investigation.id, noteId);
    const refreshed = await investigationService.getInvestigationById(investigation.id);
    if (refreshed) setInvestigation(refreshed);
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center font-mono text-small text-text-muted">
        Assembling investigation dossier and corroborating telemetry...
      </div>
    );
  }

  if (isError || !investigation) {
    return (
      <ErrorState
        title="Investigation Dossier Unavailable"
        message="The requested investigation file could not be retrieved from the operational repository."
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* 1. Investigation Header with Actions and Breadcrumbs */}
      <InvestigationHeader
        id={investigation.id}
        title={investigation.title}
        status={investigation.status}
        priority={investigation.priority}
        detectedAt={investigation.detectedAt}
        originSource={investigation.originSource}
        isWatching={isWatching}
        onToggleWatch={() => setIsWatching(!isWatching)}
        onAcknowledge={handleAcknowledge}
        onReview={handleReview}
        onResolve={handleResolve}
      />

      {/* 2. Situation Summary ("Current Picture") */}
      <SituationSummary summary={investigation.situationSummary} />

      {/* 3. What Changed (Analytical Volume Delta) */}
      <section className="space-y-3 font-sans">
        <h3 className="text-section-title text-text-primary">
          Measurable Volume Delta
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
              Previous 6h Baseline
            </div>
            <div className="font-sans text-[22px] font-bold text-[#64748B] mt-1 tracking-tight">
              {investigation.whatChanged.previousVolume.toLocaleString()}
              <span className="text-[12px] font-normal text-[#8591A5] ml-1.5">mentions</span>
            </div>
          </div>

          <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
              Current Observation
            </div>
            <div className="font-sans text-[22px] font-bold text-[#111727] mt-1 tracking-tight">
              {investigation.whatChanged.currentVolume.toLocaleString()}
              <span className="text-[12px] font-normal text-[#8591A5] ml-1.5">mentions</span>
            </div>
          </div>

          <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
              Measured Surge
            </div>
            <div className="font-sans text-[22px] font-bold text-[#FF6D5A] mt-1 tracking-tight">
              +{investigation.whatChanged.changePercent}%
            </div>
          </div>

          <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
              Peak Surge Window
            </div>
            <div className="font-sans text-[15px] text-[#111727] mt-2 flex items-center gap-1.5 font-bold">
              <Clock className="w-4 h-4 text-[#2F65F6]" />
              <span>{investigation.whatChanged.peakPeriod}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Reasoning / Analysis Chain */}
      <AnalysisChain chain={investigation.analysisChain} />

      {/* 5. Evidence Section with Collapsible Captures */}
      <EvidenceSection
        evidenceList={evidenceList}
        summary={investigation.evidenceSummary}
      />

      {/* 6. Contextual Propagation Pathway */}
      <ContextualPropagationSummary topicId={investigation.topicId} />

      {/* 7. Foresight Section */}
      {foresight && <ForesightSection foresight={foresight} />}

      {/* 8. Analyst Working Notes */}
      <AnalystNotes
        notes={investigation.notes}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
      />
    </div>
  );
};
