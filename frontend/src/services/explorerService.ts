import { simulateFetch } from './apiClient';
import { MOCK_RAW_OBSERVATIONS, RawObservation } from '../data/mock/explorer';

export interface ExplorerFilterParams {
  query?: string;
  platform?: 'All' | 'X' | 'Telegram';
  language?: 'All' | 'English' | 'Hindi' | 'Hinglish';
  contentType?: 'All' | 'Post' | 'Message';
  topicId?: string | 'All';
  sentiment?: 'All' | 'Negative' | 'Neutral' | 'Positive';
  page?: number;
  pageSize?: number;
}

export interface ExplorerQueryResult {
  items: RawObservation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const explorerService = {
  async search(params: ExplorerFilterParams = {}): Promise<ExplorerQueryResult> {
    const {
      query = '',
      platform = 'All',
      language = 'All',
      contentType = 'All',
      topicId = 'All',
      sentiment = 'All',
      page = 1,
      pageSize = 6,
    } = params;

    let filtered = await simulateFetch(MOCK_RAW_OBSERVATIONS);

    if (platform !== 'All') {
      filtered = filtered.filter((item) => item.platform === platform);
    }

    if (language !== 'All') {
      filtered = filtered.filter((item) => item.language === language);
    }

    if (contentType !== 'All') {
      filtered = filtered.filter((item) => item.contentType === contentType);
    }

    if (topicId !== 'All') {
      filtered = filtered.filter((item) => item.topicId === topicId);
    }

    if (sentiment !== 'All') {
      filtered = filtered.filter((item) => item.sentiment === sentiment);
    }

    if (query.trim() !== '') {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.excerpt.toLowerCase().includes(q) ||
          item.fullText.toLowerCase().includes(q) ||
          item.sourceHandle.toLowerCase().includes(q) ||
          item.topicName.toLowerCase().includes(q) ||
          item.narrativeTitle.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const validPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (validPage - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total,
      page: validPage,
      pageSize,
      totalPages,
    };
  },

  async getObservationById(id: string): Promise<RawObservation | undefined> {
    const all = await simulateFetch(MOCK_RAW_OBSERVATIONS);
    return all.find((item) => item.id.toLowerCase() === id.toLowerCase());
  },
};
