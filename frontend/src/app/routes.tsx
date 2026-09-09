import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicShell } from '../shells/PublicShell';
import { NtroShell } from '../shells/NtroShell';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LandingPage } from '../pages/Landing/LandingPage';

// Code-split route pages via React.lazy
const OverviewPage = lazy(() =>
  import('../pages/Overview/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const TrendsPage = lazy(() =>
  import('../pages/Trends/TrendsPage').then((m) => ({ default: m.TrendsPage }))
);
const TrendDetailPage = lazy(() =>
  import('../pages/Trends/TrendDetailPage').then((m) => ({ default: m.TrendDetailPage }))
);
const NarrativesPage = lazy(() =>
  import('../pages/Narratives/NarrativesPage').then((m) => ({ default: m.NarrativesPage }))
);
const NarrativeDetailPage = lazy(() =>
  import('../pages/Narratives/NarrativeDetailPage').then((m) => ({ default: m.NarrativeDetailPage }))
);
const CommunitiesPage = lazy(() =>
  import('../pages/Communities/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage }))
);
const CommunityDetailPage = lazy(() =>
  import('../pages/Communities/CommunityDetailPage').then((m) => ({ default: m.CommunityDetailPage }))
);
const PropagationPage = lazy(() =>
  import('../pages/Propagation/PropagationPage').then((m) => ({ default: m.PropagationPage }))
);
const AlertsPage = lazy(() =>
  import('../pages/Alerts/AlertsPage').then((m) => ({ default: m.AlertsPage }))
);
const ExplorerPage = lazy(() =>
  import('../pages/Explorer/ExplorerPage').then((m) => ({ default: m.ExplorerPage }))
);
const EmergingTrendsPage = lazy(() =>
  import('../pages/EmergingTrends/EmergingTrendsPage').then((m) => ({ default: m.EmergingTrendsPage }))
);
const SettingsPage = lazy(() =>
  import('../pages/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const LoginPage = lazy(() =>
  import('../pages/Auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignupPage = lazy(() =>
  import('../pages/Auth/SignupPage').then((m) => ({ default: m.SignupPage }))
);
const UnauthorizedPage = lazy(() =>
  import('../pages/Auth/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage }))
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFound/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

const RouteLoadingFallback: React.FC = () => (
  <div className="w-full min-h-screen bg-[#060913] flex flex-col items-center justify-center p-8 space-y-3 select-none">
    <div className="w-7 h-7 border-2 border-[#D97706] border-t-transparent rounded-full animate-spin" />
    <span className="font-mono text-[12px] text-[#94A3B8] tracking-wide">Initializing workspace...</span>
  </div>
);

// Preload route components in background to ensure instantaneous, zero-delay transitions
if (typeof window !== 'undefined') {
  const preloadRoutes = () => {
    import('../pages/Overview/OverviewPage');
    import('../pages/Trends/TrendsPage');
    import('../pages/Trends/TrendDetailPage');
    import('../pages/EmergingTrends/EmergingTrendsPage');
    import('../pages/Narratives/NarrativesPage');
    import('../pages/Narratives/NarrativeDetailPage');
    import('../pages/Communities/CommunitiesPage');
    import('../pages/Communities/CommunityDetailPage');
    import('../pages/Propagation/PropagationPage');
    import('../pages/Alerts/AlertsPage');
    import('../pages/Explorer/ExplorerPage');
    import('../pages/Settings/SettingsPage');
    import('../pages/Auth/LoginPage');
    import('../pages/Auth/SignupPage');
    import('../pages/Auth/UnauthorizedPage');
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(preloadRoutes);
  } else {
    setTimeout(preloadRoutes, 100);
  }
}

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Landing Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />

      {/* =========================================================================
          1. PUBLIC APPLICATION SHELL (Open access / Public persona)
          ========================================================================= */}
      <Route element={<PublicShell />}>
        <Route
          path="trends"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TrendsPage />
            </Suspense>
          }
        />
        <Route
          path="trends/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TrendDetailPage />
            </Suspense>
          }
        />
        <Route
          path="emerging-trends"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <EmergingTrendsPage />
            </Suspense>
          }
        />
        <Route
          path="login"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="signup"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <SignupPage />
            </Suspense>
          }
        />
        <Route
          path="unauthorized"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <UnauthorizedPage />
            </Suspense>
          }
        />
      </Route>

      {/* =========================================================================
          2. NTRO CONSOLE APPLICATION SHELL (Strictly Protected / NTRO persona)
          ========================================================================= */}
      <Route
        path="console"
        element={
          <ProtectedRoute requiredRole="ntro_analyst">
            <NtroShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/console/overview" replace />} />
        <Route
          path="overview"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <OverviewPage />
            </Suspense>
          }
        />
        <Route
          path="trends"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TrendsPage />
            </Suspense>
          }
        />
        <Route
          path="trends/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TrendDetailPage />
            </Suspense>
          }
        />
        <Route
          path="emerging-trends"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <EmergingTrendsPage />
            </Suspense>
          }
        />
        <Route
          path="narratives"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <NarrativesPage />
            </Suspense>
          }
        />
        <Route
          path="narratives/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <NarrativeDetailPage />
            </Suspense>
          }
        />
        <Route
          path="communities"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <CommunitiesPage />
            </Suspense>
          }
        />
        <Route
          path="communities/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <CommunityDetailPage />
            </Suspense>
          }
        />
        <Route
          path="propagation"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <PropagationPage />
            </Suspense>
          }
        />
        <Route
          path="alerts"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <AlertsPage />
            </Suspense>
          }
        />
        <Route
          path="explorer"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <ExplorerPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>

      {/* =========================================================================
          3. BACKWARD-COMPATIBILITY / DIRECT REDIRECTS TO CONSOLE
          ========================================================================= */}
      <Route path="overview" element={<Navigate to="/console/overview" replace />} />
      <Route path="narratives" element={<Navigate to="/console/narratives" replace />} />
      <Route path="narratives/:id" element={<Navigate to="/console/narratives" replace />} />
      <Route path="communities" element={<Navigate to="/console/communities" replace />} />
      <Route path="communities/:id" element={<Navigate to="/console/communities" replace />} />
      <Route path="propagation" element={<Navigate to="/console/propagation" replace />} />
      <Route path="alerts" element={<Navigate to="/console/alerts" replace />} />
      <Route path="explorer" element={<Navigate to="/console/explorer" replace />} />
      <Route path="settings" element={<Navigate to="/console/settings" replace />} />
      <Route path="topics" element={<Navigate to="/trends" replace />} />
      <Route path="topics/:id" element={<Navigate to="/trends" replace />} />
      <Route path="investigation" element={<Navigate to="/console/narratives" replace />} />
      <Route path="investigation/:id" element={<Navigate to="/console/narratives" replace />} />

      {/* Global 404 Catch-All */}
      <Route
        path="*"
        element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <NotFoundPage />
          </Suspense>
        }
      />
    </Routes>
  );
};
