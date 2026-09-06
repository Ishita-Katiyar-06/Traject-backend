import { simulateFetch } from './apiClient';
import {
  MOCK_TOPIC_DETAILS,
  TopicDetail,
  TopicActivityLevel,
  TopicTrendType,
} from '../data/mock/topics';

export interface TopicFilterParams {
  platform?: 'All' | 'X' | 'Telegram';
  language?: 'All' | 'English' | 'Hindi' | 'Hinglish';
  activity?: 'All' | TopicActivityLevel;
  trend?: 'All' | TopicTrendType;
  query?: string;
  sortBy?: 'activity' | 'change' | 'recent' | 'name';
}

export const topicService = {
  async getTopics(filters?: TopicFilterParams): Promise<TopicDetail[]> {
    let result = await simulateFetch(MOCK_TOPIC_DETAILS);

    if (filters) {
      const { platform, language, activity, trend, query, sortBy = 'change' } = filters;

      if (platform && platform !== 'All') {
        if (platform === 'X') {
          result = result.filter((t) => t.platforms.x > 0);
        } else if (platform === 'Telegram') {
          result = result.filter((t) => t.platforms.telegram > 0);
        }
      }

      if (language && language !== 'All') {
        const langKey = language.toLowerCase() as 'hindi' | 'hinglish' | 'english';
        result = result.filter((t) => (t.languages[langKey] ?? 0) > 0);
      }

      if (activity && activity !== 'All') {
        result = result.filter((t) => t.activityLevel === activity);
      }

      if (trend && trend !== 'All') {
        result = result.filter((t) => t.trend === trend);
      }

      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        result = result.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        );
      }

      if (sortBy === 'activity') {
        const weight: Record<TopicActivityLevel, number> = { High: 3, Moderate: 2, Low: 1 };
        result.sort((a, b) => weight[b.activityLevel] - weight[a.activityLevel]);
      } else if (sortBy === 'name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === 'recent') {
        result.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      } else {
        // default 'change'
        result.sort((a, b) => b.changePercent - a.changePercent);
      }
    }

    return result;
  },

  async getTopicById(id: string): Promise<TopicDetail | undefined> {
    const list = await simulateFetch(MOCK_TOPIC_DETAILS);
    return list.find((t) => t.id.toLowerCase() === id.toLowerCase());
  },

  async getRelatedTopics(ids: string[]): Promise<TopicDetail[]> {
    const list = await simulateFetch(MOCK_TOPIC_DETAILS);
    return list.filter((t) => ids.includes(t.id));
  },
};
