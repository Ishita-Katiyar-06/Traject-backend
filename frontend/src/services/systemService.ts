import { telemetryApi } from './telemetryApi';
import { SystemStatusType } from '../contexts/AppContext';

export const systemService = {
  async evaluateSystemStatus(): Promise<{
    status: SystemStatusType;
    message: string;
    lastChecked: string;
    artifactsLoaded: boolean;
  }> {
    try {
      const health = await telemetryApi.getHealth();
      const isHealthy = health.status === 'healthy' && health.artifacts_loaded;

      return {
        status: isHealthy ? 'operational' : 'degraded',
        message: isHealthy
          ? `Milestone 5A API v${health.version} healthy (${health.active_records_count ?? 0} records, ${health.active_narratives_count ?? 0} narratives)`
          : 'Backend operational but artifacts not fully loaded',
        lastChecked: new Date(health.timestamp_utc).toLocaleTimeString(),
        artifactsLoaded: health.artifacts_loaded,
      };
    } catch {
      return {
        status: 'offline',
        message: 'Unable to contact /api/v1/health gateway',
        lastChecked: new Date().toLocaleTimeString(),
        artifactsLoaded: false,
      };
    }
  },
};
