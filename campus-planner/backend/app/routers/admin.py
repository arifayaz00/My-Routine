import logging
import os
import secrets
import traceback
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import events
from ..config import MAX_UPLOAD_MB, UPLOAD_DIR
from ..database import SessionLocal, get_db
from ..models import AuditLog, Batch, Course, Notice, RoutineEntry, Upload, User, iso, now
from ..schemas import EntryIn, EntryPatch, NoticeIn, SettingsIn
from ..security import admin_user, hash_password
from ..services import audit, ingest, notify, settings
from ..services.conflicts import find_conflicts
from ..services.pdf_parser import parse_pdf
from .routine import entry_out, query_entries

log = logging.getLogger("admin")
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_user)])


# ---- PDF uploads: draft -> publish / discard, rollback ----------------------
def _stage(upload_id: int, path: str) -> None:
    """Worker thread with its own DB session (pdfplumber is blocking, CPU-bound)."""
    db = SessionLocal()
    try:
        up = db.get(Upload, upload_id)
        try:
            res = parse_pdf(path)
            if not res.entries:
                raise ValueError("No schedule entries found. " + "; ".join(res.warnings[:3]))
            ingest.stage(db, up, res)
        except Exception as exc:  # keep the DB consistent and show the reason in the log
            db.rollback()
            up = db.get(Upload, upload_id)
            up.status = "failed"
            up.log = f"{type(exc).__name__}: {exc}"
            log.warning("PDF parse failed: %s\n%s", exc, traceback.format_exc(limit=3))
        db.commit()
    finally:
        db.close()


def _upload_out(u: Upload, with_log: bool = True) -> dict:
    d = {"id": u.id, "filename": u.filename, "term": u.term, "status": u.status,
         "entries": u.entries_count, "batches": u.batches_count, "created_at": iso(u.created_at),
         "published_at": iso(u.published_at) if u.published_at else None}
    if with_log:
        d["log"] = u.log
    return d


def _get_upload(db: Session, uid: int) -> Upload:
    u = db.get(Upload, uid)
    if not u:
        raise HTTPException(404, "Upload not found")
    return u


@router.post("/uploads", status_code=201)
async def upload_pdf(file: UploadFile = File(...), term: str = Form(""),
                     admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are accepted")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File larger than {MAX_UPLOAD_MB} MB")
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "File is not a valid PDF")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}.pdf")  # never trust the client filename on disk
    with open(path, "wb") as f:
        f.write(data)
    up = Upload(filename=os.path.basename(file.filename)[:255], term=term.strip()[:60] or None,
                uploaded_by=admin.id)
    db.add(up)
    audit.record(db, admin, "upload", up.filename)
    db.commit()
    await run_in_threadpool(_stage, up.id, path)
    db.refresh(up)
    return _upload_out(up)


@router.get("/uploads")
def uploads(db: Session = Depends(get_db)):
    return [_upload_out(u, False) for u in db.scalars(select(Upload).order_by(Upload.id.desc()).limit(50))]


@router.get("/uploads/{uid}")
def upload_detail(uid: int, db: Session = Depends(get_db)):
    return _upload_out(_get_upload(db, uid))


@router.get("/uploads/{uid}/preview")
def upload_preview(uid: int, db: Session = Depends(get_db)):
    return ingest.preview(db, _get_upload(db, uid))


def _transition(db: Session, admin: User, uid: int, action: str):
    up = _get_upload(db, uid)
    try:
        if action == "publish":
            n = ingest.publish(db, up)
        elif action == "rollback":
            n = ingest.rollback(db, up)
        else:
            ingest.discard(up)
            n = 0
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    audit.record(db, admin, action, f"{up.filename} ({n} rows)")
    db.commit()
    return up, n


@router.post("/uploads/{uid}/publish")
def publish(uid: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    up, n = _transition(db, admin, uid, "publish")
    events.notify("routine-updated", {"upload_id": up.id})
    notify.broadcast(f"Routine updated{' (' + up.term + ')' if up.term else ''}: {n} classes published.")
    return _upload_out(up)


@router.post("/uploads/{uid}/rollback")
def rollback(uid: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    up, _ = _transition(db, admin, uid, "rollback")
    events.notify("routine-updated", {"upload_id": up.id})
    return _upload_out(up)


@router.post("/uploads/{uid}/discard")
def discard(uid: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    up, _ = _transition(db, admin, uid, "discard")
    return _upload_out(up)


# ---- manual overrides ---------------------------------------------------------
@router.get("/entries")
def list_entries(department: str | None = None, batch: str | None = None, section: str | None = None,
                 db: Session = Depends(get_db)):
    return [entry_out(e) for e in query_entries(db, department, batch, section)]


@router.get("/conflicts")
def live_conflicts(db: Session = Depends(get_db)):
    return find_conflicts([entry_out(e) for e in query_entries(db)])


@router.post("/entries", status_code=201)
def add_entry(body: EntryIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    b = db.scalar(select(Batch).where(Batch.department == body.department, Batch.batch_no == body.batch,
                                      Batch.section == body.section))
    if not b:
        b = Batch(department=body.department, batch_no=body.batch, section=body.section)
        db.add(b)
        db.flush()
    code = body.code.upper()
    c = db.scalar(select(Course).where(Course.code == code))
    if not c:
        c = Course(code=code, title=body.title, kind=body.kind)
        db.add(c)
        db.flush()
    e = RoutineEntry(batch_id=b.id, course_id=c.id, day=body.day, start_time=body.start_time,
                     end_time=body.end_time, room=body.room, teacher=body.teacher, kind=body.kind,
                     is_manual=True, origin_key=ingest.make_key(b.id, code, body.day, body.start_time))
    db.add(e)
    audit.record(db, admin, "entry-add", f"{code} {body.day} {body.start_time}")
    db.commit()
    db.refresh(e)
    events.notify("routine-updated", {"entry_id": e.id})
    return entry_out(e)


@router.patch("/entries/{eid}")
def edit_entry(eid: int, body: EntryPatch, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = db.get(RoutineEntry, eid)
    if not e:
        raise HTTPException(404, "Not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data and e.course:
        e.course.title = data.pop("title") or ""
    for k, v in data.items():
        setattr(e, k, v)
    if e.end_time <= e.start_time:
        raise HTTPException(422, "end time must be after start time")
    if not e.origin_key:
        e.origin_key = ingest.make_key(e.batch_id, e.course.code if e.course else "", e.day, e.start_time)
    e.is_manual = True  # protect from being replaced by the next PDF publish
    audit.record(db, admin, "entry-edit", f"{e.course.code if e.course else ''} #{e.id}: {', '.join(data) or 'title'}")
    db.commit()
    db.refresh(e)
    events.notify("routine-updated", {"entry_id": e.id})
    return entry_out(e)


@router.delete("/entries/{eid}", status_code=204)
def delete_entry(eid: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = db.get(RoutineEntry, eid)
    if not e:
        raise HTTPException(404, "Not found")
    audit.record(db, admin, "entry-delete", f"{e.course.code if e.course else ''} {e.day} {e.start_time}")
    db.delete(e)
    db.commit()
    events.notify("routine-updated", {"entry_id": eid})


# ---- notices, settings, users, audit, stats ----------------------------------
@router.post("/notices", status_code=201)
def create_notice(body: NoticeIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    n = Notice(**body.model_dump())
    db.add(n)
    audit.record(db, admin, "notice", n.title)
    db.commit()
    events.notify("notice", {"id": n.id, "title": n.title, "level": n.level})
    notify.broadcast(f"[{n.level.upper()}] {n.title}\n{n.body}".strip())
    return {"id": n.id}


@router.delete("/notices/{nid}", status_code=204)
def delete_notice(nid: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    n = db.get(Notice, nid)
    if n:
        audit.record(db, admin, "notice-delete", n.title)
        db.delete(n)
        db.commit()


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return {"semester_start": settings.get(db, "semester_start"), "semester_end": settings.get(db, "semester_end")}


@router.put("/settings")
def put_settings(body: SettingsIn, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    settings.put(db, "semester_start", body.semester_start.isoformat() if body.semester_start else None)
    settings.put(db, "semester_end", body.semester_end.isoformat() if body.semester_end else None)
    audit.record(db, admin, "settings", f"{body.semester_start} to {body.semester_end}")
    db.commit()
    return get_settings(db)


@router.get("/users")
def users(db: Session = Depends(get_db)):
    rows = db.scalars(select(User).order_by(User.id.desc()).limit(200))
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "created_at": iso(u.created_at)}
            for u in rows]


@router.post("/users/{uid}/reset-password")
def reset_password(uid: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    """No email server needed: the admin gets a one-time temporary password to hand to the student."""
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    temp = secrets.token_urlsafe(9)
    u.password_hash = hash_password(temp)
    u.token_version += 1
    audit.record(db, admin, "password-reset", u.email)
    db.commit()
    return {"email": u.email, "temporary_password": temp}


@router.get("/audit")
def audit_log(db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(200))
    return [{"id": a.id, "user": a.user_email, "action": a.action, "detail": a.detail,
             "created_at": iso(a.created_at)} for a in rows]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    week = now() - timedelta(days=7)
    count = lambda q: db.scalar(q)  # noqa: E731
    return {
        "students": count(select(func.count()).select_from(User).where(User.role == "user")),
        "students_7d": count(select(func.count()).select_from(User).where(User.role == "user",
                                                                       User.created_at >= week)),
        "batches": count(select(func.count(func.distinct(RoutineEntry.batch_id)))),
        "courses": count(select(func.count()).select_from(Course)),
        "entries": count(select(func.count()).select_from(RoutineEntry)),
        "uploads": count(select(func.count()).select_from(Upload)),
        "conflicts": len(find_conflicts([entry_out(e) for e in query_entries(db)])),
        "last_publish": (lambda d: iso(d) if d else None)(count(select(func.max(Upload.published_at)))),
        "by_department": [{"department": d, "batches": n} for d, n in db.execute(
            select(Batch.department, func.count(func.distinct(Batch.id))).join(RoutineEntry)
            .group_by(Batch.department))],
    }
