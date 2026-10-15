"""비밀번호 해시, 로그인 토큰, 현재 사용자 확인. 표준 라이브러리만 쓴다."""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

TOKEN_SECONDS = 30 * 24 * 3600  # 로그인 유지 기간 30일
_SCRYPT = dict(n=2**14, r=8, p=1, dklen=32)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except (ValueError, TypeError):
        return False


def _key() -> bytes:
    if not settings.secret_key:
        raise RuntimeError("SECRET_KEY가 설정되지 않았습니다(backend/.env).")
    return settings.secret_key.encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(user_id: int, now: float | None = None) -> str:
    payload = _b64(json.dumps({"uid": user_id, "exp": int((now or time.time()) + TOKEN_SECONDS)}).encode())
    sig = _b64(hmac.new(_key(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_token(token: str, now: float | None = None) -> int | None:
    """유효한 토큰이면 사용자 id, 아니면(변조·만료·형식 오류) None"""
    try:
        payload, sig = token.split(".")
        expected = _b64(hmac.new(_key(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(payload))
        if data["exp"] < (now or time.time()):
            return None
        return int(data["uid"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    scheme, _, token = (authorization or "").partition(" ")
    user_id = read_token(token.strip()) if scheme.lower() == "bearer" and token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(401, "로그인이 필요합니다.")
    return user
