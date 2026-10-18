from datetime import date

from sqlalchemy.orm import Session

from ..models import Setting


def get(db: Session, key: str) -> str | None:
    s = db.get(Setting, key)
    return s.value if s and s.value else None


def put(db: Session, key: str, value: str | None) -> None:
    s = db.get(Setting, key)
    if s:
        s.value = value or ""
    else:
        db.add(Setting(key=key, value=value or ""))


def get_date(db: Session, key: str) -> date | None:
    v = get(db, key)
    try:
        return date.fromisoformat(v) if v else None
    except ValueError:
        return None
