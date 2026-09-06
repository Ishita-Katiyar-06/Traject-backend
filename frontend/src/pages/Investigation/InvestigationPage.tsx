import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';

export const InvestigationPage: React.FC = () => {
  return (
    <PlaceholderPage
      title="Investigation Workspace & Evidence Synthesis"
      description="Collaborative analyst case management, multi-source evidence linking, and hypothesis testing."
      icon={ShieldCheck}
      category="Investigation"
      milestone="Milestone 6 Planned"
    />
  );
};
