from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..ratelimit import limiter
from ..schemas import AuthOut, LoginIn, SignupIn, UserOut
from ..security import current_user, hash_password, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 없는 아이디여도 비밀번호 검증 시간이 비슷하도록 쓰는 가짜 해시(아이디 존재 여부를 시간으로 알아내지 못하게)
_DUMMY_HASH = hash_password("dummy-password")


def client_ip(request: Request) -> str:
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


def _auth_out(user: User) -> AuthOut:
    return AuthOut(token=make_token(user.id), user=UserOut.model_validate(user))


@router.post("/signup", response_model=AuthOut, status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    user = User(username=body.username, password_hash=hash_password(body.password), nickname=body.nickname)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "이미 사용 중인 아이디입니다.")
    db.refresh(user)
    return _auth_out(user)


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    if limiter.blocked(ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "로그인을 너무 많이 틀렸어요. 잠시 후 다시 시도해 주세요."},
            headers={"Retry-After": str(limiter.retry_after(ip))},
        )
    user = db.scalar(select(User).where(User.username == body.username))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        limiter.record(ip)
        raise HTTPException(401, "아이디 또는 비밀번호가 맞지 않아요.")
    limiter.clear(ip)
    return _auth_out(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
