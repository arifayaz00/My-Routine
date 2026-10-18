from datetime import datetime, timezone

from sqlalchemy import (Boolean, DateTime, Float, ForeignKey, Integer, String,
                        Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    """ISO-8601 with an explicit UTC marker (SQLite hands back naive datetimes)."""
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")  # user | admin
    token_version: Mapped[int] = mapped_column(Integer, default=0)  # bump = log out everywhere
    pref_department: Mapped[str | None] = mapped_column(String(120))
    pref_batch: Mapped[str | None] = mapped_column(String(20))
    pref_section: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    semesters = relationship("Semester", cascade="all, delete-orphan", back_populates="user")


class Batch(Base):
    __tablename__ = "batches"
    __table_args__ = (UniqueConstraint("department", "batch_no", "section"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    department: Mapped[str] = mapped_column(String(120), index=True)
    batch_no: Mapped[str] = mapped_column(String(20))
    section: Mapped[str] = mapped_column(String(20), default="")
    entries = relationship("RoutineEntry", cascade="all, delete-orphan", back_populates="batch")


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    kind: Mapped[str] = mapped_column(String(10), default="theory")
    credits: Mapped[float | None] = mapped_column(Float)


class Upload(Base):
    """One uploaded PDF. Lifecycle: draft -> published -> rolled_back, or draft -> discarded, or failed."""
    __tablename__ = "uploads"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    term: Mapped[str | None] = mapped_column(String(60))  # e.g. "Fall 2026"
    status: Mapped[str] = mapped_column(String(12), default="processing")
    entries_count: Mapped[int] = mapped_column(Integer, default=0)
    batches_count: Mapped[int] = mapped_column(Integer, default=0)
    log: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[str | None] = mapped_column(Text)   # parsed draft (JSON), cleared once published/discarded
    snapshot: Mapped[str | None] = mapped_column(Text)  # rows replaced by publish (JSON), used by rollback
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RoutineEntry(Base):
    __tablename__ = "routine_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"))
    day: Mapped[str] = mapped_column(String(3))          # Sat..Fri
    start_time: Mapped[str] = mapped_column(String(5))   # HH:MM 24h
    end_time: Mapped[str] = mapped_column(String(5))
    room: Mapped[str] = mapped_column(String(30), default="")
    teacher: Mapped[str] = mapped_column(String(120), default="", index=True)
    kind: Mapped[str] = mapped_column(String(10), default="theory")
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    # identity of the class as first created (batch|code|day|start). Survives manual edits so a
    # later PDF upload does not insert a second copy of a class an admin already adjusted.
    origin_key: Mapped[str] = mapped_column(String(160), default="", index=True)
    upload_id: Mapped[int | None] = mapped_column(ForeignKey("uploads.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    batch = relationship("Batch", back_populates="entries")
    course = relationship("Course")


class Notice(Base):
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[str] = mapped_column(String(10), default="info")  # info|change|urgent
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200), default="")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_email: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(40), index=True)
    detail: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class Semester(Base):
    __tablename__ = "semesters"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    position: Mapped[int] = mapped_column(Integer, default=0)
    user = relationship("User", back_populates="semesters")
    courses = relationship("GradeEntry", cascade="all, delete-orphan", order_by="GradeEntry.id")


class GradeEntry(Base):
    __tablename__ = "grade_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    semester_id: Mapped[int] = mapped_column(ForeignKey("semesters.id", ondelete="CASCADE"), index=True)
    course_name: Mapped[str] = mapped_column(String(200))
    credits: Mapped[float] = mapped_column(Float)
    grade: Mapped[str] = mapped_column(String(3))
