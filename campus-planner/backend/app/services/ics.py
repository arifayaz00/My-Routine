from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from ..config import SEMESTER_WEEKS, TIMEZONE

_WD = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
_BYDAY = {"Mon": "MO", "Tue": "TU", "Wed": "WE", "Thu": "TH", "Fri": "FR", "Sat": "SA", "Sun": "SU"}


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> str:
    """RFC 5545: lines longer than 75 octets are folded with CRLF + space."""
    raw, out = line.encode(), []
    while len(raw) > 75:
        cut = 75
        while raw[cut] & 0xC0 == 0x80:  # don't split a UTF-8 character
            cut -= 1
        out.append(raw[:cut].decode())
        raw = b" " + raw[cut:]
    out.append(raw.decode())
    return "\r\n".join(out)


def _vtimezone() -> list[str]:
    """Fixed-offset zones (e.g. Asia/Dhaka, +06:00 all year) get an explicit VTIMEZONE so every
    client agrees; zones with daylight saving are left to the client's own IANA database."""
    try:
        z = ZoneInfo(TIMEZONE)
        jan = datetime(2026, 1, 15, tzinfo=z).utcoffset()
        jul = datetime(2026, 7, 15, tzinfo=z).utcoffset()
    except Exception:  # noqa: BLE001
        return []
    if jan is None or jan != jul:
        return []
    s = int(jan.total_seconds())
    off = f'{"+" if s >= 0 else "-"}{abs(s) // 3600:02d}{abs(s) % 3600 // 60:02d}'
    return ["BEGIN:VTIMEZONE", f"TZID:{TIMEZONE}", "BEGIN:STANDARD", "DTSTART:19700101T000000",
            f"TZOFFSETFROM:{off}", f"TZOFFSETTO:{off}", "END:STANDARD", "END:VTIMEZONE"]


def _merge_adjacent(entries: list[dict]) -> list[dict]:
    """Two-slot labs are stored as two back-to-back entries; calendars get one longer event."""
    keys = ("department", "batch", "section", "day", "code", "room", "teacher")
    out: list[dict] = []
    for e in sorted(entries, key=lambda x: (*(x.get(k, "") for k in keys), x["start"])):
        p = out[-1] if out else None
        if p and all(p.get(k) == e.get(k) for k in keys) and p["end"] == e["start"]:
            out[-1] = {**p, "end": e["end"]}
        else:
            out.append(e)
    return out


def build_ics(entries: list[dict], name: str, start: date | None = None, end: date | None = None) -> str:
    """Weekly recurring events from the semester start (or today) until the semester end
    (or SEMESTER_WEEKS weeks). Subscribe to the URL in a calendar app and it refreshes itself."""
    today = date.today()
    base = max(today, start) if start else today
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Campus Planner//EN", "CALSCALE:GREGORIAN",
             f"X-WR-CALNAME:{_esc(name)}", f"X-WR-TIMEZONE:{TIMEZONE}",
             "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H", *_vtimezone()]
    for e in _merge_adjacent(entries):
        first = base + timedelta(days=(_WD[e["day"]] - base.weekday()) % 7)
        if end and first > end:
            continue
        s = datetime.combine(first, datetime.strptime(e["start"], "%H:%M").time())
        t = datetime.combine(first, datetime.strptime(e["end"], "%H:%M").time())
        limit = f"UNTIL={end:%Y%m%d}T235959Z" if end else f"COUNT={SEMESTER_WEEKS}"
        title = f'{e["code"]} {e.get("title", "")}'.strip()
        lines += [
            "BEGIN:VEVENT", f'UID:entry-{e["id"]}@campus-planner', f"DTSTAMP:{stamp}",
            f"DTSTART;TZID={TIMEZONE}:{s:%Y%m%dT%H%M%S}", f"DTEND;TZID={TIMEZONE}:{t:%Y%m%dT%H%M%S}",
            f"RRULE:FREQ=WEEKLY;BYDAY={_BYDAY[e['day']]};{limit}",
            f"SUMMARY:{_esc(title)}", f'LOCATION:{_esc(e.get("room", ""))}',
            f'DESCRIPTION:{_esc(e.get("teacher", ""))}', "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(l) for l in lines) + "\r\n"
