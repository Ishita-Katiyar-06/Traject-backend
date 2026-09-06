import { MOCK_TOPIC_DETAILS } from '../data/mock/topics';
import { MOCK_NARRATIVE_DETAILS } from '../data/mock/narratives';
import { MOCK_COMMUNITY_DETAILS } from '../data/mock/communities';
import { MOCK_SIGNALS } from '../data/mock/signals';
import { MOCK_INVESTIGATIONS } from '../data/mock/investigations';

export type SearchCategory = 'Topics' | 'Narratives' | 'Communities' | 'Signals' | 'Investigations';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  route: string;
}

export const searchService = {
  async search(query: string): Promise<SearchResultItem[]> {
    if (!query || query.trim().length === 0) {
      return this.getDefaultResults();
    }

    const q = query.toLowerCase().trim();
    const results: SearchResultItem[] = [];

    // 1. Search Topics
    for (const t of MOCK_TOPIC_DETAILS) {
      if (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          category: 'Topics',
          title: t.name,
          subtitle: `${t.activityLevel} Activity • ${t.changePercent > 0 ? '+' : ''}${t.changePercent}% shift`,
          route: `/topics/${t.id}`,
        });
      }
    }

    // 2. Search Narratives
    for (const n of MOCK_NARRATIVE_DETAILS) {
      if (
        n.title.toLowerCase().includes(q) ||
        n.currentFraming.toLowerCase().includes(q) ||
        n.topicName.toLowerCase().includes(q)
      ) {
        results.push({
          id: n.id,
          category: 'Narratives',
          title: n.title,
          subtitle: `Framing: "${n.currentFraming}" • Status: ${n.status}`,
          route: `/narratives/${n.id}`,
        });
      }
    }

    // 3. Search Communities
    for (const c of MOCK_COMMUNITY_DETAILS) {
      if (c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) {
        results.push({
          id: c.id,
          category: 'Communities',
          title: c.name,
          subtitle: `${c.volume.toLocaleString()} posts • ${c.activityLevel} activity`,
          route: `/communities/${c.id}`,
        });
      }
    }

    // 4. Search Signals
    for (const s of MOCK_SIGNALS) {
      if (s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) {
        results.push({
          id: s.id,
          category: 'Signals',
          title: s.title,
          subtitle: `Strength: ${s.strength} • Change: +${s.changePercent}%`,
          route: `/signals/${s.id}`,
        });
      }
    }

    // 5. Search Investigations
    for (const inv of MOCK_INVESTIGATIONS) {
      if (
        inv.title.toLowerCase().includes(q) ||
        inv.situationSummary.leadText.toLowerCase().includes(q)
      ) {
        results.push({
          id: inv.id,
          category: 'Investigations',
          title: inv.title,
          subtitle: `Investigation ${inv.id.toUpperCase()} • Status: ${inv.status}`,
          route: `/investigation/${inv.id}`,
        });
      }
    }

    return results;
  },

  getDefaultResults(): SearchResultItem[] {
    return [
      {
        id: 'top-101',
        category: 'Topics',
        title: 'Regional power supply disruption',
        subtitle: 'High Activity • +27% surge',
        route: '/topics/top-101',
      },
      {
        id: 'nar-201',
        category: 'Narratives',
        title: 'Power outage linked to infrastructure failure',
        subtitle: 'Framing: Infrastructure failure • Status: Developing',
        route: '/narratives/nar-201',
      },
      {
        id: 'com-301',
        category: 'Communities',
        title: 'Northern District Residents Network',
        subtitle: '3,840 posts • High activity',
        route: '/communities/com-301',
      },
      {
        id: 'sig-101',
        category: 'Signals',
        title: 'Sudden increase in discussion around regional power cuts',
        subtitle: 'Strength: High • Change: +27%',
        route: '/signals/sig-101',
      },
      {
        id: 'alt-601',
        category: 'Investigations',
        title: 'Regional power supply disruption',
        subtitle: 'Investigation ALT-601 • Status: Under review',
        route: '/investigation/alt-601',
      },
    ];
  },
};
