import React from 'react';
import { useParams } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';

export const SignalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <PlaceholderPage
      title={`Signal Inspection: ${id || 'Detail'}`}
      description="In-depth signal telemetry, cross-channel timeline, and source channel attribution."
      icon={Radio}
      category="Signal Detail"
      milestone="Milestone 6 Planned"
    />
  );
};
