"""Inline keyboard callback query handlers."""

import logging
from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.bot.handlers.commands import handle_narratives, handle_trends

logger = logging.getLogger("traject.bot.handlers.callbacks")

router = Router(name="callbacks")


@router.callback_query(F.data.startswith("cmd:"))
async def handle_command_callback(callback: CallbackQuery) -> None:
    """Handle menu shortcuts triggered from inline buttons."""
    data = callback.data or ""
    action = data.split(":", 1)[1] if ":" in data else ""

    await callback.answer()
    if not callback.message:
        return

    if action == "narratives":
        await handle_narratives(callback.message, tier_filter=None)
    elif action == "trends":
        await handle_trends(callback.message)


@router.callback_query(F.data.startswith("narr:"))
async def handle_narrative_detail_callback(callback: CallbackQuery) -> None:
    """Handle clicking on a specific narrative ID."""
    data = callback.data or ""
    narr_id = data.split(":", 1)[1] if ":" in data else ""
    await callback.answer(f"Viewing narrative: {narr_id}")


@router.callback_query(F.data.startswith("link:"))
async def handle_link_callback(callback: CallbackQuery) -> None:
    """Handle web link clicks when running in local development (avoiding Telegram URL errors)."""
    data = callback.data or ""
    path = data.split(":", 1)[1] if ":" in data else ""
    from app.bot.config import get_bot_settings

    settings = get_bot_settings()
    full_url = f"{settings.dashboard_web_url.rstrip('/')}/{path.lstrip('/')}" if path else settings.dashboard_web_url
    await callback.answer(f"Open in your browser:\n{full_url}", show_alert=True)

