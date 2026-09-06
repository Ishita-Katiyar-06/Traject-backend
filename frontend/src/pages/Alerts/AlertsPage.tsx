import React from 'react';
import { AlertCircle } from 'lucide-react';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';

export const AlertsPage: React.FC = () => {
  return (
    <PlaceholderPage
      title="Alert Triage & Escalation"
      description="Automated priority alert management, threshold breach monitoring, and analyst routing."
      icon={AlertCircle}
      category="Alerts"
      milestone="Milestone 6 Planned"
    />
  );
};
