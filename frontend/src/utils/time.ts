/**
 * Tessera Centralized Time & Date Formatting Utilities
 *
 * Provides consistent, accessible, and deterministic time handling
 * across all monitoring and investigation workspaces.
 */

/**
 * Formats an ISO date string into an absolute, readable UTC or localized timestamp.
 * Example output: "02 Sep 2026, 19:20 UTC"
 */
export function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const day = d.getUTCDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  } catch {
    return isoString;
  }
}

/**
 * Formats an ISO date string into a clean HH:MM UTC time string.
 * Example output: "18:42 UTC"
 */
export function formatTimeOnly(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} UTC`;
  } catch {
    return isoString;
  }
}

/**
 * Formats an ISO date string into a relative time representation.
 * Example output: "18 min ago", "2 hours ago", "yesterday"
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const now = Date.now();
    const diffMs = now - d.getTime();

    if (diffMs < 0) return 'just now';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatTimestamp(isoString);
  } catch {
    return isoString;
  }
}
