"""Standalone entry point to launch the TRAJECT Telegram Bot service."""

import asyncio
import logging
import sys

from app.bot.client import create_bot, create_dispatcher
from app.bot.config import get_bot_settings
from app.bot.services.alert_listener import WebSocketAlertListener

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("traject.bot.main")


async def main() -> None:
    """Initialize bot, start WebSocket alert listener, and run long-polling."""
    settings = get_bot_settings()

    if not settings.is_configured:
        logger.error(
            "\n"
            "========================================================================\n"
            "  [TRAJECT BOT ERROR] TELEGRAM_BOT_TOKEN is not configured!\n"
            "========================================================================\n"
            "  To run the Telegram Bot:\n"
            "  1. Open Telegram and message https://t.me/BotFather\n"
            "  2. Create a bot via /newbot and copy the API token provided\n"
            "  3. Add the token to your .env file at the repository root:\n"
            "     TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz\n"
            "  4. (Optional) Set TELEGRAM_ALERT_CHAT_ID to receive real-time alerts\n"
            "========================================================================\n"
        )
        sys.exit(1)

    logger.info("Initializing TRAJECT Telegram Bot...")
    bot = create_bot(settings)
    dp = create_dispatcher()

    # Get bot user info for confirmation
    bot_info = await bot.get_me()
    logger.info("Bot authenticated successfully: @%s (ID: %s)", bot_info.username, bot_info.id)

    # Start live WebSocket alert subscriber in background
    alert_listener = WebSocketAlertListener(bot=bot, settings=settings)
    alert_listener.start()

    logger.info("TRAJECT Telegram Bot is active and listening for analyst commands!")
    logger.info("Alert notifications destination: %s", settings.alert_chat_id or "NONE (configure TELEGRAM_ALERT_CHAT_ID)")

    try:
        # Resolve update types and start long polling
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        logger.info("Shutting down Telegram Bot...")
        await alert_listener.stop()
        await bot.session.close()
        logger.info("Bot cleanly stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Process terminated by user.")
