"""Live Real-Time Telegram Collector Service with Event Listener & In-Flight Alert Detection.

Listens to live MTProto messages across registered public channels via Telethon,
normalizes to CanonicalMessage contracts, updates in-memory indices, evaluates
in-flight threshold alerts, and broadcasts telemetry to active WebSocket clients.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any

from telethon import TelegramClient, events

from app.collectors.telegram.client import TelegramClientFactory, TelegramCredentials
from app.collectors.telegram.serializer import TelethonMessageSerializer
from app.core.config import find_repo_root
from app.normalizers.telegram import TelegramNormalizer
from app.repositories.artifact_repository import ArtifactRepository, get_artifact_repository
from app.schemas.canonical_message import CanonicalMessage
from app.services.streaming_manager import StreamingManager, get_streaming_manager
from app.storage.parquet import append_canonical_messages

logger = logging.getLogger("traject.services.live_collector")


class LiveCollectorService:
    """Manages active MTProto connection, background polling, and real-time alert dispatch."""

    def __init__(
        self,
        repo: ArtifactRepository | None = None,
        streaming_mgr: StreamingManager | None = None,
    ) -> None:
        self.repo = repo or get_artifact_repository()
        self.streaming_manager = streaming_mgr or get_streaming_manager()
        self.client: TelegramClient | None = None
        self.is_running: bool = False
        self._poll_task: asyncio.Task | None = None
        self._join_task: asyncio.Task | None = None
        self._monitored_sources: list[dict[str, Any]] = []
        self._channel_entities: dict[str, Any] = {}
        self._monitored_chat_ids: set[int] = set()
        self._monitored_usernames: set[str] = set()
        self._channel_join_status: dict[str, dict[str, Any]] = {}
        self._last_seen_ids: dict[str, int] = {}
        self._repo_root = find_repo_root()

    def _load_sources(self) -> list[dict[str, Any]]:
        """Load registered Telegram sources from config."""
        config_path = self._repo_root / "backend" / "config" / "telegram_sources.json"
        if not config_path.is_file():
            config_path = self._repo_root / "config" / "telegram_sources.json"
        if config_path.is_file():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                sources = [s for s in data.get("sources", []) if s.get("enabled", True)]
                for s in sources:
                    u = (s.get("username", "") or "").lstrip("@").lower()
                    if u:
                        self._monitored_usernames.add(u)
                        self._channel_join_status[u] = {
                            "status": "pending",
                            "display_name": s.get("display_name", u),
                            "domain": s.get("domain", "geopolitics"),
                        }
                return sources
            except Exception as e:
                logger.warning("Could not read telegram_sources.json: %s", e)
        return []

    async def start(self) -> None:
        """Initialize and start the live Telegram listener, staggered channel joiner, and fallback polling loop."""
        if self.is_running:
            return

        try:
            creds = TelegramCredentials.from_env()
        except Exception as exc:
            logger.warning("Telegram credentials not configured: %s. Real-time MTProto disabled.", exc)
            return

        try:
            self._monitored_sources = self._load_sources()
            self.client = TelegramClientFactory.create_client(creds)
            await self.client.connect()

            if not await self.client.is_user_authorized():
                logger.warning("Telethon session is not authorized. Real-time collection paused.")
                return

            logger.info("Connected and authorized to Telegram MTProto. Initializing live socket push...")

            # 1. Register Dynamic Global Event Listener on the client
            # Catches incoming posts across all joined channels immediately without re-registering
            @self.client.on(events.NewMessage)
            async def handle_new_message(event: Any) -> None:
                try:
                    chat = getattr(event, "chat", None)
                    if not chat and hasattr(event, "get_chat"):
                        try:
                            chat = await event.get_chat()
                        except Exception:
                            pass

                    if not chat:
                        return

                    chat_id = getattr(chat, "id", None)
                    raw_user = getattr(chat, "username", "") or ""
                    chat_username = raw_user.lstrip("@").lower()

                    # Match incoming event against our monitored registry
                    is_monitored = False
                    if chat_id and (chat_id in self._monitored_chat_ids or abs(chat_id) in self._monitored_chat_ids):
                        is_monitored = True
                    elif chat_username and chat_username in self._monitored_usernames:
                        is_monitored = True

                    if is_monitored:
                        await self.process_telethon_message(event.message, chat)
                except Exception as e:
                    logger.error("Error processing incoming live message: %s", e, exc_info=True)

            self.is_running = True
            logger.info("Dynamic MTProto NewMessage push listener active.")

            # 2. Spawn Staggered Auto-Join Worker in background (safe 5-8s intervals, no FloodWait)
            self._join_task = asyncio.create_task(self._staggered_join_loop())

            # 3. Start fallback periodic micro-poll (checks every 15 seconds for missed updates)
            self._poll_task = asyncio.create_task(self._checkpoint_poll_loop())
            logger.info("Live Telegram collection service started successfully.")
        except Exception as exc:
            logger.error("Failed to start LiveCollectorService: %s", exc, exc_info=True)

    async def _staggered_join_loop(self) -> None:
        """Safely join monitored channels sequentially with 5-8s jitter to avoid spam and FloodWait."""
        import random
        from telethon.errors import (
            FloodWaitError,
            UserAlreadyParticipantError,
            ChannelPrivateError,
        )
        from telethon.tl.functions.channels import JoinChannelRequest

        total = len(self._monitored_sources)
        logger.info("[Auto-Joiner] Starting staggered auto-join for %d monitored channels...", total)

        for idx, source in enumerate(self._monitored_sources, 1):
            if not self.is_running or not self.client:
                break

            raw_username = source.get("username", "")
            if not raw_username:
                continue

            username = raw_username.lstrip("@").strip()
            clean_user = username.lower()
            self._monitored_usernames.add(clean_user)

            try:
                # 1. Resolve channel entity
                entity = self._channel_entities.get(clean_user)
                if not entity:
                    try:
                        entity = await self.client.get_entity(username)
                        self._channel_entities[clean_user] = entity
                        cid = getattr(entity, "id", None)
                        if cid:
                            self._channel_entities[str(cid)] = entity
                            self._monitored_chat_ids.add(cid)
                    except Exception as ent_err:
                        logger.warning("[Auto-Joiner] Could not resolve entity for @%s: %s", username, ent_err)
                        self._channel_join_status[clean_user] = {
                            "status": "failed",
                            "error": str(ent_err),
                            "display_name": source.get("display_name", username),
                        }
                        continue

                cid = getattr(entity, "id", None)
                if cid:
                    self._monitored_chat_ids.add(cid)
                    clean_id_str = str(cid)
                    self._channel_entities[clean_id_str] = entity

                # 2. Check if already a participant
                # In Telethon, channels have attribute 'left' (True if user has left or never joined)
                is_already_member = getattr(entity, "left", None) is False
                if is_already_member:
                    logger.info("[Auto-Joiner] Already a participant of @%s (%d/%d)", username, idx, total)
                    self._channel_join_status[clean_user] = {
                        "status": "already_member",
                        "display_name": source.get("display_name", username),
                        "chat_id": cid,
                    }
                    continue

                # 3. Issue JoinChannelRequest
                logger.info("[Auto-Joiner] Joining channel @%s (%d/%d)...", username, idx, total)
                await self.client(JoinChannelRequest(entity))
                logger.info("[Auto-Joiner] Successfully joined @%s (%d/%d) — socket pushes active!", username, idx, total)
                self._channel_join_status[clean_user] = {
                    "status": "joined",
                    "display_name": source.get("display_name", username),
                    "chat_id": cid,
                }

                # 4. Safe delay between channel joins (5 to 8 seconds with gentle random jitter)
                if idx < total:
                    delay = random.uniform(5.0, 8.0)
                    logger.debug("[Auto-Joiner] Pausing %.1fs before joining next channel...", delay)
                    await asyncio.sleep(delay)

            except UserAlreadyParticipantError:
                logger.info("[Auto-Joiner] Already participant of @%s (%d/%d)", username, idx, total)
                self._channel_join_status[clean_user] = {
                    "status": "already_member",
                    "display_name": source.get("display_name", username),
                    "chat_id": getattr(entity, "id", None) if "entity" in locals() and entity else None,
                }
            except FloodWaitError as fwe:
                wait_secs = fwe.seconds + 2
                logger.warning("[Auto-Joiner] Telegram FloodWait received: pausing for %d seconds as requested...", wait_secs)
                self._channel_join_status[clean_user] = {
                    "status": "flood_wait",
                    "error": f"FloodWait {fwe.seconds}s",
                    "display_name": source.get("display_name", username),
                }
                await asyncio.sleep(wait_secs)
            except ChannelPrivateError:
                logger.warning("[Auto-Joiner] Channel @%s is private/inaccessible (%d/%d)", username, idx, total)
                self._channel_join_status[clean_user] = {
                    "status": "failed",
                    "error": "Channel is private or restricted",
                    "display_name": source.get("display_name", username),
                }
            except Exception as exc:
                logger.warning("[Auto-Joiner] Notice joining @%s: %s", username, exc)
                self._channel_join_status[clean_user] = {
                    "status": "failed",
                    "error": str(exc),
                    "display_name": source.get("display_name", username),
                }

        joined_count = sum(1 for s in self._channel_join_status.values() if s.get("status") in ("joined", "already_member"))
        logger.info("[Auto-Joiner] Staggered join sequence completed: %d/%d channels streaming via MTProto push.", joined_count, total)

    def get_channel_join_summary(self) -> dict[str, Any]:
        """Returns summary of channel join statuses for telemetry API."""
        joined_count = sum(1 for s in self._channel_join_status.values() if s.get("status") in ("joined", "already_member"))
        return {
            "total_sources": len(self._monitored_sources),
            "joined_count": joined_count,
            "is_running": self.is_running,
            "channels": self._channel_join_status,
        }

    async def stop(self) -> None:
        """Gracefully stop live collection, cancel join/poll tasks, and disconnect Telethon client."""
        self.is_running = False
        if self._join_task and not self._join_task.done():
            self._join_task.cancel()
            try:
                await self._join_task
            except asyncio.CancelledError:
                pass

        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass

        if self.client:
            try:
                await self.client.disconnect()
            except Exception as e:
                logger.debug("Error disconnecting Telethon client: %s", e)
        logger.info("Live Telegram collection service stopped.")

    async def _checkpoint_poll_loop(self) -> None:
        """Continuous micro-poll fallback checking for new messages across monitored channels."""
        while self.is_running:
            try:
                await asyncio.sleep(15)
                if not self.client or not self.client.is_connected():
                    continue

                for source in self._monitored_sources:
                    username = source.get("username")
                    if not username:
                        continue
                    try:
                        entity = self._channel_entities.get(username.lower())
                        if not entity:
                            continue

                        last_id = self._last_seen_ids.get(username, 0)
                        # Fetch up to 3 recent messages
                        messages = await self.client.get_messages(entity, limit=3)
                        for msg in reversed(messages):
                            if msg.id > last_id:
                                await self.process_telethon_message(msg, entity)
                                self._last_seen_ids[username] = max(self._last_seen_ids.get(username, 0), msg.id)
                    except Exception as poll_err:
                        logger.debug("Poll error for %s: %s", username, poll_err)
            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.debug("Error in checkpoint poll loop: %s", loop_err)
                await asyncio.sleep(10)

    async def process_telethon_message(self, message: Any, chat_entity: Any = None) -> None:
        """Serialize, normalize, index, evaluate alerts, and broadcast a live Telegram post."""
        if getattr(message, "id", None) is None:
            return

        # 1. Serialize from Telethon representation
        raw_dict = TelethonMessageSerializer.serialize(
            message,
            chat_entity=chat_entity,
            collected_at=datetime.now(timezone.utc),
        )

        # 2. Normalize to CanonicalMessage contract
        canonical = TelegramNormalizer.normalize(raw_dict)

        # 3. Append to in-memory ArtifactRepository
        is_new = self.repo.append_message(canonical)
        if not is_new:
            return

        # Record latest seen ID
        channel_name = canonical.author_username or canonical.channel_title or "unknown"
        native_id = getattr(message, "id", 0)
        if isinstance(native_id, int):
            self._last_seen_ids[channel_name] = max(self._last_seen_ids.get(channel_name, 0), native_id)

        # Asynchronously persist to Parquet for durability
        try:
            parquet_path = self.repo._resolve_parquet_path(None)
            if parquet_path and parquet_path.is_file():
                append_canonical_messages(parquet_path, [canonical])
        except Exception as save_err:
            logger.debug("Could not append live message to Parquet: %s", save_err)

        # 4. In-flight Real-Time Alert Evaluation
        alert_payload = self._evaluate_realtime_alert(canonical, message)
        if alert_payload:
            await self.streaming_manager.broadcast("alert_triggered", alert_payload)
            logger.info("Real-time alert triggered: %s", alert_payload.get("id"))

        # 5. Broadcast message_ingested event to all connected WebSocket clients
        text_body = canonical.text_content or ""
        message_event_data = {
            "message_id": canonical.canonical_id,
            "native_id": canonical.native_id,
            "channel_title": canonical.channel_title or channel_name,
            "channel_username": canonical.author_username,
            "text": text_body,
            "text_preview": text_body[:120] + ("..." if len(text_body) > 120 else ""),
            "timestamp": canonical.published_at.isoformat(),
            "views": canonical.views_count or 0,
            "forwards": canonical.forwards_count or 0,
            "has_media": canonical.has_media,
            "total_corpus_count": len(self.repo._messages),
        }
        await self.streaming_manager.broadcast("message_ingested", message_event_data)

    def _evaluate_realtime_alert(self, canonical: CanonicalMessage, raw_message: Any) -> dict[str, Any] | None:
        """Inspects incoming canonical message for threshold breaches and anomalous triggers."""
        views = canonical.views_count or 0
        forwards = canonical.forwards_count or 0
        text_body = canonical.text_content or ""
        text_lower = text_body.lower()
        is_forwarded = canonical.is_forward or (getattr(raw_message, "fwd_from", None) is not None)

        # Look for domain attribution
        matched_domain = "geopolitics"
        for s in self._monitored_sources:
            if s.get("username", "").lower() in (canonical.author_username or "").lower():
                matched_domain = s.get("domain", "geopolitics")
                break

        # Condition 1: High Velocity or Forward Cascade Spike
        if is_forwarded or forwards >= 15 or views >= 5000:
            severity = "critical" if views >= 10000 or forwards >= 30 else "high"
            category = "coordination_anomaly" if is_forwarded else "high_velocity"
            score = 0.76 if severity == "critical" else 0.62
            title = f"Real-Time {'Forward Cascade' if is_forwarded else 'Velocity Spike'}: {canonical.author_username or canonical.channel_title}"
            
            indicators = [
                f"Observed {'direct forward transmission' if is_forwarded else 'rapid audience reach'}",
                f"Views: {views:,} • Forwards: {forwards:,}",
                f"Domain: {matched_domain}",
            ]

            return {
                "id": f"alt-live-{canonical.canonical_id}",
                "narrative_id": f"live_{canonical.canonical_id[:16]}",
                "topic_id": "realtime_stream",
                "title": title,
                "claim": text_body[:140] if text_body else "Multimedia or Forwarded Transmission",
                "severity": severity,
                "category": category,
                "status": "open",
                "priority_score": score,
                "message_count": 1,
                "indicators": indicators,
                "domains": [matched_domain],
                "detected_at": datetime.now(timezone.utc).isoformat(),
            }

        # Condition 2: Keyword overlap with top priority narrative centroids
        for nid, narrative in self.repo._narratives_by_id.items():
            if narrative.priority_signal_score >= 0.60:
                claim_words = set(w.lower() for w in narrative.headline_claim.split() if len(w) > 4)
                if any(w in text_lower for w in claim_words):
                    return {
                        "id": f"alt-live-{canonical.canonical_id}",
                        "narrative_id": narrative.narrative_id,
                        "topic_id": narrative.promoted_from_topic_id,
                        "title": f"Live Narrative Signal Match: {narrative.narrative_id}",
                        "claim": text_body[:140],
                        "severity": "critical" if narrative.priority_signal_score >= 0.70 else "high",
                        "category": "priority_breach",
                        "status": "open",
                        "priority_score": narrative.priority_signal_score,
                        "message_count": narrative.message_count + 1,
                        "indicators": [
                            f"Matched active {narrative.priority_tier.upper()} cluster: {narrative.headline_claim[:60]}...",
                            f"Live transmission from {canonical.author_username or canonical.channel_title}",
                            f"Signal Score: {narrative.priority_signal_score:.3f}",
                        ],
                        "domains": [matched_domain],
                        "detected_at": datetime.now(timezone.utc).isoformat(),
                    }

        return None


# Global singleton instance
live_collector_service = LiveCollectorService()


def get_live_collector_service() -> LiveCollectorService:
    """Dependency helper to access global LiveCollectorService."""
    return live_collector_service
