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


class APISettings:
    """Configuration settings for TRAJECT Backend Analytics API (Milestone 5A).
    
    Reads from environment variables (loaded via load_project_env) with safe defaults.
    """
    def __init__(self) -> None:
        load_project_env()
        self.app_env: str = os.getenv("APP_ENV", "development")
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.api_host: str = os.getenv("API_HOST", "127.0.0.1")
        self.api_port: int = int(os.getenv("API_PORT", "8000"))
        self.api_prefix: str = os.getenv("API_PREFIX", "/api/v1")
        
        raw_origins = os.getenv("API_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173")
        self.api_cors_origins: list[str] = [o.strip() for o in raw_origins.split(",") if o.strip()]
        
        self.data_raw_dir: str = os.getenv("DATA_RAW_DIR", "./data/raw")
        self.data_processed_dir: str = os.getenv("DATA_PROCESSED_DIR", "./data/processed")
        self.models_cache_dir: str = os.getenv("MODELS_CACHE_DIR", "./models/cache")
        self.ml_cache_path: str = os.getenv("ML_CACHE_PATH", "./data/cache/ml_inference_cache.db")
        self.active_dataset_name: str = os.getenv("ACTIVE_DATASET_NAME", "telegram_messages")


_cached_settings: APISettings | None = None


def get_settings() -> APISettings:
    """Retrieve singleton application configuration."""
    global _cached_settings
    if _cached_settings is None:
        _cached_settings = APISettings()
    return _cached_settings

