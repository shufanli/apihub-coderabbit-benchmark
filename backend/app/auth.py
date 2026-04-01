"""Authentication: GitHub OAuth + JWT sessions."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BASE_PATH = os.environ.get("BASE_PATH", "")


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user_id(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        return None


def require_auth(request: Request) -> str:
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


@router.get("/login")
async def login(request: Request):
    redirect_uri = request.query_params.get("redirect", f"{FRONTEND_URL}{BASE_PATH}/dashboard")
    state = redirect_uri
    github_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={FRONTEND_URL}{BASE_PATH}/api/auth/callback"
        f"&scope=read:user user:email"
        f"&state={state}"
    )
    return RedirectResponse(url=github_url)


@router.get("/callback")
async def callback(request: Request, code: str = "", state: str = ""):
    if not code:
        raise HTTPException(status_code=400, detail="Missing code parameter")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to get access token")

    # Get user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        gh_user = user_resp.json()

    github_id = gh_user["id"]
    username = gh_user["login"]
    email = gh_user.get("email", "")
    avatar_url = gh_user.get("avatar_url", "")

    # Upsert user
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE github_id = ?", (github_id,)).fetchone()
        if existing:
            user_id = existing["id"]
            conn.execute(
                "UPDATE users SET username=?, email=?, avatar_url=? WHERE id=?",
                (username, email, avatar_url, user_id),
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            conn.execute(
                "INSERT INTO users (id, github_id, username, email, avatar_url) VALUES (?,?,?,?,?)",
                (user_id, github_id, username, email, avatar_url),
            )

    token = create_token(user_id)
    redirect_to = state or f"{FRONTEND_URL}{BASE_PATH}/dashboard"
    response = RedirectResponse(url=redirect_to)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/",
    )
    return response


@router.post("/logout")
async def logout():
    response = Response(content='{"ok": true}', media_type="application/json")
    response.delete_cookie("session_token", path="/")
    return response


@router.get("/me")
async def me(request: Request):
    user_id = get_current_user_id(request)
    if not user_id:
        return {"user": None}
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, username, email, avatar_url, plan FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not user:
        return {"user": None}
    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "avatar_url": user["avatar_url"],
            "plan": user["plan"],
        }
    }
