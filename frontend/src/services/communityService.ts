import { simulateFetch } from './apiClient';
import {
  MOCK_COMMUNITY_DETAILS,
  CommunityDetail,
  CommunityActivityLevel,
  CommunityTrend,
} from '../data/mock/communities';

export interface CommunityFilterParams {
  platform?: 'All' | 'X' | 'Telegram';
  language?: 'All' | 'English' | 'Hindi' | 'Hinglish';
  activity?: 'All' | CommunityActivityLevel;
  trend?: 'All' | CommunityTrend;
  query?: string;
  sortBy?: 'volume' | 'recent' | 'name';
}

export const communityService = {
  async getCommunities(filters?: CommunityFilterParams): Promise<CommunityDetail[]> {
    let result = await simulateFetch(MOCK_COMMUNITY_DETAILS);

    if (filters) {
      const { platform, language, activity, trend, query, sortBy = 'volume' } = filters;

      if (platform && platform !== 'All') {
        if (platform === 'X') {
          result = result.filter((c) => c.platforms.x > 0);
        } else if (platform === 'Telegram') {
          result = result.filter((c) => c.platforms.telegram > 0);
        }
      }

      if (language && language !== 'All') {
        const langKey = language.toLowerCase() as 'hindi' | 'hinglish' | 'english';
        result = result.filter((c) => (c.languages[langKey] ?? 0) > 0);
      }

      if (activity && activity !== 'All') {
        result = result.filter((c) => c.activityLevel === activity);
      }

      if (trend && trend !== 'All') {
        result = result.filter((c) => c.trend === trend);
      }

      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        result = result.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
        );
      }

      if (sortBy === 'name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === 'recent') {
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      } else {
        // default volume
        result.sort((a, b) => b.volume - a.volume);
      }
    }

    return result;
  },

  async getCommunityById(id: string): Promise<CommunityDetail | undefined> {
    const list = await simulateFetch(MOCK_COMMUNITY_DETAILS);
    return list.find((c) => c.id.toLowerCase() === id.toLowerCase());
  },

  async getRelatedCommunities(ids: string[]): Promise<CommunityDetail[]> {
    const list = await simulateFetch(MOCK_COMMUNITY_DETAILS);
    return list.filter((c) => ids.includes(c.id));
  },
};
