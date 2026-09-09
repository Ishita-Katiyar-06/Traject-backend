import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from '../auth';

export type AppRole = 'ntro_analyst' | 'public_user' | null;
export type ViewMode = 'ntro' | 'public';

export interface RoleContextValue {
  /** The trusted application role derived from verified server claims */
  role: AppRole;
  /** True if the user has authenticated NTRO Analyst clearance */
  isNtroAnalyst: boolean;
  /** True if the user is an authenticated public user */
  isPublicUser: boolean;
  /** Current UI presentation mode for authorized users */
  viewMode: ViewMode;
  /** Switch view mode (strictly permitted for NTRO analysts only) */
  setViewMode: (mode: ViewMode) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Trusted role resolution from server-controlled app_metadata:
  // user_metadata is NEVER trusted for authorization
  const role = useMemo<AppRole>(() => {
    if (!user) return null;

    const appMeta = user.app_metadata;
    if (appMeta && typeof appMeta === 'object') {
      const serverRole = (appMeta as Record<string, unknown>).role;
      if (typeof serverRole === 'string' && serverRole.toLowerCase() === 'ntro_analyst') {
        return 'ntro_analyst';
      }
      const serverRoles = (appMeta as Record<string, unknown>).roles;
      if (Array.isArray(serverRoles) && serverRoles.includes('ntro_analyst')) {
        return 'ntro_analyst';
      }
    }

    // Check configured NTRO analyst emails whitelist matching backend APISettings
    const rawWhitelist = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_NTRO_ANALYST_EMAILS || 'analyst@ntro.gov.in,admin@ntro.gov.in';
    const whitelist = rawWhitelist.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (user.email && whitelist.includes(user.email.toLowerCase())) {
      return 'ntro_analyst';
    }

    // Default for any authenticated user without explicit server-granted NTRO claims
    return 'public_user';
  }, [user]);

  const isNtroAnalyst = role === 'ntro_analyst';
  const isPublicUser = role === 'public_user';

  // Current UI presentation mode:
  // NTRO analysts can toggle between NTRO console and Public portal views.
  // Public users are permanently constrained to Public view.
  const [viewMode, setViewModeState] = useState<ViewMode>('public');

  useEffect(() => {
    if (isNtroAnalyst) {
      setViewModeState('ntro');
    } else {
      setViewModeState('public');
    }
  }, [isNtroAnalyst]);

  const setViewMode = (mode: ViewMode) => {
    // Security constraint: Public users cannot switch into NTRO view mode
    if (mode === 'ntro' && !isNtroAnalyst) {
      console.warn('Unauthorized view mode switch rejected: NTRO clearance required');
      return;
    }
    setViewModeState(mode);
  };

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      isNtroAnalyst,
      isPublicUser,
      viewMode,
      setViewMode,
    }),
    [role, isNtroAnalyst, isPublicUser, viewMode]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = (): RoleContextValue => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
