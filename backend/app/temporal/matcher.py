"""Deterministic narrative-to-narrative matching engine for temporal lineage tracking.

Calculates lineage_match_score across consecutive analytical snapshots using observational evidence
(message IDs, broadcasting channels, and lexical entities). Does not alter ML models or 4G scoring.
"""

from dataclasses import dataclass, field
import logging
import re
from typing import Any, Sequence

from app.ml.narratives.models import NarrativeCandidate

logger = logging.getLogger("traject.temporal.matcher")


@dataclass(frozen=True)
class NarrativeMatchingProfile:
    """Precomputed lightweight index for a narrative candidate to enable fast bounded matching."""
    narrative_id: str
    topic_id: str
    headline_claim: str
    message_ids: frozenset[str]
    channels: frozenset[str]
    lexical_tokens: frozenset[str]
    message_count: int
    distinct_sources_count: int
    distinct_domains_count: int
    priority_signal_score: float
    first_observed_at: str
    last_observed_at: str

    @classmethod
    def from_candidate(
        cls,
        candidate: NarrativeCandidate,
        topic_message_ids: Sequence[str] | None = None,
        domains_count: int = 1,
    ) -> "NarrativeMatchingProfile":
        # 1. Message IDs from topic members or fallback
        mids: set[str] = set(topic_message_ids or [])

        # 2. Channels (broadcasting + origins)
        channels = {
            c.lstrip("@").lower()
            for c in (candidate.broadcasting_channels + candidate.origin_channels)
            if c and c.strip()
        }

        # 3. Lexical tokens from headline, entities, and keywords
        tokens: set[str] = set()
        for entity in candidate.key_entities:
            clean = entity.lstrip("#@").lower().strip()
            if len(clean) >= 3:
                tokens.add(clean)

        headline_words = re.findall(r"\b[a-zA-Z0-9_\u0400-\u04FF]{3,}\b", candidate.headline_claim.lower())
        tokens.update(headline_words)

        return cls(
            narrative_id=candidate.narrative_id,
            topic_id=candidate.promoted_from_topic_id,
            headline_claim=candidate.headline_claim,
            message_ids=frozenset(mids),
            channels=frozenset(channels),
            lexical_tokens=frozenset(tokens),
            message_count=candidate.data_coverage.message_count,
            distinct_sources_count=candidate.data_coverage.channel_count or max(1, len(channels)),
            distinct_domains_count=domains_count,
            priority_signal_score=round(candidate.priority_signal_score, 4),
            first_observed_at=candidate.first_observed_at.isoformat(),
            last_observed_at=candidate.last_observed_at.isoformat(),
        )


@dataclass
class MatchResult:
    """Outcome of evaluating similarity between two candidate profiles."""
    previous_narrative_id: str
    current_narrative_id: str
    lineage_match_score: float
    jaccard_messages: float
    jaccard_channels: float
    jaccard_lexical: float
    shared_messages_count: int
    shared_channels_count: int
    shared_entities_count: int
    is_match: bool
    explanation: str
    match_evidence: dict[str, Any] = field(default_factory=dict)


class DeterministicNarrativeMatcher:
    """Evaluates narrative continuity across consecutive analytical snapshots.
    
    Weights:
    - 50% Canonical message ID overlap (strongest grounding)
    - 25% Channel / source overlap
    - 25% Key entity and headline lexical overlap
    
    Thresholds:
    - Minimum composite match score: 0.40 (or message Jaccard >= 0.15)
    - Minimum safety condition: Must share >= 1 canonical message OR >= 1 key entity
    - Ambiguity margin: Requires >= 0.10 score separation between top 2 candidate matches
    """

    MATCH_THRESHOLD: float = 0.40
    MESSAGE_JACCARD_OVERRIDE: float = 0.15
    AMBIGUITY_MARGIN: float = 0.10
    WEAKENING_MESSAGE_RATIO: float = 0.70

    @staticmethod
    def _jaccard(set_a: frozenset[str], set_b: frozenset[str]) -> float:
        """Compute Jaccard similarity index between two sets."""
        if not set_a and not set_b:
            return 0.0
        union_len = len(set_a | set_b)
        if union_len == 0:
            return 0.0
        return len(set_a & set_b) / union_len

    def evaluate_pair(
        self,
        prev: NarrativeMatchingProfile,
        curr: NarrativeMatchingProfile,
    ) -> MatchResult:
        """Calculate pairwise similarity score between previous and current narrative."""
        j_msgs = self._jaccard(prev.message_ids, curr.message_ids)
        j_chans = self._jaccard(prev.channels, curr.channels)
        j_lex = self._jaccard(prev.lexical_tokens, curr.lexical_tokens)

        shared_msgs = len(prev.message_ids & curr.message_ids)
        shared_chans = len(prev.channels & curr.channels)
        shared_lex = len(prev.lexical_tokens & curr.lexical_tokens)

        # Composite score
        score = round((0.50 * j_msgs) + (0.25 * j_chans) + (0.25 * j_lex), 4)

        # Safety condition: must have shared messages or shared entities; cannot match purely on channel
        has_grounding = (shared_msgs > 0) or (shared_lex > 0 and j_lex >= 0.20)
        is_above_threshold = (score >= self.MATCH_THRESHOLD) or (j_msgs >= self.MESSAGE_JACCARD_OVERRIDE)

        is_match = bool(has_grounding and is_above_threshold)

        explanation = (
            f"Match score: {score:.3f} (msgs: {j_msgs:.3f} [{shared_msgs} shared], "
            f"chans: {j_chans:.3f} [{shared_chans} shared], lex: {j_lex:.3f} [{shared_lex} shared])"
        )

        match_evidence = {
            "score": score,
            "jaccard_messages": round(j_msgs, 4),
            "jaccard_channels": round(j_chans, 4),
            "jaccard_lexical": round(j_lex, 4),
            "shared_messages_count": shared_msgs,
            "shared_channels_count": shared_chans,
            "shared_entities_count": shared_lex,
            "has_grounding": has_grounding,
        }

        return MatchResult(
            previous_narrative_id=prev.narrative_id,
            current_narrative_id=curr.narrative_id,
            lineage_match_score=score,
            jaccard_messages=j_msgs,
            jaccard_channels=j_chans,
            jaccard_lexical=j_lex,
            shared_messages_count=shared_msgs,
            shared_channels_count=shared_chans,
            shared_entities_count=shared_lex,
            is_match=is_match,
            explanation=explanation,
            match_evidence=match_evidence,
        )

    def match_snapshots(
        self,
        previous_profiles: Sequence[NarrativeMatchingProfile],
        current_profiles: Sequence[NarrativeMatchingProfile],
    ) -> tuple[dict[str, MatchResult], list[str], list[str]]:
        """Perform bipartite deterministic matching between previous and current snapshots.
        
        Returns:
            tuple:
                - matched_pairs: dict mapping current_narrative_id -> best MatchResult
                - unmatched_new: list of current_narrative_ids with no match
                - unmatched_disappeared: list of previous_narrative_ids with no match
        """
        prev_by_id = {p.narrative_id: p for p in previous_profiles}
        curr_by_id = {c.narrative_id: c for c in current_profiles}

        # Build candidate matches for each current narrative
        candidates_for_curr: dict[str, list[MatchResult]] = {}
        for curr_id, curr_p in curr_by_id.items():
            for prev_id, prev_p in prev_by_id.items():
                res = self.evaluate_pair(prev_p, curr_p)
                if res.is_match:
                    candidates_for_curr.setdefault(curr_id, []).append(res)

        matched_pairs: dict[str, MatchResult] = {}
        used_prev_ids: set[str] = set()

        # Sort candidate evaluations by highest score
        for curr_id, matches in candidates_for_curr.items():
            matches.sort(key=lambda m: m.lineage_match_score, reverse=True)
            best_match = matches[0]

            # Ambiguity guard: If there's a runner-up, require separation
            if len(matches) > 1:
                runner_up = matches[1]
                score_gap = best_match.lineage_match_score - runner_up.lineage_match_score
                if score_gap < self.AMBIGUITY_MARGIN:
                    logger.info(
                        "Ambiguous match for %s between %s (%.3f) and %s (%.3f); gap %.3f < %.3f. Abstaining to prevent false continuity.",
                        curr_id,
                        best_match.previous_narrative_id,
                        best_match.lineage_match_score,
                        runner_up.previous_narrative_id,
                        runner_up.lineage_match_score,
                        score_gap,
                        self.AMBIGUITY_MARGIN,
                    )
                    continue

            # 1-to-1 matching: if previous ID was already claimed by a higher-scoring match, abstain
            if best_match.previous_narrative_id in used_prev_ids:
                # Resolve conflict in favor of higher score
                existing_curr = next(
                    cid for cid, m in matched_pairs.items()
                    if m.previous_narrative_id == best_match.previous_narrative_id
                )
                if best_match.lineage_match_score > matched_pairs[existing_curr].lineage_match_score:
                    del matched_pairs[existing_curr]
                    matched_pairs[curr_id] = best_match
                else:
                    # Current narrative cannot claim this previous ID; treated as new
                    continue
            else:
                matched_pairs[curr_id] = best_match
                used_prev_ids.add(best_match.previous_narrative_id)

        unmatched_new = [cid for cid in curr_by_id if cid not in matched_pairs]
        unmatched_disappeared = [pid for pid in prev_by_id if pid not in used_prev_ids]

        return matched_pairs, unmatched_new, unmatched_disappeared

    def is_weakened(
        self,
        prev: NarrativeMatchingProfile,
        curr: NarrativeMatchingProfile,
    ) -> tuple[bool, str]:
        """Determine whether a continuing narrative meets the observational weakening definition.
        
        Rule:
        - message count decreased by >= 30% (< 0.70x previous), OR
        - distinct sources count decreased and message count did not increase.
        """
        if curr.message_count < (self.WEAKENING_MESSAGE_RATIO * prev.message_count):
            drop_pct = round((1.0 - (curr.message_count / max(1, prev.message_count))) * 100, 1)
            return True, f"Observed message count decreased by {drop_pct}% ({prev.message_count} -> {curr.message_count})"

        if (
            curr.distinct_sources_count < prev.distinct_sources_count
            and curr.message_count <= prev.message_count
        ):
            return True, (
                f"Observed source diversity decreased ({prev.distinct_sources_count} -> "
                f"{curr.distinct_sources_count} sources) without message growth"
            )

        return False, "Observed volume and source breadth remained stable or expanded"
