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

export const watchlistService = {
  getWatchlist(): WatchItem[] {
    try {
      const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed: WatchItem[] = JSON.parse(stored);
      // Strip any legacy synthetic items if present in browser localStorage
      return parsed.filter((item) => item.id !== 'trend_001' && item.id !== 'narrative_000');
    } catch {
      return [];
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
