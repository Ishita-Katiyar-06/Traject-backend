import json
import logging
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any

from app.core.config import find_repo_root

logger = logging.getLogger("traject.collectors.telegram.registry")


class SourceType(StrEnum):
    """Controlled source-type taxonomy describing Telegram channel publisher relationship.
    
    NOTE: These describe channel structure and attribution; they are NOT truthfulness,
    credibility, or threat scores and must never be used as such by analytical models.
    """
    OFFICIAL = "official"
    PUBLISHER = "publisher"
    INDEPENDENT = "independent"
    REPUBLICATION = "republication"


@dataclass(frozen=True)
class TelegramSourceEntry:
    """Individual configured Telegram source in the version-controlled registry."""
    username: str
    domain: str
    expected_language: str
    source_type: SourceType
    enabled: bool = True
    display_name: str | None = None
    description: str | None = None

    def __post_init__(self) -> None:
        if not self.username or not self.username.strip():
            raise ValueError("TelegramSourceEntry 'username' must not be empty.")
        if not self.domain or not self.domain.strip():
            raise ValueError("TelegramSourceEntry 'domain' must not be empty.")
        if not self.expected_language or not self.expected_language.strip():
            raise ValueError("TelegramSourceEntry 'expected_language' must not be empty.")


@dataclass
class TelegramSourceRegistry:
    """In-memory representation of the version-controlled Telegram Source Registry."""
    version: str = "1.0.0"
    description: str = ""
    sources: list[TelegramSourceEntry] = field(default_factory=list)

    def get_enabled_sources(self) -> list[TelegramSourceEntry]:
        """Return all enabled sources preserving registry declaration order."""
        return [s for s in self.sources if s.enabled]

    def get_enabled_usernames(self) -> list[str]:
        """Return list of enabled channel usernames preserving registry declaration order."""
        return [s.username for s in self.sources if s.enabled]

    def get_by_username(self, username: str) -> TelegramSourceEntry | None:
        """Find source entry by channel username (case-insensitive, '@'-agnostic)."""
        clean_target = username.strip().lstrip("@").lower()
        for source in self.sources:
            if source.username.strip().lstrip("@").lower() == clean_target:
                return source
        return None

    def __len__(self) -> int:
        return len(self.sources)


def find_default_registry_path() -> Path:
    """Locate the default version-controlled telegram_sources.json path."""
    repo_root = find_repo_root()
    primary_candidate = repo_root / "backend" / "config" / "telegram_sources.json"
    if primary_candidate.is_file():
        return primary_candidate.resolve()

    # Fallback to config directory relative to current file
    fallback = Path(__file__).resolve().parents[3] / "config" / "telegram_sources.json"
    return fallback.resolve()


def load_telegram_source_registry(
    registry_path: Path | str | None = None,
) -> TelegramSourceRegistry:
    """Load, validate, and return the version-controlled Telegram Source Registry.
    
    Args:
        registry_path: Optional path to JSON registry file. Defaults to
                       backend/config/telegram_sources.json.
                       
    Returns:
        TelegramSourceRegistry: Validated source registry.
        
    Raises:
        FileNotFoundError: If the registry JSON file does not exist.
        ValueError: If JSON is malformed, missing required fields, or has invalid types.
    """
    if registry_path is not None:
        target_path = Path(registry_path).resolve()
    else:
        target_path = find_default_registry_path()

    if not target_path.is_file():
        raise FileNotFoundError(
            f"Telegram source registry file not found at: {target_path}"
        )

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data: Any = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Malformed JSON in Telegram source registry '{target_path}': {e}") from e

    if not isinstance(data, dict):
        raise ValueError(
            f"Telegram source registry root must be a JSON object, got {type(data).__name__}."
        )

    raw_sources = data.get("sources")
    if raw_sources is None:
        raise ValueError("Telegram source registry is missing required 'sources' list.")

    if not isinstance(raw_sources, list):
        raise ValueError(
            f"Telegram source registry 'sources' must be a list, got {type(raw_sources).__name__}."
        )

    validated_sources: list[TelegramSourceEntry] = []
    seen_usernames: set[str] = set()

    for idx, item in enumerate(raw_sources):
        if not isinstance(item, dict):
            raise ValueError(
                f"Source entry at index {idx} must be a JSON object, got {type(item).__name__}."
            )

        # Required fields check
        required_fields = ("username", "domain", "expected_language", "source_type")
        missing = [f for f in required_fields if f not in item or item[f] is None]
        if missing:
            raise ValueError(
                f"Source entry at index {idx} is missing required field(s): {', '.join(missing)}."
            )

        raw_source_type = str(item["source_type"]).strip().lower()
        try:
            source_type = SourceType(raw_source_type)
        except ValueError:
            valid_types = [t.value for t in SourceType]
            raise ValueError(
                f"Invalid source_type '{item['source_type']}' at index {idx}. "
                f"Allowed values are: {', '.join(valid_types)}."
            )

        username = str(item["username"]).strip()
        if not username:
            raise ValueError(f"Empty username at index {idx}.")

        clean_user_key = username.lstrip("@").lower()
        if clean_user_key in seen_usernames:
            logger.warning("Duplicate username '%s' found in registry at index %d; skipping duplicate.", username, idx)
            continue
        seen_usernames.add(clean_user_key)

        enabled = bool(item.get("enabled", True))
        display_name = str(item["display_name"]).strip() if item.get("display_name") else None
        description = str(item["description"]).strip() if item.get("description") else None

        entry = TelegramSourceEntry(
            username=username,
            domain=str(item["domain"]).strip(),
            expected_language=str(item["expected_language"]).strip(),
            source_type=source_type,
            enabled=enabled,
            display_name=display_name,
            description=description,
        )
        validated_sources.append(entry)

    registry = TelegramSourceRegistry(
        version=str(data.get("version", "1.0.0")),
        description=str(data.get("description", "")),
        sources=validated_sources,
    )

    logger.info(
        "Loaded Telegram source registry from '%s' (%d total, %d enabled).",
        target_path.name,
        len(registry.sources),
        len(registry.get_enabled_sources()),
    )
    return registry
