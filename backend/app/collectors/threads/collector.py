import argparse
import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.collectors.threads.client import ThreadsClient, ThreadsCredentials
from app.collectors.threads.serializer import ThreadsMessageSerializer
from app.schemas.canonical_message import CanonicalMessage

logger = logging.getLogger("traject.collectors.threads")


@dataclass
class ThreadsCollectionResult:
    """Summary of a Threads collection run."""
    user_id: str
    username: str | None
    requested_limit: int
    raw_messages_count: int
    canonical_messages_count: int
    raw_file_path: str
    canonical_messages: list[CanonicalMessage] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class ThreadsCollector:
    """Historical and batch collector for Meta Threads posts."""

    def __init__(
        self,
        credentials: ThreadsCredentials | None = None,
        client: ThreadsClient | None = None,
        raw_storage_dir: str | Path | None = None,
    ):
        self.credentials = credentials
        self._external_client = client

        if raw_storage_dir is not None:
            p = Path(raw_storage_dir)
            if p.is_absolute():
                self.raw_storage_dir = p
            else:
                from app.core.config import find_repo_root
                self.raw_storage_dir = (find_repo_root() / p).resolve()
        else:
            from app.core.config import find_repo_root
            self.raw_storage_dir = (find_repo_root() / "data" / "raw" / "threads").resolve()

    def _get_or_create_client(self) -> ThreadsClient:
        if self._external_client is not None:
            return self._external_client
        if self.credentials is None:
            self.credentials = ThreadsCredentials.from_env()
        return ThreadsClient(credentials=self.credentials)

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        return re.sub(r"[^\w\-.]", "_", str(name)).strip("_")

    async def collect_user_threads(
        self,
        user_id: str = "me",
        limit: int = 50,
        normalize: bool = True,
    ) -> ThreadsCollectionResult:
        """Collect recent Threads posts from an account, persisting raw JSONL.
        
        Args:
            user_id: Target user ID or 'me'.
            limit: Maximum posts to fetch.
            normalize: Whether to normalize into CanonicalMessage objects.
        """
        client = self._get_or_create_client()
        collected_at = datetime.now(timezone.utc)
        timestamp_str = collected_at.strftime("%Y%m%d_%H%M%S")

        logger.info("Collecting up to %d Threads posts for user '%s'...", limit, user_id)

        # 1. Fetch profile metadata
        profile_info: dict[str, Any] = {}
        try:
            profile_info = await client.get_user_profile(user_id)
        except Exception as e:
            logger.warning("Could not fetch Threads profile for '%s': %s", user_id, e)

        username = profile_info.get("username") or user_id

        # 2. Fetch posts from Threads API
        raw_api_threads = await client.get_user_threads(user_id=user_id, limit=limit)
        logger.info("Retrieved %d raw posts from Threads API.", len(raw_api_threads))

        # 3. Serialize into standard primitive dictionaries
        serialized_records: list[dict[str, Any]] = []
        for raw_thread in raw_api_threads:
            serialized = ThreadsMessageSerializer.serialize(
                raw_thread, author_info=profile_info, collected_at=collected_at
            )
            serialized_records.append(serialized)

        # 4. Persist to immutable raw JSONL storage
        self.raw_storage_dir.mkdir(parents=True, exist_ok=True)
        safe_name = self._sanitize_filename(username)
        raw_filename = f"{safe_name}_{timestamp_str}.jsonl"
        raw_file_path = self.raw_storage_dir / raw_filename

        with open(raw_file_path, "w", encoding="utf-8") as f:
            for rec in serialized_records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

        logger.info("Saved %d raw Threads records to %s", len(serialized_records), raw_file_path)

        # 5. Optional Normalization to CanonicalMessage
        canonical_messages: list[CanonicalMessage] = []
        errors: list[str] = []

        if normalize and serialized_records:
            from app.normalizers.threads import ThreadsNormalizer

            for idx, rec in enumerate(serialized_records, start=1):
                raw_ref = f"{raw_filename}:line_{idx}"
                try:
                    cmsg = ThreadsNormalizer.normalize(
                        rec,
                        collected_at=collected_at,
                        raw_reference=raw_ref,
                    )
                    canonical_messages.append(cmsg)
                except Exception as e:
                    err_msg = f"Failed to normalize Threads post {rec.get('id')}: {e}"
                    logger.error(err_msg)
                    errors.append(err_msg)

        return ThreadsCollectionResult(
            user_id=user_id,
            username=username,
            requested_limit=limit,
            raw_messages_count=len(serialized_records),
            canonical_messages_count=len(canonical_messages),
            raw_file_path=str(raw_file_path),
            canonical_messages=canonical_messages,
            errors=errors,
        )

    async def collect_keyword_search(
        self,
        query: str,
        limit: int = 50,
        normalize: bool = True,
    ) -> ThreadsCollectionResult:
        """Search public Threads posts matching a keyword or hashtag and persist raw JSONL.
        
        Args:
            query: Keyword or hashtag to search (e.g. 'security' or '#alert').
            limit: Maximum posts to fetch.
            normalize: Whether to normalize into CanonicalMessage objects.
        """
        client = self._get_or_create_client()
        collected_at = datetime.now(timezone.utc)
        timestamp_str = collected_at.strftime("%Y%m%d_%H%M%S")

        logger.info("Searching Threads for query '%s' (limit: %d)...", query, limit)

        # 1. Fetch search results from Threads keyword search API
        raw_api_threads: list[dict[str, Any]] = []
        errors: list[str] = []
        try:
            raw_api_threads = await client.search_threads(query=query, limit=limit)
            logger.info("Retrieved %d raw posts from Threads search API.", len(raw_api_threads))
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 500:
                err_msg = (
                    "Meta Threads API 500: Keyword search across all public Threads requires "
                    "Meta App Review approval for 'threads_keyword_search' in Live Mode. "
                    "Tokens generated via the Developer Portal User Token Generator are limited "
                    "to user-scoped operations until approved by Meta."
                )
            else:
                err_msg = f"Threads search API HTTP error ({e.response.status_code}): {e}"
            logger.error(err_msg)
            errors.append(err_msg)
        except Exception as e:
            err_msg = f"Threads search request failed: {e}"
            logger.error(err_msg)
            errors.append(err_msg)

        # 2. Serialize into standard primitive dictionaries
        serialized_records: list[dict[str, Any]] = []
        for raw_thread in raw_api_threads:
            serialized = ThreadsMessageSerializer.serialize(
                raw_thread, author_info=None, collected_at=collected_at
            )
            serialized_records.append(serialized)

        # 3. Persist to immutable raw JSONL storage
        self.raw_storage_dir.mkdir(parents=True, exist_ok=True)
        safe_query = self._sanitize_filename(query)
        raw_filename = f"search_{safe_query}_{timestamp_str}.jsonl"
        raw_file_path = self.raw_storage_dir / raw_filename

        if serialized_records:
            with open(raw_file_path, "w", encoding="utf-8") as f:
                for rec in serialized_records:
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            logger.info("Saved %d raw Threads search records to %s", len(serialized_records), raw_file_path)
        else:
            logger.info("No records to persist for search query '%s'.", query)

        # 4. Optional Normalization to CanonicalMessage
        canonical_messages: list[CanonicalMessage] = []

        if normalize and serialized_records:
            from app.normalizers.threads import ThreadsNormalizer

            for idx, rec in enumerate(serialized_records, start=1):
                raw_ref = f"{raw_filename}:line_{idx}"
                try:
                    cmsg = ThreadsNormalizer.normalize(
                        rec,
                        collected_at=collected_at,
                        raw_reference=raw_ref,
                    )
                    canonical_messages.append(cmsg)
                except Exception as e:
                    err_msg = f"Failed to normalize Threads post {rec.get('id')}: {e}"
                    logger.error(err_msg)
                    errors.append(err_msg)

        return ThreadsCollectionResult(
            user_id=f"query:{query}",
            username=f"search_{query}",
            requested_limit=limit,
            raw_messages_count=len(serialized_records),
            canonical_messages_count=len(canonical_messages),
            raw_file_path=str(raw_file_path),
            canonical_messages=canonical_messages,
            errors=errors,
        )


def main():
    """CLI entrypoint for Meta Threads collection."""
    from app.core.config import load_project_env
    load_project_env()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )

    parser = argparse.ArgumentParser(description="TRAJECT Meta Threads Post Collector")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--user", default=None, help="Target Threads user ID or 'me' (default: 'me')")
    group.add_argument("--query", "-q", default=None, help="Keyword or hashtag to search across Threads")

    parser.add_argument("--limit", type=int, default=50, help="Maximum posts to collect (default: 50)")
    parser.add_argument("--raw-dir", default=None, help="Custom raw storage directory")

    args = parser.parse_args()

    collector = ThreadsCollector(raw_storage_dir=args.raw_dir)

    if args.query:
        result = asyncio.run(collector.collect_keyword_search(query=args.query, limit=args.limit))
    else:
        user_target = args.user or "me"
        result = asyncio.run(collector.collect_user_threads(user_id=user_target, limit=args.limit))

    print("\n" + "=" * 60)
    print("TRAJECT Threads Ingestion Complete")
    print("=" * 60)
    print(f"Target:              {result.user_id}")
    print(f"Username / Scope:    {result.username or 'N/A'}")
    print(f"Raw Posts Saved:     {result.raw_messages_count}")
    print(f"Canonical Normalized:{result.canonical_messages_count}")
    print(f"Raw Output File:     {result.raw_file_path}")
    if result.errors:
        print(f"Errors Encountered:  {len(result.errors)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
