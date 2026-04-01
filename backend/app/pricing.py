"""Public pricing endpoint."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "monthly_price": 0,
        "yearly_price": 0,
        "limit": 1000,
        "features": [
            "1,000 API calls/month",
            "Basic analytics",
            "Community support",
            "1 API key",
        ],
        "popular": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "monthly_price": 2900,
        "yearly_price": 28800,
        "limit": 50000,
        "features": [
            "50,000 API calls/month",
            "Advanced analytics",
            "Priority support",
            "Unlimited API keys",
            "Webhook notifications",
        ],
        "popular": True,
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "monthly_price": 19900,
        "yearly_price": 199200,
        "limit": 500000,
        "features": [
            "500,000 API calls/month",
            "Custom analytics",
            "Dedicated support",
            "Unlimited API keys",
            "Webhook notifications",
            "SLA guarantee",
            "Custom integrations",
        ],
        "popular": False,
    },
]


@router.get("")
async def get_pricing():
    return {"plans": PLANS}
