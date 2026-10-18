import json
import os

APP_ENV = os.getenv("APP_ENV", "development")
IS_PROD = APP_ENV == "production"

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
JWT_SECRET = os.getenv("JWT_SECRET", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
_WEAK = {"", "change-me", "change-me-in-production", "admin12345", "password", "admin", "12345678"}

if IS_PROD:  # refuse to boot with guessable secrets
    if len(JWT_SECRET) < 32:
        raise RuntimeError("APP_ENV=production needs JWT_SECRET with 32+ random characters "
                           "(generate one with: openssl rand -hex 32)")
    if ADMIN_PASSWORD.lower() in _WEAK or len(ADMIN_PASSWORD) < 10:
        raise RuntimeError("APP_ENV=production needs a strong ADMIN_PASSWORD (10+ characters)")
else:
    JWT_SECRET = JWT_SECRET or "dev-only-secret-not-for-production-0123456789"
    ADMIN_PASSWORD = ADMIN_PASSWORD or "admin12345"

JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days
COOKIE_NAME = "cp_session"
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
TIMEZONE = os.getenv("TIMEZONE", "Asia/Dhaka")
SEMESTER_WEEKS = int(os.getenv("SEMESTER_WEEKS", "16"))  # used only when no semester end date is set
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# 4.00-scale grade table. Override with GRADE_SCALE='{"A+":4,"A":3.7,...}' for another university.
GRADE_POINTS: dict[str, float] = {
    "A+": 4.00, "A": 3.75, "A-": 3.50, "B+": 3.25, "B": 3.00,
    "B-": 2.75, "C+": 2.50, "C": 2.25, "D": 2.00, "F": 0.00,
}
if os.getenv("GRADE_SCALE"):
    GRADE_POINTS = {k: float(v) for k, v in json.loads(os.environ["GRADE_SCALE"]).items()}

# Grades outside the scale: P/W/I are ignored by GPA and credits; T adds earned credits only.
SPECIAL_GRADES = {"P": "Pass (non-credit)", "W": "Withdrawn", "I": "Incomplete", "T": "Transfer credit"}
# "latest": a retaken course counts once, using its most recent attempt. "all": every attempt counts.
RETAKE_POLICY = os.getenv("RETAKE_POLICY", "latest")
