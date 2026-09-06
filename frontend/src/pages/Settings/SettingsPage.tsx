import React from 'react';
import { Settings } from 'lucide-react';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';

export const SettingsPage: React.FC = () => {
  return (
    <PlaceholderPage
      title="System Settings & Ingestion Configuration"
      description="Data source management, API tokens, pipeline execution schedules, and tenant preferences."
      icon={Settings}
      category="Settings"
      milestone="Milestone 6 Planned"
    />
  );
};
