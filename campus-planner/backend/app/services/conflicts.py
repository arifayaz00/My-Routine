"""Clash detection for a list of routine rows (dicts with department, batch, section, day,
start, end, code, room, teacher). Works on a parsed draft and on live data alike."""
import re
from collections import defaultdict


def _norm(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _label(e: dict) -> str:
    return f'{e["code"]} ({e["batch"]}{e.get("section", "")})'


def find_conflicts(rows: list[dict], limit: int = 200) -> list[dict]:
    out: list[dict] = []
    by_day: dict[str, list[dict]] = defaultdict(list)
    for e in rows:
        by_day[e["day"]].append(e)
    for day, es in by_day.items():
        es.sort(key=lambda e: e["start"])
        for i, a in enumerate(es):
            for b in es[i + 1:]:
                if b["start"] >= a["end"]:
                    break  # sorted by start: nothing later can overlap `a`
                if a["end"] <= b["start"] or b["end"] <= a["start"]:
                    continue
                if a["code"] == b["code"] and a["start"] == b["start"] and a["end"] == b["end"]:
                    continue  # joint class or duplicate: shared teacher/room is expected
                when = f'{day} {max(a["start"], b["start"])}-{min(a["end"], b["end"])}'
                same_group = (a["department"], a["batch"], a.get("section", "")) == \
                             (b["department"], b["batch"], b.get("section", ""))
                kinds = []
                if same_group:
                    kinds.append(("batch", f'{_label(a)} and {_label(b)} overlap for the same students'))
                if _norm(a.get("teacher")) and _norm(a.get("teacher")) == _norm(b.get("teacher")):
                    kinds.append(("teacher", f'{a["teacher"]} is booked for {_label(a)} and {_label(b)}'))
                if _norm(a.get("room")) and _norm(a.get("room")) == _norm(b.get("room")):
                    kinds.append(("room", f'Room {a["room"]} is booked for {_label(a)} and {_label(b)}'))
                for kind, msg in kinds:
                    out.append({"type": kind, "when": when, "message": msg,
                                "ids": [a.get("id"), b.get("id")]})
                    if len(out) >= limit:
                        return out
    return out
