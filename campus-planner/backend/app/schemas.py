import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .config import GRADE_POINTS, SPECIAL_GRADES

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
Day = Literal["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
Kind = Literal["theory", "lab", "project", "elective", "exam"]
HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("invalid email")
        return v


class LoginIn(BaseModel):
    email: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class PrefsIn(BaseModel):
    department: str | None = None
    batch: str | None = None
    section: str | None = None


class GradeIn(BaseModel):
    course_name: str = Field(min_length=1, max_length=200)
    credits: float = Field(gt=0, le=12)
    grade: str

    @field_validator("grade")
    @classmethod
    def _grade(cls, v):
        if v not in GRADE_POINTS and v not in SPECIAL_GRADES:
            raise ValueError(f"grade must be one of {list(GRADE_POINTS) + list(SPECIAL_GRADES)}")
        return v


class SemesterIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    courses: list[GradeIn] = []


class EntryIn(BaseModel):
    department: str
    batch: str
    section: str = ""
    code: str = Field(min_length=2, max_length=20)
    title: str = ""
    day: Day
    start_time: str = Field(pattern=HHMM)
    end_time: str = Field(pattern=HHMM)
    room: str = ""
    teacher: str = ""
    kind: Kind = "theory"

    @field_validator("end_time")
    @classmethod
    def _order(cls, v, info):
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v


class EntryPatch(BaseModel):
    day: Day | None = None
    start_time: str | None = Field(default=None, pattern=HHMM)
    end_time: str | None = Field(default=None, pattern=HHMM)
    room: str | None = None
    teacher: str | None = None
    kind: Kind | None = None
    title: str | None = None


class NoticeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    level: Literal["info", "change", "urgent"] = "info"


class SettingsIn(BaseModel):
    semester_start: date | None = None
    semester_end: date | None = None

    @field_validator("semester_end")
    @classmethod
    def _order(cls, v, info):
        s = info.data.get("semester_start")
        if v and s and v < s:
            raise ValueError("semester_end must not be before semester_start")
        return v
