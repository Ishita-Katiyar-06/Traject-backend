/**
 * Utilities for consistent human-readable Narrative identity presentation.
 *
 * Adheres strictly to the TRAJECT Narrative Identity rules:
 * - Technical ID (narrative_id) remains unchanged for keys, URLs, joins.
 * - Human-readable narrative_name summarizes the central idea (3-8 meaningful words).
 * - narrative_summary explains what the narrative represents in 1-3 sentences.
 */

export interface NarrativeIdentitySource {
  narrative_id: string;
  narrative_name?: string | null;
  narrative_summary?: string | null;
  headline_claim?: string;
  promoted_from_topic_id?: string;
}

/**
 * Returns the meaningful human-readable narrative name.
 * Falls back cleanly to sanitized claim keywords or clean ID if name is pending.
 */
export function getNarrativeDisplayName(narrative?: NarrativeIdentitySource | null): string {
  if (!narrative) return '';
  if (narrative.narrative_name && narrative.narrative_name.trim().length > 0) {
    return narrative.narrative_name;
  }

  // Fallback: derive clean title from headline claim if backend property is absent
  if (narrative.headline_claim) {
    const claim = narrative.headline_claim.replace(/^\[[^\]]+\]\s*/, '').trim();
    if (claim.length > 0) {
      const words = claim.split(/,\s*|\s+/).filter((w) => w.length >= 3);
      if (words.length >= 2) {
        const titleWords = words.slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
        return `${titleWords[0]}–${titleWords.slice(1).join(' ')} Discourse`;
      } else if (words.length === 1) {
        return `${words[0].charAt(0).toUpperCase() + words[0].slice(1)} Discourse`;
      }
    }
  }

  return `Narrative ${narrative.narrative_id}`;
}

/**
 * Returns the short narrative explanation/summary.
 */
export function getNarrativeExplanation(narrative?: NarrativeIdentitySource | null): string {
  if (!narrative) return '';
  if (narrative.narrative_summary && narrative.narrative_summary.trim().length > 0) {
    return narrative.narrative_summary;
  }

  const name = getNarrativeDisplayName(narrative);
  return `This narrative groups messages around references to ${name.toLowerCase()}, but the available evidence is insufficient to establish a more specific interpretation.`;
}
