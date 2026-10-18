import re
import asyncio

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .. import events
from ..database import get_db
from ..models import Batch, Notice, RoutineEntry, iso
from ..services import settings
from ..services.ics import build_ics

router = APIRouter(prefix="/api", tags=["routine"])


def entry_out(e: RoutineEntry) -> dict:
    b, c = e.batch, e.course
    return {
        "id": e.id, "department": b.department, "batch": b.batch_no, "section": b.section,
        "code": c.code if c else "", "title": c.title if c else "", "day": e.day,
        "start": e.start_time, "end": e.end_time, "room": e.room, "teacher": e.teacher,
        "kind": e.kind, "is_manual": e.is_manual, "updated_at": iso(e.updated_at),
    }


def query_entries(db: Session, department=None, batch=None, section=None, teacher=None) -> list[RoutineEntry]:
    q = (select(RoutineEntry).join(Batch)
         .options(joinedload(RoutineEntry.batch), joinedload(RoutineEntry.course))
         .order_by(RoutineEntry.start_time))
    if department:
        q = q.where(Batch.department == department)
    if batch:
        q = q.where(Batch.batch_no == batch)
    if section:
        q = q.where(Batch.section == section)
    if teacher:
        q = q.where(RoutineEntry.teacher == teacher)
    return list(db.scalars(q).unique())


@router.get("/routine/filters")
def filters(db: Session = Depends(get_db)):
    """{department: {batch: [sections]}} - drives the cascading dropdowns."""
    def natural(b):  # "5th" < "10th" < "ACM"
        m = re.match(r"\d+", b.batch_no or "")
        return (b.department, 0 if m else 1, int(m.group()) if m else 0, b.batch_no, b.section)

    tree: dict = {}
    for b in sorted(db.scalars(select(Batch).join(RoutineEntry).distinct()), key=natural):
        tree.setdefault(b.department, {}).setdefault(b.batch_no, [])
        if b.section:
            tree[b.department][b.batch_no].append(b.section)
    return tree


@router.get("/routine/teachers")
def teachers(db: Session = Depends(get_db)):
    rows = db.scalars(select(RoutineEntry.teacher).where(RoutineEntry.teacher != "").distinct()
                      .order_by(RoutineEntry.teacher))
    return list(rows)


@router.get("/routine")
def routine(department: str | None = None, batch: str | None = None, section: str | None = None,
            teacher: str | None = None, db: Session = Depends(get_db)):
    return [entry_out(e) for e in query_entries(db, department, batch, section, teacher)]


@router.get("/routine/meta")
def meta(db: Session = Depends(get_db)):
    last = db.scalar(select(func.max(RoutineEntry.updated_at)))
    return {"updated_at": iso(last) if last else None,
            "semester_start": settings.get(db, "semester_start"),
            "semester_end": settings.get(db, "semester_end")}


@router.get("/routine/export.ics")
def export_ics(department: str | None = None, batch: str | None = None, section: str | None = None,
               teacher: str | None = None, db: Session = Depends(get_db)):
    rows = [entry_out(e) for e in query_entries(db, department, batch, section, teacher)]
    name = " ".join(x for x in ["Routine", department, batch, section, teacher] if x)
    body = build_ics(rows, name, settings.get_date(db, "semester_start"), settings.get_date(db, "semester_end"))
    return Response(body, media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": 'inline; filename="routine.ics"'})


@router.get("/routine/stream")
async def stream(request: Request):
    """Server-Sent Events: the client refetches when it receives `routine-updated` / `notice`."""
    q = events.subscribe()

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while not await request.is_disconnected():
                try:
                    yield await asyncio.wait_for(q.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            events.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/notices")
def notices(db: Session = Depends(get_db)):
    rows = db.scalars(select(Notice).order_by(Notice.created_at.desc()).limit(20))
    return [{"id": n.id, "title": n.title, "body": n.body, "level": n.level,
             "created_at": iso(n.created_at)} for n in rows]
