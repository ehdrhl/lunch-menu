import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("빈 값은 입력할 수 없습니다.")
    return v


USERNAME_RE = re.compile(r"^[a-z0-9_]{4,20}$")


class SignupIn(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=64)
    nickname: str = Field(min_length=1, max_length=20)

    _nickname = field_validator("nickname")(_strip)

    @field_validator("username")
    @classmethod
    def _username(cls, v):
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError("아이디는 영문 소문자·숫자·밑줄 4~20자로 입력해 주세요.")
        return v


class LoginIn(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=64)

    @field_validator("username")
    @classmethod
    def _username(cls, v):
        return v.strip().lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nickname: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RestaurantIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category_id: int
    tags: list[str] = Field(default_factory=list)
    link_url: str | None = Field(default=None, max_length=500)
    memo: str | None = Field(default=None, max_length=300)

    _name = field_validator("name")(_strip)

    @field_validator("tags")
    @classmethod
    def _tags(cls, v):
        cleaned: list[str] = []
        for t in v:
            t = t.strip()
            if not t:
                continue
            if len(t) > 20:
                raise ValueError("태그는 20자 이하여야 합니다.")
            if t not in cleaned:
                cleaned.append(t)
        if len(cleaned) > 5:
            raise ValueError("태그는 최대 5개까지 입력할 수 있습니다.")
        return cleaned

    @field_validator("link_url")
    @classmethod
    def _link(cls, v):
        v = (v or "").strip()
        if not v:
            return None
        if not (v.startswith("http://") or v.startswith("https://")) or len(v) <= len("https://"):
            raise ValueError("링크는 http:// 또는 https://로 시작해야 합니다.")
        return v

    @field_validator("memo")
    @classmethod
    def _memo(cls, v):
        v = (v or "").strip()
        return v or None


class RestaurantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    category_name: str
    tags: list[str]
    link_url: str | None
    memo: str | None
    created_at: datetime | None = None
    mine: bool = False  # 내가 등록한 식당이면 true(기본 식당은 false)
    warning: str | None = None


class SpinFilter(BaseModel):
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)

    @field_validator("categories", "tags")
    @classmethod
    def _clean(cls, v):
        cleaned: list[str] = []
        for item in v:
            item = item.strip()
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned


class SpinOut(BaseModel):
    restaurant: RestaurantOut


class SpinHistoryItem(BaseModel):
    id: int
    created_at: datetime
    restaurant: RestaurantOut | None  # 식당이 삭제됐으면 null
    filter: SpinFilter
