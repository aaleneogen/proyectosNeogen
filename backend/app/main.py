from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from loguru import logger

from app.core.config import settings
from app.db.database import engine, Base
from app.api.routes import orders, products


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router, prefix="/api")
app.include_router(products.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
