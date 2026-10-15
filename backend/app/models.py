from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# SQLite 테스트에서도 AUTOINCREMENT가 동작하도록 BigInteger를 변형한다.
ID = BigInteger().with_variant(Integer, "sqlite")

DEFAULT_CATEGORIES = ["한식", "중식", "일식", "양식", "분식", "아시안", "카페/브런치", "기타"]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(ID, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(ID, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(20), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(ID, primary_key=True, autoincrement=True)
    # NULL이면 모든 사용자에게 보이는 기본 식당(수정·삭제 불가)
    user_id: Mapped[int | None] = mapped_column(ID, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    category_id: Mapped[int] = mapped_column(ID, ForeignKey("categories.id", ondelete="RESTRICT"), index=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    memo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    category: Mapped[Category] = relationship()


class SpinLog(Base):
    __tablename__ = "spin_logs"

    id: Mapped[int] = mapped_column(ID, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ID, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    restaurant_id: Mapped[int | None] = mapped_column(ID, ForeignKey("restaurants.id", ondelete="SET NULL"), nullable=True)
    filter_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
