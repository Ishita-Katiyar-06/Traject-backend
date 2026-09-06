import { simulateFetch } from './apiClient';
import {
  MOCK_24H_ACTIVITY,
  MOCK_RECENT_ACTIVITY,
  ActivityDataPoint,
  RecentActivityEvent,
} from '../data/mock/activity';

export const activityService = {
  async getActivityTimeline(): Promise<ActivityDataPoint[]> {
    return simulateFetch(MOCK_24H_ACTIVITY);
  },

  async getRecentActivity(): Promise<RecentActivityEvent[]> {
    return simulateFetch(MOCK_RECENT_ACTIVITY);
  },
};
