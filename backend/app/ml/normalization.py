import logging
import re
import unicodedata

logger = logging.getLogger("traject.ml.normalization")


def normalize_social_text(text: str) -> str:
    """Safely and deterministically normalize social-media text for ML workflows.
    
    This function performs non-destructive text hygiene intended for downstream
    language identification, embeddings, sentiment classification, and topic modeling.
    
    Preservation Invariants:
    - Never strips or modifies hashtags (#keyword) or cashtags.
    - Never strips or alters user mentions (@user).
    - Never alters or removes URLs (http:// or https://).
    - Never strips emojis, symbols, or expressive punctuation (e.g. '!!!', '???').
    - Never alters casing (avoids premature lowercasing which damages NER and sentiment).
    - Never translates, stems, or lemmatizes.
    
    Normalization Operations:
    1. Unicode Normalization: Normalizes characters to standard NFC (Canonical Composition).
    2. Line-Break Normalization: Converts Windows CRLF and CR linebreaks to standard LF (\n).
    3. Paragraph Separation: Compresses 3 or more consecutive linebreaks to a standard 2 (\n\n).
    4. Horizontal Whitespace: Replaces tabs and consecutive horizontal spaces with a single space.
    5. Outer Trimming: Strips leading and trailing outer whitespace.
    
    Args:
        text: Raw source text string.
        
    Returns:
        str: Cleaned, deterministically normalized text string.
    """
    if not text:
        return ""

    # 1. Unicode normalization (NFC ensures consistent byte representation for accented/multilingual text)
    normalized = unicodedata.normalize("NFC", text)

    # 2. Line break normalization to standard Unix LF
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Horizontal whitespace normalization per line (preserves linebreaks)
    lines = [re.sub(r"[^\S\n]+", " ", line).strip() for line in normalized.split("\n")]
    normalized = "\n".join(lines)

    # 4. Paragraph separation: collapse 3+ consecutive newlines to 2
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)

    # 5. Trim leading and trailing outer whitespace
    return normalized.strip()
