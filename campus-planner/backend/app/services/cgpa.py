"""CGPA maths. The browser mirrors this in frontend/src/lib/cgpa.js; both are checked against
the same fixtures in shared/cgpa-vectors.json, so the live preview never disagrees with the server.

Rules
* SGPA   = sum(points x credits) / sum(credits) over the semester's graded courses.
* CGPA   = the same over all semesters. With RETAKE_POLICY=latest a course name that appears in
           several semesters counts once, using its most recent attempt (SGPA still shows every
           attempt of that semester). With RETAKE_POLICY=all every attempt counts.
* P / W / I grades are ignored. T (transfer) adds earned credits but no grade points.
* Earned credits = credits of counted courses with points > 0, plus transfer credits.
* Values are rounded half-up to 2 decimals only for display; sums stay unrounded.
"""
import math
import re

from ..config import GRADE_POINTS, RETAKE_POLICY


def r2(x: float) -> float:
    return math.floor(x * 100 + 0.5 + 1e-9) / 100


def _norm(name: str | None) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _graded(c: dict, scale: dict) -> bool:
    return c["grade"] in scale and c["credits"] > 0


def totals(courses: list[dict], scale: dict) -> tuple[float, float]:
    """(credits, grade_points x credits) for one list of courses, retakes not considered."""
    cr = pts = 0.0
    for c in courses:
        if _graded(c, scale):
            cr += c["credits"]
            pts += scale[c["grade"]] * c["credits"]
    return cr, pts


def counted(semesters: list[dict], scale: dict, policy: str) -> list[dict]:
    last: dict[str, int] = {}
    if policy == "latest":
        for i, s in enumerate(semesters):
            for c in s["courses"]:
                if _graded(c, scale) and _norm(c["course_name"]):
                    last[_norm(c["course_name"])] = i
    out = []
    for i, s in enumerate(semesters):
        for c in s["courses"]:
            n = _norm(c["course_name"])
            if _graded(c, scale) and not (policy == "latest" and n and last[n] != i):
                out.append(c)
    return out


def cgpa_status(cgpa: float, sgpas: list[float]) -> str:
    """Critical: CGPA < 3.00 or latest SGPA < 2.50. Improving: latest SGPA rose by > 0.05. Else Good."""
    if not sgpas:
        return "Good"
    if cgpa < 3.0 or sgpas[-1] < 2.5:
        return "Critical"
    if len(sgpas) > 1 and sgpas[-1] > sgpas[-2] + 0.05:
        return "Improving"
    return "Good"


def cgpa_badge(v: float) -> str:
    if v > 3.75: return "emerald"
    if v > 3.50: return "blue"
    if v > 3.00: return "amber"
    return "red"


def analytics(semesters: list[dict], scale: dict | None = None, policy: str | None = None) -> dict:
    """semesters: chronological [{id, name, courses:[{course_name, credits, grade}]}]."""
    scale = scale or GRADE_POINTS
    policy = policy or RETAKE_POLICY
    rows, dist = [], {}
    for i, s in enumerate(semesters):
        cr, pts = totals(s["courses"], scale)
        cum = counted(semesters[:i + 1], scale, policy)
        ccr = sum(c["credits"] for c in cum)
        cpts = sum(scale[c["grade"]] * c["credits"] for c in cum)
        for c in s["courses"]:
            if _graded(c, scale):
                dist[c["grade"]] = dist.get(c["grade"], 0) + 1
        rows.append({"id": s.get("id"), "name": s["name"], "credits": cr,
                     "sgpa": r2(pts / cr) if cr else 0.0, "cgpa": r2(cpts / ccr) if ccr else 0.0})
    final = counted(semesters, scale, policy)
    tc = sum(c["credits"] for c in final)
    tp = sum(scale[c["grade"]] * c["credits"] for c in final)
    earned = sum(c["credits"] for c in final if scale[c["grade"]] > 0)
    earned += sum(c["credits"] for s in semesters for c in s["courses"] if c["grade"] == "T")
    cgpa = r2(tp / tc) if tc else 0.0
    return {
        "semesters": rows, "total_credits": tc, "earned_credits": earned, "total_points": tp,
        "cgpa": cgpa, "badge": cgpa_badge(cgpa),
        "status": cgpa_status(cgpa, [r["sgpa"] for r in rows if r["credits"]]),
        "distribution": [{"grade": g, "count": dist.get(g, 0)} for g in scale],
    }
