"""Routine publishing pipeline.

    upload PDF -> stage()    parsed rows are stored as a DRAFT (nothing live changes)
               -> preview    admin reviews rows, warnings, clashes
               -> publish()  replaces the PDF-derived rows of every batch found in the PDF
               -> rollback() restores exactly what that publish replaced (latest publish first)

Rows an admin edited or added by hand (is_manual) are never deleted by publish/rollback, and a
parsed row is skipped when a manual row already represents the same class (origin_key), so
re-uploading a PDF cannot create duplicates of classes that were adjusted by hand.
"""
import json
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Batch, Course, RoutineEntry, Upload, now
from .conflicts import find_conflicts
from .pdf_parser import ParsedEntry, ParseResult


def make_key(batch_id: int, code: str, day: str, start: str) -> str:
    return f"{batch_id}|{code}|{day}|{start}"


def _batch_key(e) -> tuple[str, str, str]:
    d = e["department"] if isinstance(e, dict) else e.department
    b = e["batch"] if isinstance(e, dict) else e.batch
    s = e["section"] if isinstance(e, dict) else e.section
    return (d or "Unknown", b or "?", s or "")


def stage(db: Session, upload: Upload, res: ParseResult) -> None:
    rows = res.entry_dicts()
    conflicts = find_conflicts(rows)
    upload.payload = json.dumps({"entries": rows, "warnings": res.warnings, "conflicts": conflicts})
    upload.entries_count = len(rows)
    upload.batches_count = len({_batch_key(r) for r in rows})
    upload.log = "\n".join(res.log + [f"WARN {w}" for w in res.warnings])
    if not upload.term and res.term:
        upload.term = res.term
    upload.status = "draft"


def _ensure_batches(db: Session, rows: list[dict]) -> dict[tuple, Batch]:
    batches: dict[tuple, Batch] = {}
    for r in rows:
        key = _batch_key(r)
        if key in batches:
            continue
        b = db.scalar(select(Batch).where(Batch.department == key[0], Batch.batch_no == key[1],
                                          Batch.section == key[2]))
        if not b:
            b = Batch(department=key[0], batch_no=key[1], section=key[2])
            db.add(b)
            db.flush()
        batches[key] = b
    return batches


def _course(db: Session, cache: dict, code: str, title: str, kind: str) -> Course:
    c = cache.get(code) or db.scalar(select(Course).where(Course.code == code))
    if not c:
        c = Course(code=code, title=title, kind=kind)
        db.add(c)
        db.flush()
    elif title and not c.title:
        c.title = title
    cache[code] = c
    return c


def _manual_keys(db: Session, batch_ids: list[int]) -> set[str]:
    keys: set[str] = set()
    q = select(RoutineEntry).where(RoutineEntry.batch_id.in_(batch_ids), RoutineEntry.is_manual.is_(True))
    for m in db.scalars(q):
        keys.add(m.origin_key)
        keys.add(make_key(m.batch_id, m.course.code if m.course else "", m.day, m.start_time))
    return keys


def _row(o: RoutineEntry) -> dict:
    return {"batch_id": o.batch_id, "code": o.course.code if o.course else "",
            "title": o.course.title if o.course else "", "day": o.day, "start": o.start_time,
            "end": o.end_time, "room": o.room, "teacher": o.teacher, "kind": o.kind,
            "upload_id": o.upload_id, "origin_key": o.origin_key}


def publish(db: Session, up: Upload) -> int:
    if up.status != "draft" or not up.payload:
        raise ValueError("Only a draft can be published")
    rows = json.loads(up.payload)["entries"]
    batches = _ensure_batches(db, rows)
    snapshot = []
    for b in batches.values():
        for o in db.scalars(select(RoutineEntry).where(RoutineEntry.batch_id == b.id,
                                                       RoutineEntry.is_manual.is_(False))):
            snapshot.append(_row(o))
            db.delete(o)
    db.flush()
    manual = _manual_keys(db, [b.id for b in batches.values()])
    cache: dict = {}
    inserted = 0
    for r in rows:
        b = batches[_batch_key(r)]
        key = make_key(b.id, r["code"], r["day"], r["start"])
        if key in manual:
            continue
        c = _course(db, cache, r["code"], r.get("title", ""), r.get("kind", "theory"))
        db.add(RoutineEntry(batch_id=b.id, course_id=c.id, day=r["day"], start_time=r["start"],
                            end_time=r["end"], room=r.get("room", ""), teacher=r.get("teacher", ""),
                            kind=r.get("kind", "theory"), origin_key=key, upload_id=up.id))
        inserted += 1
    up.snapshot = json.dumps(snapshot)
    up.payload = None
    up.status = "published"
    up.published_at = now()
    up.log += f"\nPublished {inserted} rows, replaced {len(snapshot)} previous rows."
    return inserted


def rollback(db: Session, up: Upload) -> int:
    if up.status != "published":
        raise ValueError("Only a published upload can be rolled back")
    later = db.scalar(select(func.count()).select_from(Upload).where(Upload.status == "published",
                                                                    Upload.id > up.id))
    if later:
        raise ValueError("A newer upload is live. Roll that one back first")
    batch_ids = {r["batch_id"] for r in json.loads(up.snapshot or "[]")}
    batch_ids |= set(db.scalars(select(RoutineEntry.batch_id).where(RoutineEntry.upload_id == up.id)))
    for o in db.scalars(select(RoutineEntry).where(RoutineEntry.upload_id == up.id,
                                                   RoutineEntry.is_manual.is_(False))):
        db.delete(o)
    db.flush()
    manual = _manual_keys(db, list(batch_ids)) if batch_ids else set()
    cache: dict = {}
    restored = 0
    for r in json.loads(up.snapshot or "[]"):
        if r["origin_key"] in manual:
            continue
        c = _course(db, cache, r["code"], r["title"], r["kind"]) if r["code"] else None
        db.add(RoutineEntry(batch_id=r["batch_id"], course_id=c.id if c else None, day=r["day"],
                            start_time=r["start"], end_time=r["end"], room=r["room"],
                            teacher=r["teacher"], kind=r["kind"], origin_key=r["origin_key"],
                            upload_id=r["upload_id"]))
        restored += 1
    up.status = "rolled_back"
    up.snapshot = None
    up.log += f"\nRolled back; restored {restored} previous rows."
    return restored


def discard(up: Upload) -> None:
    if up.status != "draft":
        raise ValueError("Only a draft can be discarded")
    up.status = "discarded"
    up.payload = None


def preview(db: Session, up: Upload) -> dict:
    data = json.loads(up.payload) if up.payload else {"entries": [], "warnings": [], "conflicts": []}
    counts = Counter(_batch_key(r) for r in data["entries"])
    per_batch = []
    for (dept, batch, sec), n in sorted(counts.items()):
        b = db.scalar(select(Batch).where(Batch.department == dept, Batch.batch_no == batch,
                                          Batch.section == sec))
        current = db.scalar(select(func.count()).select_from(RoutineEntry).where(
            RoutineEntry.batch_id == b.id, RoutineEntry.is_manual.is_(False))) if b else 0
        per_batch.append({"department": dept, "batch": batch, "section": sec, "new": n,
                          "current": current, "is_new_batch": b is None})
    return {"id": up.id, "filename": up.filename, "term": up.term, "status": up.status,
            "entries": data["entries"], "warnings": data["warnings"], "conflicts": data["conflicts"],
            "per_batch": per_batch}
