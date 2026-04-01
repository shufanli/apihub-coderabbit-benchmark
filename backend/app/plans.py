"""Shared plan constants — single source of truth."""

PLAN_LIMITS = {
    "free": 1000,
    "pro": 50000,
    "enterprise": 500000,
}

PLAN_PRICES = {
    "pro": {"monthly": 2900, "yearly": 28800},
    "enterprise": {"monthly": 19900, "yearly": 199200},
}
