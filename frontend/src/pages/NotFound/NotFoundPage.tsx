import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Page not found"
        description="The requested page does not exist or has been relocated."
      />

      <div className="pt-2">
        <Button variant="secondary" onClick={() => navigate('/overview')}>
          Go to Overview
        </Button>
      </div>
    </div>
  );
};
