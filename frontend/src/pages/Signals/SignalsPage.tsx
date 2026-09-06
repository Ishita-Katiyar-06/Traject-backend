import React from 'react';
import { Radio } from 'lucide-react';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';

export const SignalsPage: React.FC = () => {
  return (
    <PlaceholderPage
      title="Signals Intelligence"
      description="Real-time multi-channel anomaly detection and publication surge tracking."
      icon={Radio}
      category="Signals"
      milestone="Milestone 6 Planned"
    />
  );
};
