"""FastAPI application entry point."""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.dev"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.billing import router as billing_router
from app.database import init_db
from app.keys import router as keys_router
from app.pricing import router as pricing_router
from app.seed import seed_data
from app.usage import router as usage_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_data()
    yield


app = FastAPI(title="ApiHub", version="1.0.0", lifespan=lifespan)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(keys_router)
app.include_router(usage_router)
app.include_router(billing_router)
app.include_router(pricing_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
