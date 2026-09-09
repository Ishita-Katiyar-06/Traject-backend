from enum import Enum
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class UserRole(str, Enum):
    """Supported application security roles for TRAJECT / TESSERA."""
    PUBLIC_USER = "public_user"
    NTRO_ANALYST = "ntro_analyst"


class AuthenticatedUser(BaseModel):
    """Cryptographically verified user identity extracted from Supabase JWT."""
    model_config = ConfigDict(frozen=True)

    user_id: str = Field(..., description="Supabase UUID (JWT sub claim)")
    email: str | None = Field(None, description="User email address if present in claims")
    role: UserRole = Field(UserRole.PUBLIC_USER, description="Trusted resolved application role")
    app_metadata: dict[str, Any] = Field(default_factory=dict, description="Supabase server-controlled app_metadata")
    raw_claims: dict[str, Any] = Field(default_factory=dict, description="Full verified claims payload for auditing")

    @property
    def is_ntro_analyst(self) -> bool:
        return self.role == UserRole.NTRO_ANALYST

    @property
    def is_public_user(self) -> bool:
        return self.role == UserRole.PUBLIC_USER
