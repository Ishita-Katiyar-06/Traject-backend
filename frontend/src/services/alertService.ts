import { simulateFetch } from './apiClient';
import { MOCK_ALERTS, Alert, AlertPriorityType, AlertStatusType } from '../data/mock/alerts';

export interface AlertFilterParams {
  status?: AlertStatusType | 'All';
  priority?: AlertPriorityType | 'All';
  platform?: string | 'All';
  query?: string;
}

let localAlerts = [...MOCK_ALERTS];

export const alertService = {
  async getAlerts(filters?: AlertFilterParams): Promise<Alert[]> {
    let result = await simulateFetch(localAlerts);

    if (filters) {
      const { status, priority, platform, query } = filters;

      if (status && status !== 'All') {
        result = result.filter((a) => a.status === status);
      }

      if (priority && priority !== 'All') {
        result = result.filter((a) => a.priority === priority);
      }

      if (platform && platform !== 'All') {
        result = result.filter((a) => a.platform.toLowerCase().includes(platform.toLowerCase()));
      }

      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        result = result.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.topicName.toLowerCase().includes(q) ||
            a.narrativeTitle.toLowerCase().includes(q)
        );
      }
    }

    return result;
  },

  async getAlertById(id: string): Promise<Alert | undefined> {
    const list = await simulateFetch(localAlerts);
    return list.find((a) => a.id.toLowerCase() === id.toLowerCase());
  },

  async acknowledgeAlert(id: string): Promise<Alert | undefined> {
    localAlerts = localAlerts.map((a) => {
      if (a.id.toLowerCase() === id.toLowerCase()) {
        return { ...a, status: 'Acknowledged', updatedAt: new Date().toISOString() };
      }
      return a;
    });
    return this.getAlertById(id);
  },

  async startReview(id: string): Promise<Alert | undefined> {
    localAlerts = localAlerts.map((a) => {
      if (a.id.toLowerCase() === id.toLowerCase()) {
        return { ...a, status: 'Under review', updatedAt: new Date().toISOString() };
      }
      return a;
    });
    return this.getAlertById(id);
  },

  async resolveAlert(id: string): Promise<Alert | undefined> {
    localAlerts = localAlerts.map((a) => {
      if (a.id.toLowerCase() === id.toLowerCase()) {
        return { ...a, status: 'Resolved', updatedAt: new Date().toISOString() };
      }
      return a;
    });
    return this.getAlertById(id);
  },
};
