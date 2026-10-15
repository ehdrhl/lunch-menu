from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Restaurant, User
from ..schemas import CategoryOut, RestaurantIn, RestaurantOut
from ..security import current_user

router = APIRouter(prefix="/api", tags=["restaurants"])


def to_out(r: Restaurant, user_id: int | None = None, warning: str | None = None) -> RestaurantOut:
    return RestaurantOut(
        id=r.id,
        name=r.name,
        category_id=r.category_id,
        category_name=r.category.name,
        tags=r.tags or [],
        link_url=r.link_url,
        memo=r.memo,
        created_at=r.created_at,
        mine=r.user_id is not None and r.user_id == user_id,
        warning=warning,
    )


def visible(user: User):
    """내가 볼 수 있는 식당: 기본 식당(user_id NULL)과 내 식당"""
    return or_(Restaurant.user_id.is_(None), Restaurant.user_id == user.id)


def _check_category(db: Session, category_id: int) -> None:
    if not db.get(Category, category_id):
        raise HTTPException(400, "카테고리가 올바르지 않습니다.")


def _duplicate_warning(db: Session, user: User, name: str, exclude_id: int | None = None) -> str | None:
    q = select(func.count(Restaurant.id)).where(visible(user), Restaurant.name == name)
    if exclude_id is not None:
        q = q.where(Restaurant.id != exclude_id)
    return "같은 이름의 식당이 이미 있습니다." if (db.scalar(q) or 0) > 0 else None


def _own_or_error(db: Session, user: User, restaurant_id: int) -> Restaurant:
    """내 식당이면 돌려주고, 기본 식당은 403, 남의 식당·없는 식당은 404"""
    r = db.get(Restaurant, restaurant_id)
    if not r or (r.user_id is not None and r.user_id != user.id):
        raise HTTPException(404, "존재하지 않는 식당입니다.")
    if r.user_id is None:
        raise HTTPException(403, "기본 식당은 고치거나 지울 수 없습니다.")
    return r


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.get("/restaurants", response_model=list[RestaurantOut])
def list_restaurants(
    q: str | None = None,
    category: list[int] | None = Query(default=None),  # 여러 개: ?category=1&category=2
    tag: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Restaurant).where(visible(user)).order_by(Restaurant.id.desc())
    if category:
        stmt = stmt.where(Restaurant.category_id.in_(category))
    rows = db.scalars(stmt).all()
    if q and q.strip():
        # 이름 또는 태그에 검색어가 들어 있으면 맞는다. '#라면'처럼 #을 붙여도 태그로 찾는다.
        word = q.strip().lower()
        tag_word = word.lstrip("#").strip()
        rows = [
            r for r in rows
            if word in r.name.lower() or (tag_word and any(tag_word in t.lower() for t in (r.tags or [])))
        ]
    if tag:
        rows = [r for r in rows if tag in (r.tags or [])]
    return [to_out(r, user.id) for r in rows]


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantOut)
def get_restaurant(restaurant_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(Restaurant, restaurant_id)
    if not r or (r.user_id is not None and r.user_id != user.id):
        raise HTTPException(404, "존재하지 않는 식당입니다.")
    return to_out(r, user.id)


@router.post("/restaurants", response_model=RestaurantOut, status_code=201)
def create_restaurant(body: RestaurantIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _check_category(db, body.category_id)
    warning = _duplicate_warning(db, user, body.name)
    r = Restaurant(user_id=user.id, **body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return to_out(r, user.id, warning)


@router.put("/restaurants/{restaurant_id}", response_model=RestaurantOut)
def update_restaurant(restaurant_id: int, body: RestaurantIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _own_or_error(db, user, restaurant_id)
    _check_category(db, body.category_id)
    warning = _duplicate_warning(db, user, body.name, exclude_id=r.id)
    for key, value in body.model_dump().items():
        setattr(r, key, value)
    db.commit()
    db.refresh(r)
    return to_out(r, user.id, warning)


@router.delete("/restaurants/{restaurant_id}", status_code=204)
def delete_restaurant(restaurant_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_or_error(db, user, restaurant_id))
    db.commit()
    return Response(status_code=204)
