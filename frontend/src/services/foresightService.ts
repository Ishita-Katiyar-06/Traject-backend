import { simulateFetch } from './apiClient';
import { MOCK_FORESIGHT, ForesightDetail } from '../data/mock/foresight';

export const foresightService = {
  async getForesightByInvestigationId(investigationId: string): Promise<ForesightDetail | undefined> {
    const list = await simulateFetch(MOCK_FORESIGHT);
    return list.find((f) => f.investigationId.toLowerCase() === investigationId.toLowerCase());
  },
};
