"""Heuristic routine-PDF parser (pdfplumber).

Expected layout (one table per page/batch, either orientation):

    page text :  "Department of Software Engineering  Batch 40  Section A"
    table     :  |  Day | 09:00-10:30 | 10:30-12:00 | ...
                 |  Sat | SWE-101 Dr. X  Room 301 | ... |

Handled: both table orientations, several courses per cell, merged cells (a lab spanning two
slots gets one longer entry), 12h/24h times, "Batch 40A" / "40th Batch" / "Section A" headers.
Everything it cannot place is reported in `warnings` - nothing is dropped silently.
Run `python -m app.cli_parse your.pdf` to see exactly what it reads from a real file.
"""
import re
from dataclasses import asdict, dataclass, field

import pdfplumber

DAYS = {
    "sat": "Sat", "saturday": "Sat", "sun": "Sun", "sunday": "Sun",
    "mon": "Mon", "monday": "Mon", "tue": "Tue", "tues": "Tue", "tuesday": "Tue",
    "wed": "Wed", "wednesday": "Wed", "thu": "Thu", "thur": "Thu", "thurs": "Thu",
    "thursday": "Thu", "fri": "Fri", "friday": "Fri",
}
DEPT_CODES = {
    "SWE": "Software Engineering", "CSE": "Computer Science & Engineering",
    "EEE": "Electrical & Electronic Engineering", "BBA": "Business Administration",
    "CE": "Civil Engineering", "ME": "Mechanical Engineering", "ETE": "Electronics & Telecom Engineering",
}
TIME_RE = re.compile(
    r"(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?", re.I)
COURSE_RE = re.compile(r"\b([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z]?)\b")
ROOM_RE = re.compile(r"(?:\b(?:room|rm)\b|\bR\b)[\s.:#-]*([A-Za-z]?\d{2,4}[A-Za-z]?)|\b([A-Z]-?\d{3})\b", re.I)
TEACHER_RE = re.compile(r"((?:Dr|Prof|Md|Mr|Mrs|Ms|Engr)\.?\s+[A-Za-z.\s]+|\b[A-Z]{2,5}\b$)")
BATCH_RES = [re.compile(r"batch[\s:.#-]*(\d+)", re.I), re.compile(r"\b(\d+)(?:st|nd|rd|th)\s+batch", re.I)]
SECTION_RES = [
    re.compile(r"\bsec(?:tion)?[\s:.#-]*([A-Za-z0-9]{1,3})\b", re.I),
    re.compile(r"(?i:batch)[\s:.#-]*\d+\s*[-(]?\s*([A-Z])\b"),  # "Batch 40A", "Batch 40 (A)"
]
DEPT_RE = re.compile(r"department\s+of\s+([A-Za-z&,\s]+?)(?=\s{2,}|\n|\bbatch\b|\bsec(?:tion)?\b|\d|$)", re.I)


@dataclass
class ParsedEntry:
    department: str
    batch: str
    section: str
    day: str
    start: str
    end: str
    code: str
    title: str = ""
    room: str = ""
    teacher: str = ""
    kind: str = "theory"


@dataclass
class ParseResult:
    entries: list[ParsedEntry] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    log: list[str] = field(default_factory=list)
    term: str = ""

    def entry_dicts(self) -> list[dict]:
        return [asdict(e) for e in self.entries]


def _to24(h: str, m: str, ap: str | None) -> str:
    hh = int(h)
    if ap:
        ap = ap.lower()
        if ap == "pm" and hh < 12:
            hh += 12
        if ap == "am" and hh == 12:
            hh = 0
    return f"{hh:02d}:{m}"


def parse_time_range(text: str) -> tuple[str, str] | None:
    m = TIME_RE.search(text or "")
    if not m:
        return None
    h1, m1, a1, h2, m2, a2 = m.groups()
    a1 = a1 or a2  # "9:00-10:30 AM" -> both AM
    if a1 or a2:
        return _to24(h1, m1, a1), _to24(h2, m2, a2)
    # No am/pm printed: nobody holds class at 2 AM, so hours 1-7 mean afternoon
    # ("02:00-03:30" -> 14:00-15:30, "11:30-1:00" -> 11:30-13:00).
    sh, eh = int(h1), int(h2)
    if sh < 8:
        sh += 12
    if eh < 8:
        eh += 12
    return f"{sh:02d}:{m1}", f"{eh:02d}:{m2}"


def classify(text: str) -> str:
    t = text.lower()
    if re.search(r"exam|substitute|makeup|make-up|replacement|cancel", t):
        return "exam"
    if re.search(r"\blab\b|sessional|laboratory", t):
        return "lab"
    if re.search(r"project|thesis|capstone", t):
        return "project"
    if "elective" in t or "(opt)" in t:
        return "elective"
    return "theory"


def _first(patterns: list[re.Pattern], text: str) -> str:
    for p in patterns:
        if (m := p.search(text)):
            return m.group(1)
    return ""


def parse_context(text: str) -> tuple[str, str, str]:
    """Department, batch, section from a page header."""
    head = "\n".join((text or "").splitlines()[:8])
    dept = ""
    if (m := DEPT_RE.search(head)):
        dept = m.group(1).strip(" ,")
    else:
        for code, name in DEPT_CODES.items():
            if re.search(rf"\b{code}\b", head):
                dept = name
                break
    for code, name in DEPT_CODES.items():  # normalise "SWE" -> full name
        if dept.upper() == code:
            dept = name
    return dept, _first(BATCH_RES, head), _first(SECTION_RES, head).upper()


def parse_cell(cell: str) -> list[dict]:
    """A cell may hold several courses; split at each course code."""
    if not cell or not cell.strip():
        return []
    flat = re.sub(r"\s+", " ", cell.replace("\n", " ")).strip()
    matches = list(COURSE_RE.finditer(flat))
    if not matches:
        return []
    out = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(flat)
        seg = flat[m.start():end]
        rest = seg[m.end() - m.start():]
        room = ""
        if (rm := ROOM_RE.search(rest)):
            room = (rm.group(1) or rm.group(2) or "").upper()
            rest = rest[:rm.start()] + " " + rest[rm.end():]
        teacher = ""
        if (tm := TEACHER_RE.search(rest.strip())):
            teacher = tm.group(1).strip(" ,-()")
            rest = rest.replace(tm.group(1), " ")
        title = re.sub(r"[()\[\],|-]+", " ", rest)
        title = re.sub(r"\s+", " ", title).strip()
        out.append({
            "code": f"{m.group(1)}-{m.group(2)}", "title": title, "room": room,
            "teacher": teacher, "kind": classify(seg),
        })
    return out


def _is_day(s: str | None) -> str | None:
    return DAYS.get((s or "").strip().lower().rstrip("."))


def _entries_from_table(table, ctx, res: ParseResult, page_no: int):
    dept, batch, section = ctx
    if not table or len(table) < 2:
        return
    header = table[0]
    time_cols = {i: parse_time_range(c or "") for i, c in enumerate(header)}
    time_cols = {i: t for i, t in time_cols.items() if t}
    day_cols = {i: _is_day(c) for i, c in enumerate(header)}
    day_cols = {i: d for i, d in day_cols.items() if d}

    def emit(day, slot, cell, where) -> list[ParsedEntry]:
        parsed = parse_cell(cell or "")
        if (cell or "").strip() and not parsed:
            res.warnings.append(f"p{page_no} {where}: unrecognised cell '{(cell or '').strip()[:40]}'")
        made = [ParsedEntry(dept, batch, section, day, slot[0], slot[1], **p) for p in parsed]
        res.entries.extend(made)
        return made

    # pdfplumber returns None for cells swallowed by a merged cell and "" for genuinely blank ones,
    # so a None right after a class means "this class continues into this slot".
    if len(time_cols) >= 2:            # days down the side, times across the top
        for r, row in enumerate(table[1:], start=2):
            day = _is_day(row[0]) if row else None
            if not day:
                continue
            prev: list[ParsedEntry] = []
            for i in sorted(time_cols):
                slot, cell = time_cols[i], (row[i] if i < len(row) else "")
                if cell is None and prev:
                    for e in prev:
                        e.end = slot[1]
                    continue
                prev = emit(day, slot, cell, f"row {r} {day}")
    elif len(day_cols) >= 2:           # days across the top, times down the side
        prev_by_col: dict[int, list[ParsedEntry]] = {}
        for r, row in enumerate(table[1:], start=2):
            slot = parse_time_range(row[0] or "") if row else None
            if not slot:
                continue
            for i, day in day_cols.items():
                cell = row[i] if i < len(row) else ""
                if cell is None and prev_by_col.get(i):
                    for e in prev_by_col[i]:
                        e.end = slot[1]
                    continue
                prev_by_col[i] = emit(day, slot, cell, f"row {r} {slot[0]}")
    else:
        res.warnings.append(f"p{page_no}: table without recognisable day/time header skipped")


# ---------------------------------------------------------------- "central routine" layout
# One big table: day separator rows ("Sunday | SWE"), one row per batch ("5th" | 37 students),
# then N time slots x 3 columns (course short form | room | faculty short form).
BATCH_LABEL_RE = re.compile(r"^\d{1,3}\s*(?:st|nd|rd|th)?$", re.I)
TERM_RE = re.compile(r"\b(spring|summer|autumn|fall|winter)\b[^\n]{0,30}?\b(20\d{2})\b", re.I)


def detect_term(text: str) -> str:
    m = TERM_RE.search(text or "")
    return f"{m.group(1).capitalize()} {m.group(2)}" if m else ""


def _clean(c) -> str:
    return re.sub(r"\s+", " ", (c or "").replace("\n", " ")).strip()


def _slot_columns(table) -> dict[int, tuple[str, str]]:
    """{first column of a slot: (start, end)} from the row holding the time ranges."""
    for row in table[:6]:
        cols = {i: t for i, c in enumerate(row) if (t := parse_time_range(c or "")) is not None}
        if len(cols) >= 2:
            return cols
    return {}


def _is_central(table) -> bool:
    flat = " ".join(_clean(c) for row in table[:6] for c in row).lower()
    return bool(_slot_columns(table)) and "short" in flat and "room" in flat


def _central_table(table, res: ParseResult, page_no: int, state: dict) -> None:
    slots = _slot_columns(table) or state.get("slots", {})
    state["slots"] = slots
    for r, row in enumerate(table, start=1):
        if len(row) < 3:
            continue
        c0, c1 = _clean(row[0]), _clean(row[1])
        day = _is_day(c0)
        if day:                                   # "Sunday | SWE" separator row
            state["day"] = day
            if c1:
                state["dept"] = DEPT_CODES.get(c1.upper(), c1)
            continue
        if not c1 or c1.lower() in ("batch",) or not state.get("day"):
            continue
        is_batch = bool(BATCH_LABEL_RE.match(c1))
        if not is_batch and not any(_clean(c) for c in row[2:]):
            continue
        made = 0
        for col, (start, end) in sorted(slots.items()):
            cell = [_clean(row[col + k]) if col + k < len(row) else "" for k in range(3)]
            if not cell[0]:
                if cell[1] or cell[2]:
                    res.warnings.append(f"p{page_no} {state['day']} {c1}: room/faculty without a course at {start}")
                continue
            code = cell[0]
            res.entries.append(ParsedEntry(
                state.get("dept", ""), c1.replace(" ", ""), "", state["day"], start, end,
                code, "", cell[1].upper(), cell[2], classify(code)))
            made += 1
        if not is_batch and made:
            res.warnings.append(f"p{page_no} {state['day']}: '{c1}' is not a batch (no student count); "
                                f"imported {made} slot(s) under that label - delete if it is not a class")


def parse_pdf(path: str) -> ParseResult:
    res = ParseResult()
    with pdfplumber.open(path) as pdf:
        res.log.append(f"Opened PDF: {len(pdf.pages)} page(s)")
        last_ctx = ("", "", "")
        central: dict = {}
        for n, page in enumerate(pdf.pages, start=1):
            if not page.chars:
                res.warnings.append(f"p{n}: no text layer (scanned image?). Run OCR on the PDF first, "
                                    "e.g. `ocrmypdf in.pdf out.pdf`, then upload again")
                continue
            text = page.extract_text() or ""
            res.term = res.term or detect_term(text)
            tables = page.extract_tables()
            ctables = [t for t in tables if t and (_is_central(t) or (central and len(t[0]) > 6))]
            if ctables:
                before = len(res.entries)
                for t in ctables:
                    _central_table(t, res, n, central)
                res.log.append(f"p{n}: central routine layout -> {len(res.entries) - before} entries")
                continue
            ctx = parse_context(text)
            if not any(ctx):
                ctx = last_ctx  # continuation page of the same batch
            last_ctx = ctx
            if not ctx[0] or not ctx[1]:
                res.warnings.append(f"p{n}: department/batch not found in header ({ctx})")
            if not tables:  # fall back to text-aligned tables
                tables = page.extract_tables({"vertical_strategy": "text", "horizontal_strategy": "text"})
            before = len(res.entries)
            for t in tables:
                _entries_from_table(t, ctx, res, n)
            res.log.append(f"p{n}: {ctx[0] or '?'} / batch {ctx[1] or '?'} / sec {ctx[2] or '-'} "
                           f"-> {len(res.entries) - before} entries")
    # de-duplicate identical rows (repeated header pages etc.)
    seen, unique = set(), []
    for e in res.entries:
        k = (e.department, e.batch, e.section, e.day, e.start, e.code)
        if k not in seen:
            seen.add(k)
            unique.append(e)
    res.entries = unique
    return res
