from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import COOKIE_NAME, JWT_EXPIRE_MINUTES, JWT_SECRET
from .database import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER, CSRF_VALUE = "x-requested-with", "campus-planner"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except ValueError:
        return False


def create_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user.id), "role": user.role, "tv": user.token_version, "exp": exp},
                      JWT_SECRET, algorithm="HS256")


def set_session_cookie(response: Response, request: Request, token: str) -> None:
    """httpOnly cookie: JavaScript (and therefore XSS) can't read the session token."""
    secure = request.url.scheme == "https"  # honours X-Forwarded-Proto behind nginx
    response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", secure=secure,
                        max_age=JWT_EXPIRE_MINUTES * 60, path="/")


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def current_user(
    request: Request,
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    via_cookie = cred is None
    token = cred.credentials if cred else request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Not authenticated")
    # Cookie sessions need a custom header on writes: a cross-site form can't set it (CSRF defence).
    if via_cookie and request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(403, "Missing CSRF header")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired session")
    user = db.get(User, int(data["sub"]))
    if not user or data.get("tv", 0) != user.token_version:
        raise HTTPException(401, "Session no longer valid")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin only")
    return user
