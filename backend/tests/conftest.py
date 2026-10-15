import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import DEFAULT_CATEGORIES, Category
from app.ratelimit import limiter


@pytest.fixture(autouse=True)
def _secret_and_limiter(monkeypatch):
    monkeypatch.setattr(settings, "secret_key", "test-secret-key")
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        db.add_all([Category(name=n) for n in DEFAULT_CATEGORIES])
        db.commit()

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def signup(client, username="tester1", password="password1", nickname="테스터"):
    """회원가입하고 Authorization 헤더를 돌려준다."""
    r = client.post("/api/auth/signup", json={"username": username, "password": password, "nickname": nickname})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def categories(client, headers):
    return {c["name"]: c["id"] for c in client.get("/api/categories", headers=headers).json()}
