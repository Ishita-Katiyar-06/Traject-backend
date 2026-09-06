import { simulateFetch } from './apiClient';
import { MOCK_EVIDENCE_ITEMS, EvidenceItem } from '../data/mock/evidence';

export const evidenceService = {
  async getEvidenceByInvestigationId(investigationId: string): Promise<EvidenceItem[]> {
    const list = await simulateFetch(MOCK_EVIDENCE_ITEMS);
    return list.filter((e) => e.investigationId.toLowerCase() === investigationId.toLowerCase());
  },
};
