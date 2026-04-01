"""API Keys management."""
import json
import secrets
import uuid
from hashlib import sha256

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import require_auth
from app.database import get_db

router = APIRouter(prefix="/api/keys", tags=["keys"])


class CreateKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    permissions: list[str] = Field(..., min_length=1)


def generate_api_key() -> str:
    return f"ahk_{secrets.token_hex(24)}"


def hash_key(key: str) -> str:
    return sha256(key.encode()).hexdigest()


@router.get("")
async def list_keys(request: Request):
    user_id = require_auth(request)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, description, key_prefix, permissions, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return {
        "keys": [
            {
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "key_prefix": r["key_prefix"],
                "permissions": json.loads(r["permissions"]),
                "created_at": r["created_at"],
                "last_used_at": r["last_used_at"],
            }
            for r in rows
        ]
    }


@router.post("")
async def create_key(request: Request, body: CreateKeyRequest):
    user_id = require_auth(request)

    valid_permissions = {"read", "write", "delete", "admin"}
    for p in body.permissions:
        if p not in valid_permissions:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {p}")

    full_key = generate_api_key()
    key_id = f"key_{uuid.uuid4().hex[:12]}"
    prefix = full_key[:12] + "..."

    with get_db() as conn:
        conn.execute(
            "INSERT INTO api_keys (id, user_id, name, description, key_hash, key_prefix, permissions) VALUES (?,?,?,?,?,?,?)",
            (
                key_id,
                user_id,
                body.name,
                body.description,
                hash_key(full_key),
                prefix,
                json.dumps(body.permissions),
            ),
        )

    return {
        "id": key_id,
        "name": body.name,
        "key": full_key,
        "key_prefix": prefix,
        "permissions": body.permissions,
    }


@router.delete("/{key_id}")
async def delete_key(request: Request, key_id: str):
    user_id = require_auth(request)
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM api_keys WHERE id = ? AND user_id = ?",
            (key_id, user_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Key not found")
    return {"ok": True}
