import React, { createContext, useContext, useState } from 'react';

export type SystemStatusType = 'operational' | 'connecting' | 'degraded' | 'offline';

export interface AppContextType {
  systemStatus: SystemStatusType;
  setSystemStatus: (status: SystemStatusType) => void;
  activeTimeframe: string;
  setActiveTimeframe: (tf: string) => void;
  environment: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatusType>('operational');
  const [activeTimeframe, setActiveTimeframe] = useState<string>('24h');
  const environment = 'production';

  return (
    <AppContext.Provider
      value={{
        systemStatus,
        setSystemStatus,
        activeTimeframe,
        setActiveTimeframe,
        environment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
