import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';

// Code-split route pages via React.lazy
const OverviewPage = lazy(() =>
  import('../pages/Overview/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const SignalsPage = lazy(() =>
  import('../pages/Signals/SignalsPage').then((m) => ({ default: m.SignalsPage }))
);
const SignalDetailPage = lazy(() =>
  import('../pages/Signals/SignalDetailPage').then((m) => ({ default: m.SignalDetailPage }))
);
const TopicsPage = lazy(() =>
  import('../pages/Topics/TopicsPage').then((m) => ({ default: m.TopicsPage }))
);
const TopicDetailPage = lazy(() =>
  import('../pages/Topics/TopicDetailPage').then((m) => ({ default: m.TopicDetailPage }))
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
const SettingsPage = lazy(() =>
  import('../pages/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const InvestigationPage = lazy(() =>
  import('../pages/Investigation/InvestigationPage').then((m) => ({ default: m.InvestigationPage }))
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFound/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

const RouteLoadingFallback: React.FC = () => (
  <div className="w-full min-h-[400px] flex flex-col items-center justify-center p-8 space-y-3">
    <div className="w-6 h-6 border-2 border-[#2F65F6] border-t-transparent rounded-full animate-spin" />
    <span className="font-mono text-[12px] text-[#8591A5]">Loading workspace...</span>
  </div>
);

// Preload route components in background to ensure instantaneous, zero-delay transitions
if (typeof window !== 'undefined') {
  const preloadRoutes = () => {
    import('../pages/Overview/OverviewPage');
    import('../pages/Signals/SignalsPage');
    import('../pages/Signals/SignalDetailPage');
    import('../pages/Topics/TopicsPage');
    import('../pages/Topics/TopicDetailPage');
    import('../pages/Narratives/NarrativesPage');
    import('../pages/Narratives/NarrativeDetailPage');
    import('../pages/Communities/CommunitiesPage');
    import('../pages/Communities/CommunityDetailPage');
    import('../pages/Propagation/PropagationPage');
    import('../pages/Alerts/AlertsPage');
    import('../pages/Explorer/ExplorerPage');
    import('../pages/Settings/SettingsPage');
    import('../pages/Investigation/InvestigationPage');
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
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route
          path="overview"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <OverviewPage />
            </Suspense>
          }
        />
        <Route
          path="signals"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <SignalsPage />
            </Suspense>
          }
        />
        <Route
          path="signals/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <SignalDetailPage />
            </Suspense>
          }
        />
        <Route
          path="topics"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TopicsPage />
            </Suspense>
          }
        />
        <Route
          path="topics/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TopicDetailPage />
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
        <Route
          path="investigation"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <InvestigationPage />
            </Suspense>
          }
        />
        <Route
          path="investigation/:id"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <InvestigationPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
};
