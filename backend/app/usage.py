"""Usage tracking and analytics."""
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Request

from app.auth import require_auth
from app.database import get_db
from app.plans import PLAN_LIMITS

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/summary")
async def usage_summary(request: Request):
    user_id = require_auth(request)
    now = datetime.utcnow()
    today_start = now.strftime("%Y-%m-%d 00:00:00")
    month_start = now.replace(day=1).strftime("%Y-%m-%d 00:00:00")
    yesterday_start = (now - timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")

    with get_db() as conn:
        user = conn.execute("SELECT plan FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        today_count = conn.execute(
            "SELECT COUNT(*) FROM usage_logs WHERE user_id = ? AND created_at >= ?",
            (user_id, today_start),
        ).fetchone()[0]

        yesterday_count = conn.execute(
            "SELECT COUNT(*) FROM usage_logs WHERE user_id = ? AND created_at >= ? AND created_at < ?",
            (user_id, yesterday_start, today_start),
        ).fetchone()[0]

        month_count = conn.execute(
            "SELECT COUNT(*) FROM usage_logs WHERE user_id = ? AND created_at >= ?",
            (user_id, month_start),
        ).fetchone()[0]

    plan = user["plan"]
    limit = PLAN_LIMITS.get(plan, 1000)
    change_pct = 0
    if yesterday_count > 0:
        change_pct = round((today_count - yesterday_count) / yesterday_count * 100)

    return {
        "today_count": today_count,
        "yesterday_count": yesterday_count,
        "change_pct": change_pct,
        "month_count": month_count,
        "month_limit": limit,
        "plan": plan,
    }


@router.get("/chart")
async def usage_chart(request: Request, time_range: str = Query("7d", alias="range", pattern="^(7d|30d|90d)$")):
    user_id = require_auth(request)
    days = {"7d": 7, "30d": 30, "90d": 90}[time_range]
    now = datetime.utcnow()
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d 00:00:00")

    with get_db() as conn:
        rows = conn.execute(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM usage_logs WHERE user_id = ? AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date",
            (user_id, start),
        ).fetchall()

    # Fill in missing dates
    data = {}
    for r in rows:
        data[r["date"]] = r["count"]

    result = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        result.append({"date": d, "count": data.get(d, 0)})

    return {"data": result, "range": time_range}


@router.get("/logs")
async def usage_logs(
    request: Request,
    page: int = Query(1, ge=1),
    status: str = Query("all"),
    search: str = Query(""),
):
    user_id = require_auth(request)
    per_page = 20
    offset = (page - 1) * per_page

    conditions = ["user_id = ?"]
    params: list = [user_id]

    if status != "all":
        try:
            status_code = int(status)
            conditions.append("status_code = ?")
            params.append(status_code)
        except ValueError:
            if status in ("2xx", "4xx", "5xx"):
                low = int(status[0]) * 100
                conditions.append("status_code >= ? AND status_code < ?")
                params.extend([low, low + 100])

    if search:
        conditions.append("endpoint LIKE ?")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)

    with get_db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM usage_logs WHERE {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT id, endpoint, status_code, latency_ms, created_at FROM usage_logs WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()

    return {
        "logs": [
            {
                "id": r["id"],
                "endpoint": r["endpoint"],
                "status_code": r["status_code"],
                "latency_ms": r["latency_ms"],
                "created_at": r["created_at"],
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }
