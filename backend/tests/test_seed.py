import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import seed as seed_module
from app.database import Base
from app.models import Category, Restaurant, User
from app.security import verify_password


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session


def counts(db: Session):
    return {m.__name__: db.scalar(select(func.count()).select_from(m)) for m in (User, Category, Restaurant)}


def test_seed_creates_one_demo_user_with_twenty_restaurants(db):
    user = seed_module.seed(db)
    assert counts(db) == {"User": 1, "Category": 8, "Restaurant": 20}
    assert user.username == "demo" and verify_password(seed_module.SEED_PASSWORD, user.password_hash)


def mine(db, user):
    return list(db.scalars(select(Restaurant).where(Restaurant.user_id == user.id)))


def test_seed_data_is_valid(db):
    user = seed_module.seed(db)
    rows = mine(db, user)
    assert len({r.name for r in rows}) == 20  # 이름이 겹치지 않는다
    cats = {c.id: c.name for c in db.scalars(select(Category))}
    assert len({cats[r.category_id] for r in rows}) == 8  # 8개 카테고리를 모두 쓴다
    for r in rows:
        assert r.tags and len(r.tags) <= 5 and all(len(t) <= 20 for t in r.tags)
        assert len(r.name) <= 100
        assert r.link_url is None or r.link_url.startswith(("http://", "https://"))
    assert any(r.link_url for r in rows) and any(r.link_url is None for r in rows)
    assert len({t for r in rows for t in r.tags}) >= 5  # 태그 필터를 시험할 만큼 다양하다


def test_seed_is_idempotent_and_reset_rebuilds(db):
    first = seed_module.seed(db)
    again = seed_module.seed(db)
    assert again.id == first.id
    assert counts(db) == {"User": 1, "Category": 8, "Restaurant": 20}
    seed_module.seed(db, reset=True)
    assert counts(db) == {"User": 1, "Category": 8, "Restaurant": 20}


def test_reset_does_not_touch_other_users_or_default_restaurants(db):
    seed_module.seed(db)
    other = User(username="other001", password_hash="x", nickname="다른")
    db.add(other)
    db.flush()
    cat = db.scalar(select(Category))
    db.add_all([Restaurant(user_id=other.id, name="남의집", category_id=cat.id), Restaurant(user_id=None, name="공용집", category_id=cat.id)])
    db.commit()
    seed_module.seed(db, reset=True)
    assert db.scalar(select(User).where(User.username == "other001")) is not None
    assert {r.name for r in db.scalars(select(Restaurant).where(Restaurant.name.in_(["남의집", "공용집"])))} == {"남의집", "공용집"}


def test_seed_works_with_the_app_api(client):
    """시드 사용자로 로그인해 실제 추첨 흐름이 돈다(식당 20개 중 하나가 뽑힌다)."""
    from app.database import get_db
    from app.main import app

    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    seed_module.seed(db)
    gen.close()
    token = client.post("/api/auth/login", json={"username": "demo", "password": seed_module.SEED_PASSWORD}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    assert len(client.get("/api/restaurants", headers=h).json()) == 20
    out = client.post("/api/spins", headers=h)
    assert out.status_code == 200 and out.json()["restaurant"]["name"] in {r[0] for r in seed_module.RESTAURANTS}
