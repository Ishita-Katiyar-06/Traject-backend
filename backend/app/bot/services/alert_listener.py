"""Asynchronous WebSocket alert subscriber listening to TRAJECT /ws/live feed."""

import asyncio
import json
import logging
from typing import Any

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
import aiohttp

from app.bot.config import BotSettings, get_bot_settings, make_link_button

logger = logging.getLogger("traject.bot.alert_listener")


class WebSocketAlertListener:
    """Listens for real-time in-flight alerts from backend and dispatches formatted Telegram notifications."""

    def __init__(self, bot: Bot, settings: BotSettings | None = None) -> None:
        self.bot = bot
        self.settings = settings or get_bot_settings()
        self.ws_url = self.settings.backend_ws_url
        self.alert_chat_id = self.settings.alert_chat_id
        self._is_running: bool = False
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        """Start the background WebSocket subscriber task."""
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self._listen_loop())
        logger.info("WebSocket alert listener started connecting to %s", self.ws_url)

    async def stop(self) -> None:
        """Stop the background subscriber task."""
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("WebSocket alert listener stopped.")

    async def _listen_loop(self) -> None:
        """Continuous connection and reconnect loop with backoff."""
        backoff = 2.0
        while self._is_running:
            try:
                async with aiohttp.ClientSession() as session:
                    logger.info("[WS-Alerts] Connecting to %s...", self.ws_url)
                    async with session.ws_connect(self.ws_url, heartbeat=20.0) as ws:
                        logger.info("[WS-Alerts] Connected to live backend stream.")
                        backoff = 2.0  # Reset backoff on successful connection

                        async for msg in ws:
                            if not self._is_running:
                                break
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                try:
                                    payload = json.loads(msg.data)
                                    await self._handle_incoming_event(payload)
                                except json.JSONDecodeError:
                                    pass
                            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                                logger.warning("[WS-Alerts] WebSocket connection closed by server.")
                                break
            except asyncio.CancelledError:
                break
            except Exception as exc:
                if self._is_running:
                    logger.debug("[WS-Alerts] Connection failed: %s. Reconnecting in %.1fs...", exc, backoff)
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 1.5, 30.0)

    async def _handle_incoming_event(self, event: dict[str, Any]) -> None:
        """Process incoming broadcast events from the backend."""
        event_type = event.get("type")
        if event_type != "alert_triggered":
            return

        data = event.get("data", {})
        if not data:
            return

        logger.info("[WS-Alerts] Real-time alert received: %s", data.get("id"))
        if not self.alert_chat_id:
            logger.debug("[WS-Alerts] TELEGRAM_ALERT_CHAT_ID not configured; alert suppressed.")
            return

        # Format alert notification
        text = self._format_alert_message(data)
        markup = self._build_alert_markup(data)

        try:
            await self.bot.send_message(
                chat_id=self.alert_chat_id,
                text=text,
                parse_mode="HTML",
                reply_markup=markup,
                disable_web_page_preview=True,
            )
        except Exception as send_err:
            logger.warning("[WS-Alerts] Could not deliver alert message to %s: %s", self.alert_chat_id, send_err)

    @staticmethod
    def _format_alert_message(data: dict[str, Any]) -> str:
        """Format an alert payload into clean, high-impact HTML."""
        severity = (data.get("severity") or "high").upper()
        sev_icon = "🔴" if severity == "CRITICAL" else "🟠" if severity == "HIGH" else "🟡"
        
        title = data.get("title", "High Priority Social Signal Breach")
        claim = data.get("claim", "")
        score = data.get("priority_score", 0.0)
        indicators = data.get("indicators", [])
        domains = data.get("domains", ["Geopolitics"])
        domain_str = ", ".join(d.capitalize() for d in domains)

        lines = [
            f"<b>{sev_icon} [TRAJECT ALERT] {severity} SIGNAL</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"<b>Incident:</b> {title}",
            f"<b>Domain:</b> {domain_str}",
            f"<b>Priority Score:</b> <code>{score:.3f}</code>",
        ]

        if claim:
            clean_claim = claim[:160] + ("..." if len(claim) > 160 else "")
            lines.append(f"<b>Observed Claim:</b> <i>\"{clean_claim}\"</i>")

        if indicators:
            lines.append("\n<b>Key Forensic Indicators:</b>")
            for ind in indicators[:3]:
                lines.append(f"• {ind}")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("<i>Automated in-flight detection by TRAJECT Live Collector</i>")
        return "\n".join(lines)

    @staticmethod
    def _build_alert_markup(data: dict[str, Any]) -> InlineKeyboardMarkup:
        """Generate interactive buttons for the alert message."""
        narrative_id = data.get("narrative_id", "")
        buttons = [
            [
                make_link_button("🖥️ Open Dashboard", "alerts"),
            ]
        ]
        if narrative_id and not narrative_id.startswith("live_"):
            buttons[0].append(
                InlineKeyboardButton(text="📊 View Narrative", callback_data=f"narr:{narrative_id[:20]}")
            )

        return InlineKeyboardMarkup(inline_keyboard=buttons)
