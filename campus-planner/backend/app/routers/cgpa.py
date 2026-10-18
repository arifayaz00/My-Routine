import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import GRADE_POINTS, RETAKE_POLICY, SPECIAL_GRADES
from ..database import get_db
from ..models import GradeEntry, Semester, User
from ..schemas import SemesterIn
from ..security import current_user
from ..services.cgpa import analytics

router = APIRouter(prefix="/api/cgpa", tags=["cgpa"])


def _load(db: Session, user: User) -> list[Semester]:
    return list(db.scalars(select(Semester).where(Semester.user_id == user.id)
                           .order_by(Semester.position, Semester.id)))


def _dump(sems: list[Semester]) -> dict:
    data = [{"id": s.id, "name": s.name,
             "courses": [{"id": c.id, "course_name": c.course_name, "credits": c.credits, "grade": c.grade}
                         for c in s.courses]} for s in sems]
    return {"semesters": data, "analytics": analytics(data), "scale": GRADE_POINTS,
            "specials": SPECIAL_GRADES, "policy": RETAKE_POLICY}


def _owned(db: Session, user: User, sid: int) -> Semester:
    s = db.get(Semester, sid)
    if not s or s.user_id != user.id:  # 404 (not 403) so ids can't be probed
        raise HTTPException(404, "Semester not found")
    return s


@router.get("")
def get_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _dump(_load(db, user))


@router.post("/semesters", status_code=201)
def create(body: SemesterIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    pos = len(_load(db, user))
    s = Semester(user_id=user.id, name=body.name, position=pos,
                 courses=[GradeEntry(**c.model_dump()) for c in body.courses])
    db.add(s)
    db.commit()
    return _dump(_load(db, user))


@router.put("/semesters/{sid}")
def replace(sid: int, body: SemesterIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = _owned(db, user, sid)
    s.name = body.name
    s.courses = [GradeEntry(**c.model_dump()) for c in body.courses]
    db.commit()
    return _dump(_load(db, user))


@router.delete("/semesters/{sid}")
def delete(sid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, user, sid))
    db.commit()
    return _dump(_load(db, user))


@router.get("/report.pdf")
def report(user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _dump(_load(db, user))
    a = d["analytics"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Academic report")
    st = getSampleStyleSheet()
    out = [Paragraph(f"Academic Report - {user.name}", st["Title"]),
           Paragraph(f"CGPA <b>{a['cgpa']:.2f}</b> &nbsp;|&nbsp; Earned credits {a['earned_credits']:g} "
                     f"&nbsp;|&nbsp; Status {a['status']}", st["Normal"]), Spacer(1, 12)]
    for s, r in zip(d["semesters"], a["semesters"]):
        out.append(Paragraph(f"{s['name']} - SGPA {r['sgpa']:.2f} (cumulative {r['cgpa']:.2f})", st["Heading3"]))
        rows = [["Course", "Credits", "Grade", "Points"]] + [
            [c["course_name"], f"{c['credits']:g}", c["grade"], (f"{GRADE_POINTS[c['grade']]:.2f}" if c["grade"] in GRADE_POINTS else "-")]
            for c in s["courses"]]
        t = Table(rows, colWidths=[270, 60, 60, 60])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
                               ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                               ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                               ("FONTSIZE", (0, 0), (-1, -1), 9)]))
        out += [t, Spacer(1, 10)]
    doc.build(out)
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="academic-report.pdf"'})
