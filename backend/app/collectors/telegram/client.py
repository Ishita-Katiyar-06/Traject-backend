import os
from dataclasses import dataclass
from typing import Any
from telethon import TelegramClient

from app.core.config import load_project_env


@dataclass
class TelegramCredentials:
    """Encapsulates Telegram MTProto credentials with strict secret masking."""
    api_id: int
    api_hash: str
    session: str = "traject_collector_session"
    phone: str | None = None

    @classmethod
    def from_env(cls) -> "TelegramCredentials":
        """Load Telegram credentials from environment variables or repository root .env."""
        load_project_env()

        raw_api_id = os.getenv("TELEGRAM_API_ID")
        if not raw_api_id:
            raise ValueError(
                "TELEGRAM_API_ID is required but missing from environment variables or repository-root .env."
            )

        try:
            api_id = int(raw_api_id.strip())
        except ValueError:
            raise ValueError(
                f"TELEGRAM_API_ID must be a valid integer, got '{raw_api_id}'."
            )

        api_hash = os.getenv("TELEGRAM_API_HASH")
        if not api_hash or not api_hash.strip():
            raise ValueError(
                "TELEGRAM_API_HASH is required but missing or empty in environment variables."
            )

        session = (
            os.getenv("TELEGRAM_SESSION")
            or os.getenv("TELEGRAM_SESSION_NAME")
            or "traject_collector_session"
        ).strip()

        raw_phone = os.getenv("TELEGRAM_PHONE")
        phone = raw_phone.strip() if raw_phone and raw_phone.strip() else None

        return cls(api_id=api_id, api_hash=api_hash.strip(), session=session, phone=phone)

    def __repr__(self) -> str:
        masked_hash = f"{self.api_hash[:3]}...{self.api_hash[-3:]}" if len(self.api_hash) > 6 else "***"
        masked_phone = f"{self.phone[:3]}...{self.phone[-2:]}" if self.phone and len(self.phone) > 5 else "***"
        return f"TelegramCredentials(api_id=***, api_hash={masked_hash}, session='{self.session}', phone={masked_phone})"

    def __str__(self) -> str:
        return self.__repr__()



class TelegramClientFactory:
    """Factory to safely instantiate Telethon TelegramClient instances."""

    @staticmethod
    def create_client(credentials: TelegramCredentials, **kwargs: Any) -> TelegramClient:
        """Create and return a Telethon client instance."""
        return TelegramClient(
            session=credentials.session,
            api_id=credentials.api_id,
            api_hash=credentials.api_hash,
            **kwargs,
        )
