"""Forward-to-Triage handler for automated single-message ML forensic evaluation."""

import html
import logging
from aiogram import F, Router
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.bot.config import make_link_button
from app.bot.services.backend_client import get_backend_client

logger = logging.getLogger("traject.bot.handlers.triage")

router = Router(name="triage")


@router.message(F.forward_origin | F.forward_from | (F.text & ~F.text.startswith("/")))
async def handle_forwarded_post_triage(message: Message) -> None:
    """Intercept forwarded posts or unformatted text in PM for on-demand ML triage."""
    # Only process in private chat or if explicitly forwarded
    if message.chat.type != "private" and not (message.forward_origin or message.forward_from):
        return

    text_to_triage = message.text or message.caption or ""
    if len(text_to_triage.strip()) < 5:
        await message.reply("ℹ️ Message is too short to perform forensic semantic analysis.")
        return

    # Extract origin if forwarded
    origin_name = None
    if message.forward_origin:
        orig = message.forward_origin
        if hasattr(orig, "chat") and getattr(orig.chat, "title", None):
            origin_name = orig.chat.title
        elif hasattr(orig, "sender_user_name") and getattr(orig, "sender_user_name"):
            origin_name = orig.sender_user_name
        elif hasattr(orig, "sender_user") and getattr(orig.sender_user, "first_name", None):
            origin_name = orig.sender_user.first_name
    elif message.forward_from:
        origin_name = message.forward_from.username or message.forward_from.first_name

    status_msg = await message.reply("🔍 <i>Extracting embeddings & analyzing forensic fingerprint...</i>", parse_mode="HTML")

    client = get_backend_client()
    try:
        report = await client.triage_message(
            text=text_to_triage,
            forward_origin=origin_name,
        )

        tier = report.get("estimated_priority_tier", "ROUTINE").upper()
        tier_icon = "🔴" if tier == "CRITICAL" else "🟠" if tier == "HIGH" else "🟡" if tier == "ELEVATED" else "⚪"
        score = report.get("estimated_priority_score", 0.0)
        matched_title = report.get("matched_narrative_title")
        matched_summary = report.get("matched_narrative_summary")
        matched_id = report.get("matched_narrative_id")
        sim_pct = report.get("similarity_percentage", 0.0)
        sent_label = report.get("sentiment_label", "NEUTRAL")
        lang = report.get("detected_language", "unknown").upper()
        syndicated = report.get("uncredited_syndication_detected", False)
        indicators = report.get("indicators", [])

        lines = [
            f"<b>{tier_icon} [FORENSIC TRIAGE REPORT] {tier} PRIORITY</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"• <b>Language Detected:</b> <code>{lang}</code> (Confidence: {report.get('language_confidence', 0):.0%})",
            f"• <b>Estimated Priority Score:</b> <code>{score:.3f}</code>",
            f"• <b>Text Sentiment:</b> <code>{sent_label}</code> (Negativity: {report.get('negative_ratio', 0):.0%})",
        ]

        if matched_title and sim_pct >= 25.0:
            clean_title = html.escape(matched_title)
            lines.append(f"• <b>Matched Narrative:</b> <b>{clean_title}</b>")
            if matched_summary:
                clean_context = html.escape(matched_summary[:160] + ("..." if len(matched_summary) > 160 else ""))
                lines.append(f"• <b>Context:</b> <i>\"{clean_context}\"</i>")
            lines.append(f"• <b>Narrative Alignment:</b> <code>{sim_pct:.1f}%</code> match")
        else:
            lines.append("• <b>Narrative Status:</b> <i>Novel Event / Emerging Transmission (No prior correlation)</i>")

        if syndicated:
            lines.append("• ⚠️ <b>Anomalous Syndication:</b> <i>Verbatim uncredited matches detected across multiple channels!</i>")

        if indicators:
            lines.append("\n<b>Key Forensic Indicators:</b>")
            for ind in indicators[:3]:
                lines.append(f"  ✓ {html.escape(str(ind))}")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("<i>On-demand forensic evaluation powered by TRAJECT ML</i>")

        buttons = []
        if matched_id:
            buttons.append([
                make_link_button("📊 View Matched Narrative", f"narratives?id={matched_id}"),
            ])
        buttons.append([
            make_link_button("🖥️ Open Explorer", "explorer"),
        ])

        markup = InlineKeyboardMarkup(inline_keyboard=buttons)
        await status_msg.edit_text("\n".join(lines), parse_mode="HTML", reply_markup=markup)

    except Exception as exc:
        logger.error("Error during message triage: %s", exc)
        await status_msg.edit_text(
            f"⚠️ <b>Triage Evaluation Failed:</b> <code>{exc}</code>\n"
            "Ensure the TRAJECT backend API is running.",
            parse_mode="HTML",
        )
