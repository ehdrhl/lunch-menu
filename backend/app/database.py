from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

# READ COMMITTED: 라운드 폴링이 동시에 들어와도 '이미 바뀐 행'(MariaDB 오류 1020)으로 실패하지 않고
# 항상 최신 커밋 값을 읽는다.
engine = (
    create_engine(settings.database_url, pool_pre_ping=True, isolation_level="READ COMMITTED")
    if settings.database_url
    else None
)
SessionLocal = sessionmaker(bind=engine, autoflush=False) if engine else None


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
