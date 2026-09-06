import { simulateFetch } from './apiClient';
import {
  MOCK_PROPAGATION_FLOW,
  MOCK_PROPAGATION_EVENTS,
  MOCK_PLATFORM_MIGRATION,
  MOCK_COMMUNITY_MOVEMENTS,
  PropagationEvent,
  PropagationFlowStep,
  PlatformMigrationSummary,
  CommunityMovementRecord,
  PropagationStrength,
} from '../data/mock/propagation';

export interface PropagationFilterParams {
  platform?: 'All' | 'X' | 'Telegram';
  strength?: 'All' | PropagationStrength;
  topicId?: string | 'All';
  narrativeId?: string | 'All';
  query?: string;
}

export const propagationService = {
  async getEvents(filters?: PropagationFilterParams): Promise<PropagationEvent[]> {
    let result = await simulateFetch(MOCK_PROPAGATION_EVENTS);

    if (filters) {
      const { platform, strength, topicId, narrativeId, query } = filters;

      if (platform && platform !== 'All') {
        result = result.filter(
          (e) => e.sourcePlatform === platform || e.destinationPlatform === platform
        );
      }

      if (strength && strength !== 'All') {
        result = result.filter((e) => e.strength === strength);
      }

      if (topicId && topicId !== 'All') {
        result = result.filter((e) => e.topicId.toLowerCase() === topicId.toLowerCase());
      }

      if (narrativeId && narrativeId !== 'All') {
        result = result.filter((e) => e.narrativeId.toLowerCase() === narrativeId.toLowerCase());
      }

      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        result = result.filter(
          (e) =>
            e.observation.toLowerCase().includes(q) ||
            e.sourceCommunity.toLowerCase().includes(q) ||
            e.destinationCommunity.toLowerCase().includes(q) ||
            e.topicName.toLowerCase().includes(q) ||
            e.narrativeTitle.toLowerCase().includes(q)
        );
      }
    }

    return result;
  },

  async getFlow(): Promise<PropagationFlowStep[]> {
    return simulateFetch(MOCK_PROPAGATION_FLOW);
  },

  async getPlatformMigration(): Promise<PlatformMigrationSummary> {
    return simulateFetch(MOCK_PLATFORM_MIGRATION);
  },

  async getCommunityMovements(): Promise<CommunityMovementRecord[]> {
    return simulateFetch(MOCK_COMMUNITY_MOVEMENTS);
  },
};
