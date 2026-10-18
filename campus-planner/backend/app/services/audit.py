from sqlalchemy.orm import Session

from ..models import AuditLog, User


def record(db: Session, user: User, action: str, detail: str = "") -> None:
    """Adds an audit row to the caller's transaction (the caller commits)."""
    db.add(AuditLog(user_email=user.email, action=action, detail=detail[:500]))
