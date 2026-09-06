import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../contexts/AppContext';
import { NavigationProvider } from '../contexts/NavigationContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AppProvider>
            <NavigationProvider>
              {children}
            </NavigationProvider>
          </AppProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
