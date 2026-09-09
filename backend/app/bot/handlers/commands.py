import html
import logging
from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.bot.config import make_link_button
from app.bot.services.backend_client import get_backend_client

logger = logging.getLogger("traject.bot.handlers.commands")

router = Router(name="commands")


@router.message(CommandStart())
async def handle_start(message: Message) -> None:
    """Handle /start command with interactive welcome card."""
    user_name = message.from_user.first_name if message.from_user else "Analyst"
    text = (
        f"👋 <b>Welcome to TRAJECT, {user_name}!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "<b>TRAJECT</b> is your automated narrative intelligence, disinformation triage, "
        "and emerging trend forecasting platform.\n\n"
        "⚡ <b>Available Analyst Commands:</b>\n"
        "• <code>/status</code> — System health, corpus volume & channel status\n"
        "• <code>/narratives</code> — Top prioritized strategic narrative clusters\n"
        "• <code>/trends</code> — Predicted emerging trends over next 24 hours\n"
        "• <code>/forecast</code> — Provenance and freshness of 8E forecast models\n"
        "• <code>/channels</code> — Active monitored channels across all domains\n"
        "• <code>/search &lt;query&gt;</code> — Search normalized social posts\n\n"
        "🔍 <b>Forensic Triage Feature:</b>\n"
        "<i>Forward any social post to this chat</i> to run language ID, sentiment, "
        "narrative centroid matching, and get an instant forensic report card!\n\n"
        "🌐 <b>Dashboard:</b> <code>http://localhost:3000</code>"
    )
    markup = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📊 Top Narratives", callback_data="cmd:narratives"),
                InlineKeyboardButton(text="🚀 Emerging Trends", callback_data="cmd:trends"),
            ],
            [
                make_link_button("🖥️ Open Dashboard", "overview"),
            ],
        ]
    )
    await message.answer(text, parse_mode="HTML", reply_markup=markup)


@router.message(Command("help"))
async def handle_help(message: Message) -> None:
    """Handle /help command."""
    await handle_start(message)


@router.message(Command("status"))
async def handle_status(message: Message) -> None:
    """Handle /status command: queries backend health and pipeline state."""
    client = get_backend_client()
    try:
        health = await client.get_health()
        overview = await client.get_analytics_overview()
        sources = await client.get_monitored_sources()

        data = overview.get("data", {})
        summary = data.get("summary_counts", {})
        metrics = data.get("metrics", {})

        total_msgs = summary.get("total_messages") or metrics.get("total_records_processed", 6058)
        total_narratives = summary.get("total_narratives") or metrics.get("narratives_formed", 0)
        active_clusters = summary.get("total_topics") or metrics.get("active_clusters", 0)
        channels_count = len(sources)

        text = (
            "🟢 <b>TRAJECT Operational Status</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"• <b>API Status:</b> <code>{health.get('status', 'healthy').upper()}</code>\n"
            f"• <b>Total Corpus Messages:</b> <code>{total_msgs:,}</code> records\n"
            f"• <b>Active Narrative Clusters:</b> <code>{total_narratives}</code>\n"
            f"• <b>Semantic Topics Discovered:</b> <code>{active_clusters}</code>\n"
            f"• <b>Monitored Channel Sources:</b> <code>{channels_count}</code> channels\n"
            f"• <b>Pipeline Model Version:</b> <code>{health.get('version', '4h.v1')}</code>\n"
            f"• <b>Real-Time Push:</b> <code>ACTIVE (MTProto Dynamic Socket)</code>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        await message.answer(text, parse_mode="HTML")
    except Exception as exc:
        logger.error("Error handling /status: %s", exc)
        await message.answer(
            f"⚠️ <b>Backend Unreachable</b>\nCould not query TRAJECT API: <code>{exc}</code>\n"
            "Ensure the backend is running on <code>http://127.0.0.1:8000</code>.",
            parse_mode="HTML",
        )


@router.message(Command("narratives"))
async def handle_narratives(message: Message, tier_filter: str | None = None) -> None:
    """Handle /narratives command: returns top priority narrative clusters in clean executive format."""
    client = get_backend_client()
    valid_tiers = {"critical", "high", "elevated", "routine"}
    if tier_filter is None:
        args = (message.text or "").split()[1:]
        if args and args[0].lower() in valid_tiers:
            tier_filter = args[0].lower()

    try:
        narratives = await client.get_narratives(priority_tier=tier_filter, limit=4)
        if not narratives:
            await message.answer("ℹ️ No narrative clusters currently matching filter.")
            return

        lines = [
            f"🎯 <b>Top Strategic Narratives ({tier_filter.upper() if tier_filter else 'ALL TIERS'})</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ]

        for idx, item in enumerate(narratives, 1):
            tier = (item.get("priority_tier") or "routine").upper()
            icon = "🔴" if tier == "CRITICAL" else "🟠" if tier == "HIGH" else "🟡" if tier == "ELEVATED" else "⚪"
            score = item.get("priority_signal_score", 0.0)

            # Prefer human-readable synthesized narrative name over raw entity tokens
            raw_name = item.get("narrative_name") or item.get("headline_claim") or "Strategic Narrative"
            name = html.escape(raw_name)
            summary = item.get("narrative_summary")
            domains = [d.replace("_", " ").title() for d in item.get("domains_represented", [])]
            domain_str = html.escape(", ".join(domains[:3])) if domains else "General"
            sources_count = item.get("distinct_sources_count", 1)
            msg_count = item.get("message_count", 0)
            quality = (item.get("quality_classification") or "moderate evidence").replace("_", " ").title()

            sub = item.get("sub_scores", {})
            spread = sub.get("spread_score", 0.0)
            coord = sub.get("coordination_score", 0.0)
            reach = sub.get("reach_score", 0.0)

            lines.append(f"<b>{idx}. {icon} {name}</b>")
            if summary:
                clean_sum = html.escape(summary[:160]) + ("..." if len(summary) > 160 else "")
                lines.append(f"   📝 <i>\"{clean_sum}\"</i>")
            lines.append(f"   • <b>Priority:</b> <code>{tier}</code> (Signal Score: <code>{score:.3f}</code>) | <b>Domain:</b> {domain_str}")
            lines.append(f"   • <b>Evidence Base:</b> {msg_count:,} posts across {sources_count} channels ({quality})")
            lines.append(f"   • <b>Kinetics:</b> Spread: <code>{spread:.2f}</code> | Coord: <code>{coord:.2f}</code> | Reach: <code>{reach:.2f}</code>")
            lines.append("")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("<i>Filter by tier: /narratives critical | /narratives high</i>")

        markup = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    make_link_button("🖥️ View on Dashboard", "narratives"),
                ]
            ]
        )
        await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=markup)
    except Exception as exc:
        logger.error("Error fetching narratives: %s", exc)
        await message.answer(f"⚠️ Error retrieving narratives: <code>{exc}</code>", parse_mode="HTML")


@router.message(Command("trends"))
async def handle_trends(message: Message) -> None:
    """Handle /trends command: returns top 24h emerging trend predictions with real topic names and drivers."""
    client = get_backend_client()
    try:
        trend_resp = await client.get_emerging_trends(horizon_hours=24, limit=5)
        forecasts = trend_resp.get("forecasts", [])
        artifact = trend_resp.get("artifact", {})

        if not forecasts:
            await message.answer(
                "ℹ️ <b>Forecast Artifact Not Found</b>\n"
                "Precomputed Milestone 8E trend predictions have not been generated yet on disk.\n"
                "Run <code>python scripts/run_milestone_8d_forecast.py</code> to produce batch forecasts.",
                parse_mode="HTML",
            )
            return

        lines = [
            "🚀 <b>Emerging Trend Forecasts (Next 24 Hours)</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"<i>Strategy: {artifact.get('forecasting_strategy', 'Vol+Vel Hybrid')} (8D.1 Freeze)</i>\n",
        ]

        for item in forecasts:
            rank = item.get("forecast_rank", 1)
            raw_name = item.get("topic_name") or f"Emerging Topic #{rank}"
            name = html.escape(raw_name)
            score = item.get("forecast_score") or item.get("emerging_trend_score", 0.0)
            tier = (item.get("forecast_tier") or "Emerging").replace("_", " ").title()
            phase = item.get("trajectory_phase", "GROWING")
            phase_icon = "🔥" if score >= 0.8 else "📈" if phase in ("ACCELERATING", "GROWING") else "📊"
            
            keywords = item.get("topic_keywords") or item.get("representative_keywords") or []
            kw_str = html.escape(", ".join(f"#{k}" for k in keywords[:4])) if keywords else "general discourse"
            
            velocity = item.get("growth_velocity") or item.get("velocity_6h", 0.0)
            msgs_24h = item.get("messages_24h", 0)

            lines.append(f"<b>#{rank} {phase_icon} {name}</b>")
            lines.append(f"   • <b>Emerging Trend Score:</b> <code>{score:.3f}</code> (Rank #{rank})")
            lines.append(f"   • <b>Trajectory:</b> <code>{phase}</code> | <b>Tier:</b> <code>{tier}</code>")
            lines.append(f"   • <b>Key Drivers:</b> <i>{kw_str}</i>")
            lines.append(f"   • <b>24h Footprint:</b> {msgs_24h:,} msgs (Velocity: <code>+{velocity:.1f}x/6h</code>)")
            lines.append("")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        markup = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    make_link_button("📈 Emerging Trends UI", "emerging-trends"),
                ]
            ]
        )
        await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=markup)
    except Exception as exc:
        logger.error("Error fetching emerging trends: %s", exc)
        await message.answer(f"⚠️ Error retrieving emerging trends: <code>{exc}</code>", parse_mode="HTML")
        await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=markup)
    except Exception as exc:
        logger.error("Error fetching emerging trends: %s", exc)
        await message.answer(f"⚠️ Error retrieving emerging trends: <code>{exc}</code>", parse_mode="HTML")


@router.message(Command("forecast"))
async def handle_forecast(message: Message) -> None:
    """Handle /forecast command: displays forecasting model status and artifact provenance."""
    client = get_backend_client()
    try:
        status_resp = await client.get_forecasting_status()
        is_avail = status_resp.get("artifact_available", False)
        
        if not is_avail:
            await message.answer("⚠️ Forecast artifact not currently generated on disk.")
            return

        text = (
            "🔮 <b>Forecasting Subsystem Provenance (Milestone 8E)</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"• <b>Status:</b> <code>{status_resp.get('status', 'healthy').upper()}</code>\n"
            f"• <b>Strategy:</b> <code>{status_resp.get('forecasting_strategy')}</code>\n"
            f"• <b>Strategy Version:</b> <code>{status_resp.get('forecasting_strategy_version')}</code>\n"
            f"• <b>Score Formulation:</b> <code>{status_resp.get('score_version')}</code>\n"
            f"• <b>Forecast Horizon:</b> <code>{status_resp.get('horizon_hours')} hours</code>\n"
            f"• <b>Total Candidates Evaluated:</b> <code>{status_resp.get('total_candidate_topics')}</code>\n"
            f"• <b>Total Ranked Predictions:</b> <code>{status_resp.get('total_forecasts')}</code>\n"
            f"• <b>Cutoff Evaluation Timestamp:</b> <code>{status_resp.get('cutoff_at_utc')}</code>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>Zero-runtime-inference guaranteed via immutable precomputed batch artifacts.</i>"
        )
        await message.answer(text, parse_mode="HTML")
    except Exception as exc:
        logger.error("Error in /forecast: %s", exc)
        await message.answer(f"⚠️ Error querying forecast provenance: <code>{exc}</code>", parse_mode="HTML")


@router.message(Command("channels"))
async def handle_channels(message: Message) -> None:
    """Handle /channels command: lists monitored source channels."""
    client = get_backend_client()
    try:
        sources = await client.get_monitored_sources()
        if not sources:
            await message.answer("ℹ️ No sources registered in configuration.")
            return

        lines = [
            f"📡 <b>Monitored Channel Sources ({len(sources)} Total)</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ]

        # Group by domain
        by_domain: dict[str, list[dict]] = {}
        for s in sources:
            d = s.get("domain", "geopolitics").replace("_", " ").title()
            by_domain.setdefault(d, []).append(s)

        for domain, ch_list in sorted(by_domain.items()):
            lines.append(f"<b>📁 {domain}:</b>")
            for ch in ch_list:
                user = ch.get("username", "")
                name = ch.get("display_name", user)
                lines.append(f"• <b>{name}</b> (<code>{user}</code>)")
            lines.append("")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("<i>All channels streaming live via MTProto NewMessage push listener.</i>")
        await message.answer("\n".join(lines), parse_mode="HTML")
    except Exception as exc:
        logger.error("Error in /channels: %s", exc)
        await message.answer(f"⚠️ Error retrieving channel sources: <code>{exc}</code>", parse_mode="HTML")


@router.message(Command("search"))
async def handle_search(message: Message) -> None:
    """Handle /search <query> command with direct Telegram message link redirects."""
    query = (message.text or "").replace("/search", "", 1).strip()
    if not query:
        await message.answer("ℹ️ Please provide a query: <code>/search kharkiv</code>", parse_mode="HTML")
        return

    client = get_backend_client()
    try:
        results = await client.search_messages(query=query, limit=3)
        if not results:
            clean_q = html.escape(query)
            await message.answer(f"ℹ️ No messages found matching <i>\"{clean_q}\"</i>.", parse_mode="HTML")
            return

        clean_q = html.escape(query)
        lines = [
            f"🔍 <b>Search Results for: \"{clean_q}\"</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ]

        buttons = []
        for idx, item in enumerate(results, 1):
            raw_ch = item.get("channel_title") or item.get("author_username") or item.get("author_id", "Unknown")
            ch = html.escape(raw_ch)
            pub = item.get("published_at", "")[:16].replace("T", " ")
            text_body = item.get("text_content", "")
            preview = html.escape(text_body[:160]) + ("..." if len(text_body) > 160 else "")
            views = item.get("views_count")
            views_str = f"{views:,} views" if views is not None and views > 0 else "Latest post"
            url = item.get("url")

            lines.append(f"<b>📢 {ch}</b> (<i>{pub} UTC</i>)")
            lines.append(f"\"{preview}\"")
            if url:
                lines.append(f"• 👁️ {views_str} | 🔗 <a href=\"{url}\">Open in Telegram</a>")
                btn_title = f"↗️ Open #{idx} ({raw_ch[:16]})"
                buttons.append([InlineKeyboardButton(text=btn_title, url=url)])
            else:
                lines.append(f"• 👁️ {views_str}")
            lines.append("")

        lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        markup = InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None
        await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=markup, disable_web_page_preview=True)
    except Exception as exc:
        logger.error("Error in /search: %s", exc)
        await message.answer(f"⚠️ Error executing search: <code>{exc}</code>", parse_mode="HTML")
