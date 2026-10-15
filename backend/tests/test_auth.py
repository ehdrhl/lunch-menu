import time

from app.ratelimit import FailedLoginLimiter
from app.security import hash_password, make_token, read_token, verify_password
from conftest import signup


def test_signup_logs_in_and_me(client):
    r = client.post("/api/auth/signup", json={"username": "Yujin_01", "password": "password1", "nickname": " 유진 "})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["username"] == "yujin_01"  # 아이디는 소문자로 저장한다
    assert body["user"]["nickname"] == "유진"
    assert "password" not in str(body)
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200 and me.json()["username"] == "yujin_01"


def test_signup_validation_and_duplicate(client):
    ok = {"username": "tester1", "password": "password1", "nickname": "a"}
    for bad in (
        {"username": "abc"},  # 4자 미만
        {"username": "has space"},
        {"username": "한글아이디"},
        {"username": "x" * 21},
        {"password": "short"},  # 8자 미만
        {"password": "p" * 65},
        {"nickname": "  "},
        {"nickname": "n" * 21},
    ):
        assert client.post("/api/auth/signup", json={**ok, **bad}).status_code == 422, bad
    assert client.post("/api/auth/signup", json=ok).status_code == 201
    dup = client.post("/api/auth/signup", json={**ok, "username": "TESTER1"})  # 대소문자만 달라도 같은 아이디
    assert dup.status_code == 409
    assert "이미 사용 중" in dup.json()["detail"]


def test_login(client):
    signup(client)
    r = client.post("/api/auth/login", json={"username": "Tester1", "password": "password1"})
    assert r.status_code == 200 and r.json()["user"]["nickname"] == "테스터"
    wrong = client.post("/api/auth/login", json={"username": "tester1", "password": "nope-nope"})
    unknown = client.post("/api/auth/login", json={"username": "nobody1", "password": "password1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()  # 어느 쪽이 틀렸는지 알려 주지 않는다


def test_protected_routes_need_a_valid_token(client):
    for method, url in (("get", "/api/auth/me"), ("get", "/api/restaurants"), ("get", "/api/categories"), ("post", "/api/spins"), ("get", "/api/spins")):
        assert getattr(client, method)(url).status_code == 401, url
    for header in ("Bearer", "Bearer nope", "Basic abc", "Bearer a.b"):
        assert client.get("/api/auth/me", headers={"Authorization": header}).status_code == 401, header


def test_token_tampering_and_expiry():
    token = make_token(7)
    assert read_token(token) == 7
    payload, sig = token.split(".")
    assert read_token(f"{payload}.{sig[:-2]}xx") is None  # 서명 변조
    assert read_token(f"{make_token(8).split('.')[0]}.{sig}") is None  # 다른 사용자 payload에 옛 서명
    assert read_token(token, now=time.time() + 31 * 24 * 3600) is None  # 30일 지나면 만료
    assert read_token(token, now=time.time() + 29 * 24 * 3600) == 7
    assert read_token("garbage") is None


def test_password_hash_is_salted_and_verifies():
    a, b = hash_password("password1"), hash_password("password1")
    assert a != b and "password1" not in a
    assert verify_password("password1", a) and not verify_password("password2", a)
    assert not verify_password("password1", "not-a-hash")


def test_login_rate_limit(client):
    signup(client)
    for _ in range(20):
        assert client.post("/api/auth/login", json={"username": "tester1", "password": "wrong-pass"}).status_code == 401
    blocked = client.post("/api/auth/login", json={"username": "tester1", "password": "password1"})
    assert blocked.status_code == 429  # 맞는 비밀번호여도 잠시 막는다
    assert int(blocked.headers["Retry-After"]) >= 1


def test_limiter_window_and_clear():
    now = [0.0]
    lim = FailedLoginLimiter(limit=3, window=60, clock=lambda: now[0])
    for _ in range(3):
        lim.record("1.1.1.1")
    assert lim.blocked("1.1.1.1") and not lim.blocked("2.2.2.2")
    assert 1 <= lim.retry_after("1.1.1.1") <= 61
    now[0] = 61
    assert not lim.blocked("1.1.1.1")  # 창이 지나면 풀린다
    lim.record("1.1.1.1")
    lim.clear("1.1.1.1")
    assert not lim.blocked("1.1.1.1") and lim.retry_after("1.1.1.1") == 0
