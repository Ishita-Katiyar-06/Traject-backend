import { simulateFetch } from './apiClient';
import { MOCK_SIGNALS, Signal, SignalStatusType, SignalStrengthType } from '../data/mock/signals';

export interface SignalFilterParams {
  status?: SignalStatusType | 'All';
  strength?: SignalStrengthType | 'All';
  source?: 'Telegram' | 'X' | 'All';
  language?: string | 'All';
  query?: string;
  sortBy?: 'recent' | 'change' | 'priority';
}

export interface AttentionSummary {
  requiresReviewCount: number;
  emergingChangesCount: number;
  highVelocityTopicsCount: number;
}

export const signalService = {
  async getSignals(filters?: SignalFilterParams): Promise<Signal[]> {
    let result = await simulateFetch(MOCK_SIGNALS);

    if (filters) {
      const { status, strength, source, language, query, sortBy = 'recent' } = filters;

      if (status && status !== 'All') {
        result = result.filter((s) => s.status === status);
      }
      if (strength && strength !== 'All') {
        result = result.filter((s) => s.strength === strength);
      }
      if (source && source !== 'All') {
        result = result.filter((s) => s.sources.includes(source as 'Telegram' | 'X'));
      }
      if (language && language !== 'All') {
        result = result.filter((s) => s.languages.includes(language));
      }
      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        result = result.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.affectedTopics.some((t) => t.toLowerCase().includes(q))
        );
      }

      if (sortBy === 'change') {
        result.sort((a, b) => b.changePercent - a.changePercent);
      } else if (sortBy === 'priority') {
        const weight: Record<SignalStrengthType, number> = { High: 3, Medium: 2, Low: 1 };
        result.sort((a, b) => weight[b.strength] - weight[a.strength]);
      } else {
        // 'recent' by default
        result.sort(
          (a, b) =>
            new Date(b.detectedTimestamp).getTime() - new Date(a.detectedTimestamp).getTime()
        );
      }
    }

    return result;
  },

  async getSignalById(id: string): Promise<Signal | undefined> {
    const list = await simulateFetch(MOCK_SIGNALS);
    return list.find((s) => s.id.toLowerCase() === id.toLowerCase());
  },

  async getTopEmergingSignals(limit = 4): Promise<Signal[]> {
    const list = await simulateFetch(MOCK_SIGNALS);
    // Sort by priority and changePercent
    const sorted = [...list].sort((a, b) => {
      if (a.status === 'Emerging' && b.status !== 'Emerging') return -1;
      if (b.status === 'Emerging' && a.status !== 'Emerging') return 1;
      return b.changePercent - a.changePercent;
    });
    return sorted.slice(0, limit);
  },

  async getAttentionSummary(): Promise<AttentionSummary> {
    const list = await simulateFetch(MOCK_SIGNALS);
    const requiresReview = list.filter((s) => s.strength === 'High' && s.status !== 'Resolved').length;
    const emergingChanges = list.filter((s) => s.status === 'Emerging').length;
    const highVelocityTopics = 2; // Derived from topic telemetry

    return {
      requiresReviewCount: requiresReview,
      emergingChangesCount: emergingChanges,
      highVelocityTopicsCount: highVelocityTopics,
    };
  },
};
