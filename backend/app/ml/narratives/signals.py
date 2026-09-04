from app.ml.features.models import EnrichedTopicCandidate
from app.ml.narratives.models import PotentialCoordinationSignals


def extract_potential_coordination_signals(
    candidate: EnrichedTopicCandidate,
) -> PotentialCoordinationSignals:
    """Evaluate discrete heuristic signals indicating potential synchronization patterns.
    
    CRITICAL POLICY:
    These flags indicate potential coordination or arrival anomalies for analyst prioritization.
    They do NOT constitute factual proof or conclusions of inauthentic coordination or CIB.
    """
    prop = candidate.propagation
    temp = candidate.temporal

    # 1. Potential syndication spike: uncredited duplicates represent >=25% of non-forwards
    non_fwd_count = candidate.message_count - prop.observed_forward_count
    synd_ratio = (
        prop.uncredited_syndication_count / max(non_fwd_count, 1)
        if non_fwd_count > 0 else 0.0
    )
    flag_syndication = (
        prop.uncredited_syndication_count >= 1
        and synd_ratio >= 0.25
    )

    # 2. Potential temporal burst: positive inter-arrival dispersion across multiple channels
    unique_channel_count = len(prop.unique_amplifying_channels) + len(prop.unique_origin_channels)
    flag_burst = (
        temp.burstiness_index is not None
        and temp.burstiness_index > 0.20
        and unique_channel_count >= 2
    )

    # 3. Potential rapid channel entry: entry rate exceeds 10 channels/hour baseline
    flag_velocity = (
        temp.channel_entry_velocity is not None
        and temp.channel_entry_velocity > 10.0
    )

    # 4. Potential cross-channel cascade: verified spread across >=2 distinct channels
    flag_cascade = prop.cross_channel_observed_spread >= 2

    return PotentialCoordinationSignals(
        potential_syndication_spike=flag_syndication,
        potential_temporal_burst=flag_burst,
        potential_rapid_channel_entry=flag_velocity,
        potential_cross_channel_cascade=flag_cascade,
    )


def generate_signal_audit_notes(
    candidate: EnrichedTopicCandidate,
    signals: PotentialCoordinationSignals,
) -> list[str]:
    """Generate auditable, non-conclusory rationale statements explaining triggered signals."""
    notes: list[str] = []
    prop = candidate.propagation
    temp = candidate.temporal

    non_fwd_count = candidate.message_count - prop.observed_forward_count
    synd_ratio = (
        prop.uncredited_syndication_count / max(non_fwd_count, 1)
        if non_fwd_count > 0 else 0.0
    )

    if signals.potential_syndication_spike:
        notes.append(
            f"Potential coordination/anomaly signal: uncredited syndication observed across channels "
            f"({prop.uncredited_syndication_count} messages, {synd_ratio * 100:.1f}% of non-forward volume)."
        )

    if signals.potential_temporal_burst:
        notes.append(
            f"Potential coordination/anomaly signal: concentrated inter-arrival temporal burstiness detected "
            f"(B = {temp.burstiness_index:+.2f}) across distinct publishing sources."
        )

    if signals.potential_rapid_channel_entry:
        notes.append(
            f"Potential coordination/anomaly signal: rapid multi-channel adoption velocity observed "
            f"({temp.channel_entry_velocity:.1f} distinct channels/hour)."
        )

    if signals.potential_cross_channel_cascade:
        notes.append(
            f"Potential coordination/anomaly signal: multi-channel dissemination cascade observed "
            f"({prop.cross_channel_observed_spread} verified cross-channel forwards across "
            f"{len(prop.unique_amplifying_channels)} amplifying channels)."
        )

    if not notes:
        notes.append(
            "No potential coordination/anomaly signals detected; propagation pattern appears "
            "consistent with baseline organic distribution."
        )

    return notes
