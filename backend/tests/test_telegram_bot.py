"""Unit and integration tests for the TRAJECT Telegram Bot package."""

from datetime import datetime, timezone
import pytest

from app.bot.config import BotSettings
from app.bot.services.alert_listener import WebSocketAlertListener


def test_bot_settings_is_configured_logic():
    """Verify BotSettings correctly distinguishes between valid, empty, and placeholder tokens."""
    unconfigured = BotSettings(
        bot_token="",
        alert_chat_id=None,
        backend_api_base_url="http://127.0.0.1:8000/api/v1",
        backend_ws_url="ws://127.0.0.1:8000/api/v1/ws/live",
        dashboard_web_url="http://localhost:3000",
        repo_root=None,
    )
    assert not unconfigured.is_configured

    configured = BotSettings(
        bot_token="123456789:ABCdefGhIJKlmNoPQRstuVWXyz",
        alert_chat_id="-1001234567890",
        backend_api_base_url="http://127.0.0.1:8000/api/v1",
        backend_ws_url="ws://127.0.0.1:8000/api/v1/ws/live",
        dashboard_web_url="http://localhost:3000",
        repo_root=None,
    )
    assert configured.is_configured
    assert "..." in repr(configured)
    assert "PQRstu" not in repr(configured)


def test_alert_message_formatter():
    """Verify WebSocketAlertListener formats real-time alerts into clean, high-impact HTML."""
    sample_alert = {
        "id": "alt-test-001",
        "narrative_id": "narrative_000005",
        "topic_id": "topic_002",
        "title": "High Velocity Forward Cascade",
        "claim": "Massive drone strikes reported near regional fuel distribution hub.",
        "severity": "critical",
        "priority_score": 0.812,
        "indicators": [
            "Rapid multi-channel forward cascade observed",
            "Views: 18,500 • Forwards: 42",
            "Domain: Geopolitics",
        ],
        "domains": ["geopolitics"],
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }

    formatted = WebSocketAlertListener._format_alert_message(sample_alert)

    assert "🔴 [TRAJECT ALERT] CRITICAL SIGNAL" in formatted
    assert "High Velocity Forward Cascade" in formatted
    assert "0.812" in formatted
    assert "fuel distribution hub" in formatted
    assert "Rapid multi-channel forward cascade observed" in formatted

    markup = WebSocketAlertListener._build_alert_markup(sample_alert)
    assert len(markup.inline_keyboard) == 1
    assert len(markup.inline_keyboard[0]) == 2
    assert markup.inline_keyboard[0][0].text == "🖥️ Open Dashboard"
    assert markup.inline_keyboard[0][1].text == "📊 View Narrative"
