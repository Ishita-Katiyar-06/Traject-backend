import logging
import os
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger("traject.core.config")


def find_repo_root(start_path: Path | None = None) -> Path:
    """Deterministically discover the TRAJECT repository root.
    
    Traverses upward from the given path (or current file) until a repository
    marker is identified (.git, .env.example, or a directory containing 'backend/app').
    """
    current = (start_path or Path(__file__)).resolve()
    if current.is_file():
        current = current.parent

    for candidate in [current] + list(current.parents):
        if (candidate / ".git").exists():
            return candidate
        if (candidate / ".env.example").is_file() and (candidate / "backend").is_dir():
            return candidate

    # Fallback to 3 levels up from backend/app/core/config.py -> TRAJECT/
    return Path(__file__).resolve().parents[3]


def load_project_env(env_file_override: Path | str | None = None) -> Path | None:
    """Load environment variables from the repository-root .env file.
    
    Environment variables already present in the OS environment take precedence
    (override=False).
    
    Returns:
        Path to the loaded .env file, or None if no .env was found.
    """
    if env_file_override is not None:
        target_path = Path(env_file_override).resolve()
    else:
        repo_root = find_repo_root()
        target_path = repo_root / ".env"

    if target_path.is_file():
        # override=False guarantees OS-level environment variables take precedence
        load_dotenv(dotenv_path=target_path, override=False)
        logger.debug("Loaded project environment from %s", target_path)
        return target_path

    logger.debug("No .env file found at %s", target_path)
    return None
