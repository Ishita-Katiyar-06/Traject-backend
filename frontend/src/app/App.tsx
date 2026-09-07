import React from 'react';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </ErrorBoundary>
  );
};

