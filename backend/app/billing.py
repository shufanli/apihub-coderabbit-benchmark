"""Billing: Stripe Checkout, plan management, invoices."""
import os
import uuid

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.auth import require_auth
from app.database import get_db
from app.plans import PLAN_LIMITS, PLAN_PRICES

router = APIRouter(prefix="/api/billing", tags=["billing"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_PRO = os.environ.get("STRIPE_PRICE_PRO", "")
STRIPE_PRICE_ENTERPRISE = os.environ.get("STRIPE_PRICE_ENTERPRISE", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BASE_PATH = os.environ.get("BASE_PATH", "")


@router.get("/current")
async def current_plan(request: Request):
    user_id = require_auth(request)
    with get_db() as conn:
        user = conn.execute("SELECT plan, stripe_customer_id FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    plan = user["plan"]
    return {
        "plan": plan,
        "price_cents": PLAN_PRICES.get(plan, {}).get("monthly", 0),
        "limit": PLAN_LIMITS.get(plan, 1000),
        "stripe_customer_id": user["stripe_customer_id"],
    }


class CheckoutRequest(BaseModel):
    plan: str
    billing_cycle: str = "monthly"


@router.post("/checkout")
async def create_checkout(request: Request, body: CheckoutRequest):
    user_id = require_auth(request)

    if body.plan not in ("pro", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = STRIPE_PRICE_PRO if body.plan == "pro" else STRIPE_PRICE_ENTERPRISE

    with get_db() as conn:
        user = conn.execute("SELECT stripe_customer_id, email FROM users WHERE id = ?", (user_id,)).fetchone()

    try:
        session_params = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{FRONTEND_URL}{BASE_PATH}/dashboard/billing?success=true",
            "cancel_url": f"{FRONTEND_URL}{BASE_PATH}/dashboard/billing?canceled=true",
            "metadata": {"user_id": user_id, "plan": body.plan},
        }
        if user["stripe_customer_id"]:
            session_params["customer"] = user["stripe_customer_id"]
        else:
            session_params["customer_email"] = user["email"]

        session = stripe.checkout.Session.create(**session_params)
        return {"checkout_url": session.url}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class DowngradeRequest(BaseModel):
    plan: str = "free"


@router.post("/downgrade")
async def downgrade(request: Request, body: DowngradeRequest):
    user_id = require_auth(request)

    if body.plan not in ("free", "pro"):
        raise HTTPException(status_code=400, detail="Invalid downgrade target")

    with get_db() as conn:
        user = conn.execute("SELECT plan FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        plan_order = {"free": 0, "pro": 1, "enterprise": 2}
        if plan_order.get(body.plan, 0) >= plan_order.get(user["plan"], 0):
            raise HTTPException(status_code=400, detail="Can only downgrade to a lower plan")

        conn.execute("UPDATE users SET plan = ? WHERE id = ?", (body.plan, user_id))

    return {"ok": True, "new_plan": body.plan}


@router.get("/invoices")
async def list_invoices(request: Request, page: int = 1):
    user_id = require_auth(request)
    per_page = 10
    offset = (page - 1) * per_page

    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM invoices WHERE user_id = ?", (user_id,)).fetchone()[0]
        rows = conn.execute(
            "SELECT id, amount_cents, status, pdf_url, created_at FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (user_id, per_page, offset),
        ).fetchall()

    return {
        "invoices": [
            {
                "id": r["id"],
                "amount_cents": r["amount_cents"],
                "status": r["status"],
                "pdf_url": r["pdf_url"],
                "created_at": r["created_at"],
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.post("/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError) as e:
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from e

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan = session.get("metadata", {}).get("plan")
        customer_id = session.get("customer")

        if user_id and plan:
            with get_db() as conn:
                conn.execute(
                    "UPDATE users SET plan = ?, stripe_customer_id = ? WHERE id = ?",
                    (plan, customer_id, user_id),
                )
                conn.execute(
                    "INSERT INTO invoices (id, user_id, amount_cents, status, pdf_url) VALUES (?,?,?,?,?)",
                    (
                        f"inv_{uuid.uuid4().hex[:12]}",
                        user_id,
                        PLAN_PRICES.get(plan, {}).get("monthly", 0),
                        "paid",
                        None,
                    ),
                )

    return {"received": True}
