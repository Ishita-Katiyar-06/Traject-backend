"""Configuration loader and settings validation for TRAJECT Telegram Bot."""

from aiogram.types import InlineKeyboardButton
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Self

from app.core.config import find_repo_root, load_project_env


@dataclass(frozen=True)
class BotSettings:
    """Encapsulates Telegram Bot configuration with secret masking and fail-safe defaults."""

    bot_token: str
    alert_chat_id: str | None
    backend_api_base_url: str
    backend_ws_url: str
    dashboard_web_url: str
    repo_root: Path

    @classmethod
    def from_env(cls) -> Self:
        """Load bot settings from environment variables or repository root .env."""
        load_project_env()

        raw_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        if not raw_token or raw_token == "your_telegram_bot_token_from_botfather":
            raw_token = ""

        alert_chat = os.getenv("TELEGRAM_ALERT_CHAT_ID", "").strip()
        if not alert_chat or alert_chat == "your_target_channel_or_chat_id":
            alert_chat = None

        api_url = os.getenv(
            "BACKEND_API_BASE_URL", "http://127.0.0.1:8000/api/v1"
        ).rstrip("/")
        ws_url = os.getenv("BACKEND_WS_URL", "ws://127.0.0.1:8000/api/v1/ws/live")
        web_url = os.getenv(
            "DASHBOARD_WEB_URL", os.getenv("VITE_APP_URL", "http://localhost:3000")
        ).rstrip("/")

        root = find_repo_root()

        return cls(
            bot_token=raw_token,
            alert_chat_id=alert_chat,
            backend_api_base_url=api_url,
            backend_ws_url=ws_url,
            dashboard_web_url=web_url,
            repo_root=root,
        )

    @property
    def is_configured(self) -> bool:
        """True if a non-empty BotFather token is provided."""
        return bool(
            self.bot_token and len(self.bot_token) > 10 and ":" in self.bot_token
        )

    def __repr__(self) -> str:
        masked_token = (
            f"{self.bot_token[:6]}...{self.bot_token[-4:]}"
            if len(self.bot_token) > 10
            else "***"
        )
        return (
            f"BotSettings(bot_token='{masked_token}', "
            f"alert_chat_id='{self.alert_chat_id}', "
            f"backend_api_base_url='{self.backend_api_base_url}', "
            f"backend_ws_url='{self.backend_ws_url}', "
            f"dashboard_web_url='{self.dashboard_web_url}')"
        )


_bot_settings: BotSettings | None = None


def get_bot_settings() -> BotSettings:
    """Retrieve global cached BotSettings singleton."""
    global _bot_settings
    if _bot_settings is None:
        _bot_settings = BotSettings.from_env()
    return _bot_settings


def make_link_button(text: str, path: str = "") -> "InlineKeyboardButton":
    """Safely build an inline button for web dashboard links.
    Telegram forbids 'localhost' or '127.0.0.1' in inline button URLs.
    If the URL is local, uses callback_data so Telegram doesn't reject it.
    """
    from aiogram.types import InlineKeyboardButton

    settings = get_bot_settings()
    base = settings.dashboard_web_url.rstrip("/")
    if (
        base.startswith("https://")
        and "localhost" not in base
        and "127.0.0.1" not in base
    ):
        clean_path = path.lstrip("/")
        return InlineKeyboardButton(
            text=text, url=f"{base}/{clean_path}" if clean_path else base
        )
    return InlineKeyboardButton(text=text, callback_data=f"link:{path.lstrip('/')}")
