from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Portal de Gestión de Pedidos Neogen - Eleco"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://neogen:neogen_pass@db:5432/neogen_sap"
    DATABASE_URL_SYNC: str = "postgresql://neogen:neogen_pass@db:5432/neogen_sap"
    REDIS_URL: str = "redis://redis:6379/0"

    SECRET_KEY: str = "change-this-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    UPLOAD_DIR: str = "/app/uploads"
    EXPORT_DIR: str = "/app/exports"
    MAX_UPLOAD_SIZE_MB: int = 50

    TESSERACT_CMD: Optional[str] = "/usr/bin/tesseract"
    FUZZY_MATCH_THRESHOLD: int = 75
    SEMANTIC_MATCH_THRESHOLD: float = 0.75

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://frontend:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
