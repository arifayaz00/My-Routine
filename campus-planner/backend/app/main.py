import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from . import models  # noqa: F401  (register tables)
from .config import ADMIN_EMAIL, ADMIN_PASSWORD, CORS_ORIGINS, IS_PROD
from .database import Base, SessionLocal, engine
from .models import User
from .routers import admin, auth, cgpa, routine
from .security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not IS_PROD:
        Base.metadata.create_all(engine)  # production schema is managed by `alembic upgrade head`
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.email == ADMIN_EMAIL.lower())):
            db.add(User(email=ADMIN_EMAIL.lower(), name="Admin", role="admin",
                        password_hash=hash_password(ADMIN_PASSWORD)))
            db.commit()
            log.info("Created admin account %s", ADMIN_EMAIL.lower())
    yield


app = FastAPI(title="Campus Planner API", version="2.0.0", lifespan=lifespan,
              docs_url=None if IS_PROD else "/docs", redoc_url=None, openapi_url=None if IS_PROD else "/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, routine.router, cgpa.router, admin.router):
    app.include_router(r)


@app.exception_handler(Exception)
async def unhandled(_, exc: Exception):
    log.exception("Unhandled error", exc_info=exc)
    return JSONResponse({"detail": "Something went wrong on the server"}, status_code=500)


@app.get("/api/health")
def health():
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        raise HTTPException(503, "database unavailable")
    return {"ok": True}
