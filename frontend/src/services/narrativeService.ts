import { simulateFetch } from './apiClient';
import {
  MOCK_NARRATIVE_DETAILS,
  NarrativeDetail,
  NarrativeStatus,
  NarrativeTrend,
} from '../data/mock/narratives';

export interface NarrativeFilterParams {
  status?: NarrativeStatus | 'All';
  trend?: NarrativeTrend | 'All';
  platform?: 'All' | 'X' | 'Telegram';
  language?: 'All' | 'English' | 'Hindi' | 'Hinglish';
  query?: string;
  sortBy?: 'change' | 'recent' | 'title';
}

export const narrativeService = {
  async getNarratives(filters?: NarrativeFilterParams): Promise<NarrativeDetail[]> {
    let result = await simulateFetch(MOCK_NARRATIVE_DETAILS);

    if (filters) {
      const { status, trend, platform, language, query, sortBy = 'change' } = filters;

      if (status && status !== 'All') {
        result = result.filter((n) => n.status === status);
      }

      if (trend && trend !== 'All') {
        result = result.filter((n) => n.trend === trend);
      }

      if (platform && platform !== 'All') {
        if (platform === 'X') {
          result = result.filter((n) => n.platforms.x > 0);
        } else if (platform === 'Telegram') {
          result = result.filter((n) => n.platforms.telegram > 0);
        }
      }

      if (language && language !== 'All') {
        const langKey = language.toLowerCase() as 'hindi' | 'hinglish' | 'english';
        result = result.filter((n) => (n.languages[langKey] ?? 0) > 0);
      }

      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        result = result.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.currentFraming.toLowerCase().includes(q) ||
            n.topicName.toLowerCase().includes(q)
        );
      }

      if (sortBy === 'recent') {
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      } else if (sortBy === 'title') {
        result.sort((a, b) => a.title.localeCompare(b.title));
      } else {
        // default change
        result.sort((a, b) => b.changePercent - a.changePercent);
      }
    }

    return result;
  },

  async getNarrativeById(id: string): Promise<NarrativeDetail | undefined> {
    const list = await simulateFetch(MOCK_NARRATIVE_DETAILS);
    return list.find((n) => n.id.toLowerCase() === id.toLowerCase());
  },

  async getNarrativesByTopic(topicId: string): Promise<NarrativeDetail[]> {
    const list = await simulateFetch(MOCK_NARRATIVE_DETAILS);
    return list.filter((n) => n.topicId.toLowerCase() === topicId.toLowerCase());
  },
};
