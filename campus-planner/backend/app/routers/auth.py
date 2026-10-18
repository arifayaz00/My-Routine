from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..ratelimit import client_ip, limiter
from ..schemas import ChangePasswordIn, LoginIn, PrefsIn, RegisterIn
from ..security import (clear_session_cookie, create_token, current_user, hash_password,
                        set_session_cookie, verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "prefs": {"department": u.pref_department, "batch": u.pref_batch, "section": u.pref_section}}


def _session(u: User, request: Request, response: Response) -> dict:
    token = create_token(u)
    set_session_cookie(response, request, token)
    return {"token": token, "user": _out(u)}  # browsers use the cookie; API clients may use the token


@router.post("/register", status_code=201)
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    limiter.check(f"register:{client_ip(request)}", 10, 3600)
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(409, "Email already registered")
    u = User(email=body.email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    return _session(u, request, response)


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    limiter.check(f"login-ip:{client_ip(request)}", 30, 300)
    limiter.check(f"login:{email}", 8, 600)
    u = db.scalar(select(User).where(User.email == email))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return _session(u, request, response)


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _out(user)


@router.put("/preferences")
def save_prefs(body: PrefsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.pref_department, user.pref_batch, user.pref_section = body.department, body.batch, body.section
    db.commit()
    return _out(user)


@router.post("/change-password")
def change_password(body: ChangePasswordIn, request: Request, response: Response,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    limiter.check(f"pw:{user.id}", 8, 600)
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "Current password is wrong")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # signs out every other device
    db.commit()
    return _session(user, request, response)
