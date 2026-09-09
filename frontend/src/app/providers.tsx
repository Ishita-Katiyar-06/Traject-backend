import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from '../auth';
import { RoleProvider } from '../contexts/RoleContext';
import { AppProvider } from '../contexts/AppContext';
import { NavigationProvider } from '../contexts/NavigationContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MotionConfig reducedMotion="never">
          <BrowserRouter>
            <AuthProvider>
              <RoleProvider>
                <AppProvider>
                  <NavigationProvider>
                    {children}
                  </NavigationProvider>
                </AppProvider>
              </RoleProvider>
            </AuthProvider>
          </BrowserRouter>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
