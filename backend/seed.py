"""개발·시연용 시드 데이터: 데모 사용자 1명과 그 사용자의 식당 20개를 만든다.

실행: cd backend && .venv/bin/python seed.py            (이미 있으면 그대로 두고 로그인 정보만 알려 준다)
      cd backend && .venv/bin/python seed.py --reset    (데모 사용자를 지우고 다시 만든다)
"""
import sys

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import DEFAULT_CATEGORIES, Category, Restaurant, SpinLog, User
from app.security import hash_password

SEED_USERNAME = "demo"
SEED_PASSWORD = "demo1234"
SEED_NICKNAME = "데모"

# (이름, 카테고리, 태그, 링크)
RESTAURANTS: list[tuple[str, str, list[str], str | None]] = [
    ("할매순대국", "한식", ["1만원 이하", "도보 5분"], "https://map.naver.com/p/search/할매순대국"),
    ("백반의민족", "한식", ["백반", "든든"], None),
    ("진미닭갈비", "한식", ["매운맛", "단체"], "https://map.naver.com/p/search/진미닭갈비"),
    ("고봉김치찌개", "한식", ["1만원 이하"], None),
    ("홍콩반점", "중식", ["짜장", "빠름"], "https://map.naver.com/p/search/홍콩반점"),
    ("마라공방", "중식", ["매운맛", "마라"], None),
    ("만리장성", "중식", ["단체", "코스"], "https://map.naver.com/p/search/만리장성"),
    ("스시로", "일식", ["회전초밥", "가성비"], "https://map.naver.com/p/search/스시로"),
    ("돈카츠하우스", "일식", ["돈카츠", "든든"], None),
    ("라멘이치방", "일식", ["라멘", "도보 5분"], "https://map.naver.com/p/search/라멘이치방"),
    ("트라토리아 모모", "양식", ["파스타", "분위기"], "https://map.naver.com/p/search/트라토리아모모"),
    ("버거킹덤", "양식", ["햄버거", "빠름"], None),
    ("피자몬스터", "양식", ["피자", "단체"], "https://map.naver.com/p/search/피자몬스터"),
    ("김밥천국", "분식", ["1만원 이하", "빠름"], None),
    ("엽기떡볶이", "분식", ["매운맛", "배달"], "https://map.naver.com/p/search/엽기떡볶이"),
    ("튀김우동", "분식", ["1만원 이하", "도보 5분"], None),
    ("포보", "아시안", ["쌀국수", "가성비"], "https://map.naver.com/p/search/포보"),
    ("방콕식당", "아시안", ["팟타이", "분위기"], None),
    ("브런치랩", "카페/브런치", ["브런치", "분위기"], "https://map.naver.com/p/search/브런치랩"),
    ("샐러디", "기타", ["샐러드", "가벼움", "빠름"], None),
]


def seed(db: Session, reset: bool = False) -> User:
    """데모 사용자와 식당을 만들고 돌려준다. 이미 있으면 reset일 때만 지우고 다시 만든다(다른 사용자 데이터는 건드리지 않는다)."""
    for name in DEFAULT_CATEGORIES:  # 카테고리가 없는 빈 DB에서도 쓸 수 있게 채워 둔다
        if db.scalar(select(Category).where(Category.name == name)) is None:
            db.add(Category(name=name))
    db.commit()

    existing = db.scalar(select(User).where(User.username == SEED_USERNAME))
    if existing and not reset:
        return existing
    if existing:
        db.execute(delete(SpinLog).where(SpinLog.user_id == existing.id))
        db.execute(delete(Restaurant).where(Restaurant.user_id == existing.id))
        db.delete(existing)
        db.commit()

    user = User(username=SEED_USERNAME, password_hash=hash_password(SEED_PASSWORD), nickname=SEED_NICKNAME)
    db.add(user)
    db.flush()
    by_name = {c.name: c for c in db.scalars(select(Category))}
    for name, category, tags, link in RESTAURANTS:
        db.add(Restaurant(user_id=user.id, name=name, category_id=by_name[category].id, tags=tags, link_url=link))
    db.commit()
    db.refresh(user)
    return user


def main() -> None:
    from app.database import SessionLocal

    if SessionLocal is None:
        raise SystemExit("backend/.env의 DATABASE_URL이 설정되어 있지 않습니다.")
    with SessionLocal() as db:
        user = seed(db, reset="--reset" in sys.argv)
        count = db.scalar(select(Restaurant.id).where(Restaurant.user_id == user.id).limit(1)) and len(RESTAURANTS)
        print(f"데모 사용자 준비 완료 — 아이디: {SEED_USERNAME} / 비밀번호: {SEED_PASSWORD} (식당 {count}개)")


if __name__ == "__main__":
    main()
