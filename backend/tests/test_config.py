import os
from pathlib import Path
import pytest
from app.core.config import find_repo_root, load_project_env


def test_find_repo_root_discovers_traject_root():
    """Verify that find_repo_root identifies the top-level repository containing README.md and backend."""
    root = find_repo_root()
    assert (root / "backend").is_dir()
    assert (root / ".gitignore").is_file()
    assert (root / "README.md").is_file()


def test_load_project_env_respects_os_precedence(tmp_path, monkeypatch):
    """Verify that environment variables already set in the OS take precedence over .env file."""
    # Create a synthetic .env file
    fake_env = tmp_path / ".env"
    fake_env.write_text("TEST_VAR=from_dotenv\nNEW_VAR=only_in_dotenv\n", encoding="utf-8")

    # Set TEST_VAR in OS environment
    monkeypatch.setenv("TEST_VAR", "from_os_environment")
    monkeypatch.delenv("NEW_VAR", raising=False)

    loaded_path = load_project_env(env_file_override=fake_env)

    assert loaded_path == fake_env
    # OS variable must NOT be overwritten
    assert os.getenv("TEST_VAR") == "from_os_environment"
    # New variable should be populated
    assert os.getenv("NEW_VAR") == "only_in_dotenv"
