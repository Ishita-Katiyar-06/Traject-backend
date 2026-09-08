/**
 * Tessera Watchlist Service
 *
 * Provides persistent tracking of watched intelligence entities
 * (Topics, Narratives, Communities, Investigations).
 */

export type WatchEntityType = 'Topic' | 'Trend' | 'Narrative' | 'Community';

export interface WatchItem {
  id: string;
  type: WatchEntityType;
  title: string;
  currentStatus: string;
  lastChange: string;
  route: string;
  addedAt: string;
}

const WATCHLIST_STORAGE_KEY = 'tessera_watchlist_items';

const DEFAULT_WATCHLIST: WatchItem[] = [
  {
    id: 'trend_001',
    type: 'Trend',
    title: 'Treaty & Regional Security Discourse',
    currentStatus: 'Elevated',
    lastChange: '+24%',
    route: '/trends/trend_001',
    addedAt: '2026-09-02T19:00:00Z',
  },
  {
    id: 'narrative_000',
    type: 'Narrative',
    title: 'Democratic Campaign Strategy & Foreign Policy Framing',
    currentStatus: 'Elevated',
    lastChange: '+18%',
    route: '/narratives/narrative_000',
    addedAt: '2026-09-02T19:15:00Z',
  },
];

export const watchlistService = {
  getWatchlist(): WatchItem[] {
    try {
      const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
        return DEFAULT_WATCHLIST;
      }
      return JSON.parse(stored);
    } catch {
      return DEFAULT_WATCHLIST;
    }
  },

  isWatched(id: string): boolean {
    const list = this.getWatchlist();
    return list.some((item) => item.id.toLowerCase() === id.toLowerCase());
  },

  addWatch(item: WatchItem): void {
    const list = this.getWatchlist();
    if (!list.some((existing) => existing.id.toLowerCase() === item.id.toLowerCase())) {
      const updated = [item, ...list];
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  removeWatch(id: string): void {
    const list = this.getWatchlist();
    const updated = list.filter((item) => item.id.toLowerCase() !== id.toLowerCase());
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
  },

  toggleWatch(item: WatchItem): boolean {
    if (this.isWatched(item.id)) {
      this.removeWatch(item.id);
      return false;
    } else {
      this.addWatch(item);
      return true;
    }
  },
};
