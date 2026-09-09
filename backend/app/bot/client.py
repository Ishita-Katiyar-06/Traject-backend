"""aiogram Bot and Dispatcher factory module."""

import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from app.bot.config import BotSettings, get_bot_settings
from app.bot.handlers import callbacks, commands, triage

logger = logging.getLogger("traject.bot.client")


def create_bot(settings: BotSettings | None = None) -> Bot:
    """Instantiate and configure the official aiogram Bot client."""
    cfg = settings or get_bot_settings()
    if not cfg.is_configured:
        raise ValueError(
            "TELEGRAM_BOT_TOKEN is missing or unconfigured in environment/.env. "
            "Please obtain a valid token from https://t.me/BotFather."
        )

    return Bot(
        token=cfg.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def create_dispatcher() -> Dispatcher:
    """Instantiate and configure the aiogram Dispatcher with registered routers."""
    dp = Dispatcher()

    # Register handlers
    dp.include_router(commands.router)
    dp.include_router(triage.router)
    dp.include_router(callbacks.router)

    return dp
