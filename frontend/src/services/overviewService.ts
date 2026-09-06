import { simulateFetch } from './apiClient';
import { MOCK_OVERVIEW, SystemOverviewData } from '../data/mock/overview';

export const overviewService = {
  async getOverview(): Promise<SystemOverviewData> {
    return simulateFetch(MOCK_OVERVIEW);
  },
};
