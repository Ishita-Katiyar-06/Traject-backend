from collections import Counter, defaultdict
from typing import Sequence
import urllib.parse

import regex as re

from app.ml.features.models import SocialEntityCategory, TopicEntity
from app.schemas import CanonicalMessage

# Patterns for social entity extraction
HASHTAG_PATTERN = re.compile(r"#([\p{L}\p{M}\p{N}_]+)", re.UNICODE)
HANDLE_PATTERN = re.compile(r"@([\p{L}\p{M}\p{N}_]+)", re.UNICODE)
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)

# Curated multilingual gazetteer dictionaries for geopolitical and strategic organizations
GAZETTEER_GEO: dict[str, list[str]] = {
    "India": ["india", "bharat", "hindustan", "भारत", "हिन्दुस्तान", "индия"],
    "Russia": ["russia", "russian federation", "россия", "рф"],
    "Delhi": ["delhi", "new delhi", "दिल्ली", "नई दिल्ली", "дели"],
    "Moscow": ["moscow", "москва"],
    "Ukraine": ["ukraine", "украина", "यूक्रेन"],
    "China": ["china", "चीन", "китай"],
    "Kashmir": ["kashmir", "कश्मीर", "кашмир"],
    "Ladakh": ["ladakh", "लद्दाख", "ладакх"],
}

GAZETTEER_ORG: dict[str, list[str]] = {
    "United Nations": ["un", "united nations", "संयुक्त राष्ट्र", "оон"],
    "NATO": ["nato", "नाटो", "нато"],
    "ISRO": ["isro", "इसरो"],
    "DRDO": ["drdo", "डीआरडीओ"],
    "BRICS": ["brics", "ब्रिक्स", "брикс"],
    "OPEC": ["opec", "ओपेक", "опек"],
}


def extract_domain_from_url(url: str) -> str | None:
    """Extract clean root hostname from an HTTP/HTTPS URL."""
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc.lower()
        if ":" in netloc:
            netloc = netloc.split(":")[0]
        # Strip leading www.
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc if "." in netloc else None
    except Exception:
        return None


def extract_social_entities(
    messages: Sequence[CanonicalMessage],
    top_k: int = 15,
) -> list[TopicEntity]:
    """Extract and aggregate hashtags, handles, domain URLs, and gazetteer entities across messages.
    
    Args:
        messages: CanonicalMessages belonging to a topic cluster.
        top_k: Maximum number of entities to return.
        
    Returns:
        list[TopicEntity]: Normalized entities ranked by frequency.
    """
    entity_counts: Counter[tuple[str, SocialEntityCategory]] = Counter()
    sample_ids: dict[tuple[str, SocialEntityCategory], list[str]] = defaultdict(list)

    for msg in messages:
        text = msg.text_content or ""
        msg_id = msg.canonical_id

        # 1. Hashtags (from pre-parsed canonical field + body regex)
        raw_hashtags = set(msg.hashtags) | set(HASHTAG_PATTERN.findall(text))
        for tag in raw_hashtags:
            clean_tag = tag.lstrip("#").lower()
            if len(clean_tag) >= 2 and not clean_tag.isdigit():
                key = (clean_tag, SocialEntityCategory.HASHTAG)
                entity_counts[key] += 1
                if len(sample_ids[key]) < 3 and msg_id not in sample_ids[key]:
                    sample_ids[key].append(msg_id)

        # 2. Handles / Mentions (from canonical field + body regex)
        raw_mentions = set(msg.mentions) | set(HANDLE_PATTERN.findall(text))
        for handle in raw_mentions:
            clean_handle = handle.lstrip("@").lower()
            if len(clean_handle) >= 2:
                key = (clean_handle, SocialEntityCategory.HANDLE)
                entity_counts[key] += 1
                if len(sample_ids[key]) < 3 and msg_id not in sample_ids[key]:
                    sample_ids[key].append(msg_id)

        # 3. Domains from URLs (from canonical field + body regex)
        raw_urls = set(msg.urls) | set(URL_PATTERN.findall(text))
        for url in raw_urls:
            domain = extract_domain_from_url(url)
            if domain:
                key = (domain, SocialEntityCategory.DOMAIN)
                entity_counts[key] += 1
                if len(sample_ids[key]) < 3 and msg_id not in sample_ids[key]:
                    sample_ids[key].append(msg_id)

        # 4. Multilingual Gazetteer Matching (P1)
        text_lower = text.lower()
        for canon_name, aliases in GAZETTEER_GEO.items():
            for alias in aliases:
                # Word boundary match using regex
                if re.search(r"(?:\b|\s|^)" + re.escape(alias) + r"(?:\b|\s|$|[^\p{L}])", text_lower):
                    key = (canon_name, SocialEntityCategory.GAZETTEER_GEO)
                    entity_counts[key] += 1
                    if len(sample_ids[key]) < 3 and msg_id not in sample_ids[key]:
                        sample_ids[key].append(msg_id)
                    break

        for canon_name, aliases in GAZETTEER_ORG.items():
            for alias in aliases:
                if re.search(r"(?:\b|\s|^)" + re.escape(alias) + r"(?:\b|\s|$|[^\p{L}])", text_lower):
                    key = (canon_name, SocialEntityCategory.GAZETTEER_ORG)
                    entity_counts[key] += 1
                    if len(sample_ids[key]) < 3 and msg_id not in sample_ids[key]:
                        sample_ids[key].append(msg_id)
                    break

    results: list[TopicEntity] = []
    for (name, cat), count in entity_counts.most_common(top_k):
        results.append(
            TopicEntity(
                text=name,
                category=cat,
                frequency=count,
                sample_message_ids=sample_ids[(name, cat)],
            )
        )

    return results
