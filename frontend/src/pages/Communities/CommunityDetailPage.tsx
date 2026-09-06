import React from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';

export const CommunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <PlaceholderPage
      title={`Community Network Dossier: ${id || 'Detail'}`}
      description="Detailed channel participation metrics, central nodes, and cross-channel topic overlap."
      icon={Users}
      category="Community Detail"
      milestone="Milestone 6 Planned"
    />
  );
};
