import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
from datetime import date, timedelta

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/t.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/up"
os.environ["ADMIN_EMAIL"] = "admin@test.io"
os.environ["ADMIN_PASSWORD"] = "adminpass1"
os.environ["APP_ENV"] = "development"

import pytest
from fastapi.testclient import TestClient
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table, TableStyle

from app.main import app
from app.ratelimit import limiter
from app.services import cgpa as cgpa_svc
from app.services.conflicts import find_conflicts
from app.services.pdf_parser import parse_cell, parse_context, parse_time_range

ROOT = pathlib.Path(__file__).resolve().parents[2]
SLOTS = ["09:00-10:30", "10:30-12:00", "02:00-03:30"]


def make_pdf(variant: int = 1, scanned_page: bool = False) -> bytes:
    """Three batches. Batch 39A deliberately clashes with 40A (same teacher AND room, Sat 09:00).
    variant=2 moves SWE-201 to another room, to prove a re-upload replaces PDF-derived rows."""
    st = getSampleStyleSheet()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))

    def grid(rows, spans=()):
        t = Table([["Day"] + SLOTS] + rows)
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.black), *[("SPAN", a, b) for a, b in spans]]))
        return t

    room201 = "R-302" if variant == 1 else "R-999"
    out = [Paragraph("Department of Software Engineering &nbsp;&nbsp;&nbsp; Batch 40 &nbsp;&nbsp;&nbsp; Section A", st["Title"]),
           grid([["Sat", "SWE-101 Intro to Programming\nDr. Rahim\nRoom 301", "", "SWE-102 Programming Lab\nMd. Karim\nRoom 405"],
                 ["Sun", "", f"SWE-201 Data Structures\nDr. Rahim\n{room201}", ""],
                 ["Wed", "SWE-120 Networks Lab\nDr. Zaman\nRoom 410", "", ""]],
                spans=[((1, 3), (2, 3))]),   # Wed lab spans the first two slots -> 09:00-12:00
           PageBreak(),
           Paragraph("Department of Computer Science & Engineering &nbsp;&nbsp;&nbsp; Batch 38 &nbsp;&nbsp;&nbsp; Section B", st["Title"]),
           grid([["Mon", "CSE-310 Elective: AI\nProf. Salma\nRoom 210", "", ""],
                 ["Tue", "", "", "CSE-400 Thesis Project\nDr. Jalil\nRoom 101"]]),
           PageBreak(),
           Paragraph("Department of Software Engineering &nbsp;&nbsp;&nbsp; 39th Batch &nbsp;&nbsp;&nbsp; Section A", st["Title"]),
           grid([["Sat", "SWE-150 Algorithms\nDr. Rahim\nRoom 301", "", ""]])]
    doc.build(out)
    return buf.getvalue()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_limiter():
    limiter.reset()


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def login(client, email, pw):
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    client.cookies.clear()  # tests pass the bearer token explicitly
    return r.json()["token"]


def upload(client, admin, pdf, term="Fall 2026"):
    r = client.post("/api/admin/uploads", headers=hdr(admin), data={"term": term},
                    files={"file": ("r.pdf", pdf, "application/pdf")})
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------- parser units
def test_parser_units():
    assert parse_time_range("9:00 - 10:30 AM") == ("09:00", "10:30")
    assert parse_time_range("11:30-1:00") == ("11:30", "13:00")
    assert parse_time_range("02:00-03:30") == ("14:00", "15:30")
    assert parse_time_range("08:00-09:30") == ("08:00", "09:30")
    e = parse_cell("SWE-102 Programming Lab\nMd. Karim\nRoom 405")[0]
    assert (e["code"], e["room"], e["kind"]) == ("SWE-102", "405", "lab")
    assert "Karim" in e["teacher"]
    assert len(parse_cell("SWE-101 Dr. A R301 CSE-110 Dr. B R302")) == 2


@pytest.mark.parametrize("text,expected", [
    ("Department of Software Engineering   Batch 40   Section A", ("Software Engineering", "40", "A")),
    ("Department of Software Engineering 39th Batch Section B", ("Software Engineering", "39", "B")),
    ("SWE Routine - Batch 41A", ("Software Engineering", "41", "A")),
    ("Department of Computer Science & Engineering Batch: 38 (B)", ("Computer Science & Engineering", "38", "B")),
])
def test_header_variants(text, expected):
    assert parse_context(text) == expected


def test_conflict_detection_rules():
    base = dict(department="D", batch="1", section="A", day="Sat", room="", teacher="")
    rows = [
        {**base, "id": 1, "code": "X-100", "start": "09:00", "end": "10:30", "teacher": "Dr. A", "room": "1"},
        {**base, "id": 2, "batch": "2", "code": "Y-100", "start": "10:00", "end": "11:00", "teacher": "dr a", "room": "1"},
        {**base, "id": 3, "batch": "3", "code": "X-100", "start": "09:00", "end": "10:30", "teacher": "Dr. A", "room": "1"},  # joint class
        {**base, "id": 4, "code": "Z-100", "start": "10:30", "end": "11:30"},  # touching, not overlapping
    ]
    kinds = sorted(c["type"] for c in find_conflicts(rows))
    assert kinds == ["room", "room", "teacher", "teacher"]  # row 2 clashes with rows 1 and 3; joint class 1/3 is fine


# ---------------------------------------------------------------- CGPA vectors shared with the browser
@pytest.mark.parametrize("v", json.loads((ROOT / "shared/cgpa-vectors.json").read_text()), ids=lambda v: v["name"][:40])
def test_cgpa_vectors(v):
    a = cgpa_svc.analytics(v["semesters"], policy=v["policy"])
    e = v["expect"]
    assert [r["sgpa"] for r in a["semesters"]] == e["sgpa"]
    assert [r["cgpa"] for r in a["semesters"]] == e["cgpa_by_semester"]
    assert (a["cgpa"], a["total_credits"], a["earned_credits"], a["badge"], a["status"]) == \
           (e["cgpa"], e["total_credits"], e["earned_credits"], e["badge"], e["status"])


# ---------------------------------------------------------------- full flow
def test_full_flow(client):
    admin = login(client, "admin@test.io", "adminpass1")
    client.cookies.clear()
    assert client.post("/api/admin/uploads").status_code == 401
    u = client.post("/api/auth/register", json={"name": "Stu", "email": "s@x.io", "password": "password1"}).json()
    client.cookies.clear()
    assert client.get("/api/admin/stats", headers=hdr(u["token"])).status_code == 403
    assert client.post("/api/auth/register", json={"name": "Stu", "email": "s@x.io", "password": "password1"}).status_code == 409

    # invalid uploads
    bad = client.post("/api/admin/uploads", headers=hdr(admin), files={"file": ("a.pdf", b"nope", "application/pdf")})
    assert bad.status_code == 400

    # upload -> DRAFT: nothing is live yet
    up = upload(client, admin, make_pdf())
    assert up["status"] == "draft" and up["entries"] == 7 and up["batches"] == 3, up
    assert client.get("/api/routine").json() == []
    assert client.get("/api/routine/filters").json() == {}

    # preview: rows, merged lab, clashes
    pv = client.get(f"/api/admin/uploads/{up['id']}/preview", headers=hdr(admin)).json()
    lab = next(e for e in pv["entries"] if e["code"] == "SWE-120")
    assert (lab["start"], lab["end"]) == ("09:00", "12:00")          # merged cells -> one long class
    assert {c["type"] for c in pv["conflicts"]} == {"teacher", "room"}  # 39A vs 40A, Dr. Rahim + Room 301
    assert all(b["is_new_batch"] for b in pv["per_batch"])

    # publish -> live
    pub = client.post(f"/api/admin/uploads/{up['id']}/publish", headers=hdr(admin))
    assert pub.status_code == 200 and pub.json()["status"] == "published"
    assert client.post(f"/api/admin/uploads/{up['id']}/publish", headers=hdr(admin)).status_code == 409
    tree = client.get("/api/routine/filters").json()
    assert tree["Software Engineering"]["40"] == ["A"] and "39" in tree["Software Engineering"]
    rows = client.get("/api/routine", params={"department": "Software Engineering", "batch": "40", "section": "A"}).json()
    assert {r["code"] for r in rows} == {"SWE-101", "SWE-102", "SWE-201", "SWE-120"}
    assert "Dr. Rahim" in client.get("/api/routine/teachers").json()
    assert {r["code"] for r in client.get("/api/routine", params={"teacher": "Dr. Rahim"}).json()} == {"SWE-101", "SWE-201", "SWE-150"}
    assert client.get("/api/admin/conflicts", headers=hdr(admin)).json()
    assert client.get("/api/admin/stats", headers=hdr(admin)).json()["conflicts"] >= 2

    # manual edit, then re-upload: NO duplicate, edit survives, other rows refreshed
    se201 = next(r for r in rows if r["code"] == "SWE-201")
    r = client.patch(f"/api/admin/entries/{se201['id']}", headers=hdr(admin), json={"start_time": "11:00", "end_time": "12:30", "room": "777"})
    assert r.json()["room"] == "777" and r.json()["is_manual"]
    before = len(client.get("/api/routine", params={"batch": "40"}).json())
    up2 = upload(client, admin, make_pdf(variant=2), term="Fall 2026 v2")
    assert client.post(f"/api/admin/uploads/{up2['id']}/publish", headers=hdr(admin)).status_code == 200
    after = client.get("/api/routine", params={"batch": "40"}).json()
    assert len(after) == before, "re-upload must not duplicate an entry an admin edited"
    s201 = [r for r in after if r["code"] == "SWE-201"]
    assert len(s201) == 1 and s201[0]["room"] == "777" and s201[0]["start"] == "11:00"

    # rollback is newest-first and restores the previous state
    assert client.post(f"/api/admin/uploads/{up['id']}/rollback", headers=hdr(admin)).status_code == 409
    assert client.post(f"/api/admin/uploads/{up2['id']}/rollback", headers=hdr(admin)).status_code == 200
    restored = client.get("/api/routine", params={"batch": "40"}).json()
    assert len(restored) == before and sum(r["code"] == "SWE-201" for r in restored) == 1
    assert client.post(f"/api/admin/uploads/{up['id']}/rollback", headers=hdr(admin)).status_code == 200
    assert client.get("/api/routine", params={"batch": "40"}).json() == [r for r in restored if r["is_manual"]]

    # discard a draft
    up3 = upload(client, admin, make_pdf())
    assert client.post(f"/api/admin/uploads/{up3['id']}/discard", headers=hdr(admin)).json()["status"] == "discarded"

    # semester dates drive the calendar feed
    start, end = date.today(), date.today() + timedelta(days=110)
    assert client.put("/api/admin/settings", headers=hdr(admin),
                      json={"semester_start": start.isoformat(), "semester_end": end.isoformat()}).status_code == 200
    assert client.put("/api/admin/settings", headers=hdr(admin),
                      json={"semester_start": end.isoformat(), "semester_end": start.isoformat()}).status_code == 422
    ics = client.get("/api/routine/export.ics", params={"batch": "40"}).text
    assert "BEGIN:VEVENT" in ics and "BEGIN:VTIMEZONE" in ics and "TZID:Asia/Dhaka" in ics
    assert f"UNTIL={end:%Y%m%d}T235959Z" in ics
    assert client.get("/api/routine/meta").json()["semester_end"] == end.isoformat()
    # an ended semester produces no events instead of events in the past
    client.put("/api/admin/settings", headers=hdr(admin), json={"semester_start": "2020-01-01", "semester_end": "2020-04-01"})
    assert "BEGIN:VEVENT" not in client.get("/api/routine/export.ics", params={"batch": "40"}).text
    client.put("/api/admin/settings", headers=hdr(admin), json={"semester_start": start.isoformat(), "semester_end": end.isoformat()})

    # notices, audit log, users
    assert client.post("/api/admin/notices", headers=hdr(admin), json={"title": "Room change", "level": "change"}).status_code == 201
    assert client.get("/api/notices").json()[0]["title"] == "Room change"
    actions = {a["action"] for a in client.get("/api/admin/audit", headers=hdr(admin)).json()}
    assert {"upload", "publish", "rollback", "discard", "entry-edit", "notice", "settings"} <= actions
    assert any(x["email"] == "s@x.io" for x in client.get("/api/admin/users", headers=hdr(admin)).json())

    # preferences + CGPA with retake and special grades
    t = u["token"]
    p = client.put("/api/auth/preferences", headers=hdr(t), json={"department": "Software Engineering", "batch": "40", "section": "A"})
    assert p.json()["prefs"]["batch"] == "40"
    s1 = {"name": "Sem 1", "courses": [{"course_name": "Math", "credits": 3, "grade": "F"}, {"course_name": "Phy", "credits": 3, "grade": "A"}]}
    s2 = {"name": "Sem 2", "courses": [{"course_name": "math", "credits": 3, "grade": "B"}, {"course_name": "Seminar", "credits": 1, "grade": "P"}]}
    client.post("/api/cgpa/semesters", headers=hdr(t), json=s1)
    d = client.post("/api/cgpa/semesters", headers=hdr(t), json=s2).json()
    a = d["analytics"]
    assert (a["cgpa"], a["earned_credits"], a["status"]) == (3.38, 6, "Improving")
    assert "P" in d["specials"] and d["policy"] == "latest"
    assert client.post("/api/cgpa/semesters", headers=hdr(t),
                       json={"name": "x", "courses": [{"course_name": "a", "credits": 3, "grade": "Z"}]}).status_code == 422
    assert client.get("/api/cgpa/report.pdf", headers=hdr(t)).content.startswith(b"%PDF")
    o = client.post("/api/auth/register", json={"name": "O", "email": "o@x.io", "password": "password1"}).json()
    client.cookies.clear()
    assert client.delete(f"/api/cgpa/semesters/{d['semesters'][0]['id']}", headers=hdr(o["token"])).status_code == 404


# ---------------------------------------------------------------- parser edge cases
def test_scanned_pdf_gives_actionable_error(client, tmp_path):
    from reportlab.pdfgen import canvas
    pdf = io.BytesIO()
    c = canvas.Canvas(pdf)
    c.rect(50, 50, 200, 200)  # a page with a drawing but no text layer
    c.save()
    admin = login(client, "admin@test.io", "adminpass1")
    r = client.post("/api/admin/uploads", headers=hdr(admin), files={"file": ("scan.pdf", pdf.getvalue(), "application/pdf")})
    assert r.status_code == 201 and r.json()["status"] == "failed"
    assert "OCR" in r.json()["log"]


# ---------------------------------------------------------------- security
def test_secrets_required_in_production():
    env = {**os.environ, "APP_ENV": "production", "JWT_SECRET": "short", "ADMIN_PASSWORD": "admin12345"}
    r = subprocess.run([sys.executable, "-c", "import app.config"], env=env, cwd=ROOT / "backend", capture_output=True, text=True)
    assert r.returncode != 0 and "JWT_SECRET" in r.stderr
    env.update(JWT_SECRET="x" * 40)
    r = subprocess.run([sys.executable, "-c", "import app.config"], env=env, cwd=ROOT / "backend", capture_output=True, text=True)
    assert r.returncode != 0 and "ADMIN_PASSWORD" in r.stderr
    env.update(ADMIN_PASSWORD="a-strong-passphrase")
    assert subprocess.run([sys.executable, "-c", "import app.config"], env=env, cwd=ROOT / "backend").returncode == 0


def test_login_rate_limit(client):
    for _ in range(8):
        assert client.post("/api/auth/login", json={"email": "nobody@x.io", "password": "wrong-pass"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "nobody@x.io", "password": "wrong-pass"})
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_cookie_session_csrf_logout_and_password_change():
    with TestClient(app) as c:
        r = c.post("/api/auth/register", json={"name": "Cookie", "email": "c@x.io", "password": "password1"})
        assert r.status_code == 201
        set_cookie = r.headers["set-cookie"].lower()
        assert "httponly" in set_cookie and "samesite=lax" in set_cookie
        assert c.get("/api/auth/me").status_code == 200                       # cookie alone works for reads
        assert c.put("/api/auth/preferences", json={}).status_code == 403    # write without CSRF header refused
        csrf = {"X-Requested-With": "campus-planner"}
        assert c.put("/api/auth/preferences", json={}, headers=csrf).status_code == 200
        other = TestClient(app)
        other.post("/api/auth/login", json={"email": "c@x.io", "password": "password1"})
        assert other.get("/api/auth/me").status_code == 200
        bad = c.post("/api/auth/change-password", headers=csrf, json={"current_password": "nope-nope", "new_password": "newpassword1"})
        assert bad.status_code == 400
        ok = c.post("/api/auth/change-password", headers=csrf, json={"current_password": "password1", "new_password": "newpassword1"})
        assert ok.status_code == 200
        assert c.get("/api/auth/me").status_code == 200       # this device gets a fresh session
        assert other.get("/api/auth/me").status_code == 401   # every other device is signed out
        c.post("/api/auth/logout", headers=csrf)
        assert c.get("/api/auth/me").status_code == 401


def test_admin_password_reset_signs_user_out(client):
    admin = login(client, "admin@test.io", "adminpass1")
    s = client.post("/api/auth/register", json={"name": "R", "email": "r@x.io", "password": "password1"}).json()
    client.cookies.clear()
    uid = s["user"]["id"]
    tmp = client.post(f"/api/admin/users/{uid}/reset-password", headers=hdr(admin)).json()["temporary_password"]
    assert client.get("/api/auth/me", headers=hdr(s["token"])).status_code == 401
    assert client.post("/api/auth/login", json={"email": "r@x.io", "password": tmp}).status_code == 200


def test_migrations_match_models(tmp_path):
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{tmp_path}/m.db"}
    for cmd in (["upgrade", "head"], ["check"]):
        r = subprocess.run([sys.executable, "-m", "alembic", *cmd], env=env, cwd=ROOT / "backend", capture_output=True, text=True)
        assert r.returncode == 0, r.stderr


# ---------------------------------------------------------------- real university PDF (central layout)
def test_real_central_routine_pdf():
    from app.services.conflicts import find_conflicts
    from app.services.ics import build_ics, _merge_adjacent
    from app.services.pdf_parser import parse_pdf
    res = parse_pdf(str(ROOT / "backend/tests/fixtures/swe_autumn_2026.pdf"))
    rows = res.entry_dicts()
    assert res.term == "Autumn 2026" and len(rows) == 94
    assert {r["department"] for r in rows} == {"Software Engineering"}
    sun5 = {(r["start"], r["code"], r["room"], r["teacher"]) for r in rows if r["batch"] == "5th" and r["day"] == "Sun"}
    assert sun5 == {("12:00", "NA", "E3", "RP"), ("13:30", "NN&DL", "E6", "AAC"),
                    ("15:00", "CP Lab-2", "405", "IAC"), ("16:30", "CP Lab-2", "405", "IAC")}
    assert all(r["kind"] == "lab" for r in rows if "Lab" in r["code"])
    assert any(r["batch"] == "ACM" for r in rows) and len(res.warnings) == 1 and "ACM" in res.warnings[0]
    assert find_conflicts(rows) == []
    # two-slot labs become one calendar event
    merged = _merge_adjacent([{**r, "id": i} for i, r in enumerate(rows)])
    assert len(merged) < len(rows)
    assert "SUMMARY:CP Lab-2" in build_ics([{**r, "id": i} for i, r in enumerate(rows)], "t")
