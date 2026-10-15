import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Restaurant, SpinLog, User
from ..schemas import SpinFilter, SpinHistoryItem, SpinOut
from ..security import current_user
from .restaurants import to_out, visible

router = APIRouter(prefix="/api", tags=["spins"])


def candidates(db: Session, user: User, flt: SpinFilter) -> list[Restaurant]:
    """조건에 맞는 후보(기본 식당 + 내 식당). 카테고리끼리·태그끼리는 OR, 카테고리와 태그 사이는 AND다."""
    rows = list(db.scalars(select(Restaurant).where(visible(user))))
    if flt.categories:
        rows = [r for r in rows if r.category.name in flt.categories]
    if flt.tags:
        rows = [r for r in rows if set(r.tags or []) & set(flt.tags)]
    return rows


@router.post("/spins", response_model=SpinOut)
def spin(body: SpinFilter | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    flt = body or SpinFilter()
    pool = candidates(db, user, flt)
    if not pool:
        has_any = db.scalar(select(Restaurant.id).where(visible(user)).limit(1))
        raise HTTPException(404, "조건에 맞는 식당이 없습니다. 조건을 조금 풀어 보세요." if has_any else "등록된 식당이 없습니다. 식당을 먼저 등록해 주세요.")
    picked = random.choice(pool)  # 동등 확률, 가중치 없음
    db.add(SpinLog(user_id=user.id, restaurant_id=picked.id, filter_json=flt.model_dump()))
    db.commit()
    return SpinOut(restaurant=to_out(picked, user.id))


@router.get("/spins", response_model=list[SpinHistoryItem])
def spin_history(limit: int = Query(default=100, ge=1, le=500), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """내가 그동안 뽑은 결과(최신순)."""
    logs = db.scalars(select(SpinLog).where(SpinLog.user_id == user.id).order_by(SpinLog.id.desc()).limit(limit)).all()
    out = []
    for log in logs:
        restaurant = db.get(Restaurant, log.restaurant_id) if log.restaurant_id else None
        out.append(
            SpinHistoryItem(
                id=log.id,
                created_at=log.created_at,
                restaurant=to_out(restaurant, user.id) if restaurant else None,
                filter=SpinFilter(**(log.filter_json or {})),
            )
        )
    return out
