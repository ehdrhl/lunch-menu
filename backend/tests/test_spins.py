from collections import Counter

from test_restaurants import add, make_default
from conftest import categories, signup


def setup(client):
    h = signup(client)
    return h, categories(client, h)


def spin(client, h, **body):
    return client.post("/api/spins", headers=h, json=body)


def test_spin_picks_only_from_matching_candidates(client):
    h, cats = setup(client)
    add(client, h, cats, name="비빔밥", cat="한식", tags=["싸다"])
    add(client, h, cats, name="스시로", cat="일식", tags=["비쌈"])
    add(client, h, cats, name="김밥", cat="분식", tags=["싸다"])
    seen = {spin(client, h, categories=["한식", "분식"]).json()["restaurant"]["name"] for _ in range(60)}
    assert seen == {"비빔밥", "김밥"}  # 카테고리끼리는 OR
    seen = {spin(client, h, categories=["분식", "일식"], tags=["싸다"]).json()["restaurant"]["name"] for _ in range(40)}
    assert seen == {"김밥"}  # 카테고리와 태그 사이는 AND
    assert spin(client, h).json()["restaurant"]["category_name"]  # 조건이 없으면 전체


def test_spin_uses_defaults_and_own_but_never_others(client):
    h, cats = setup(client)
    make_default(client, "공용집", cats["한식"])
    add(client, h, cats, name="내집", cat="한식")
    other = signup(client, username="other001")
    add(client, other, cats, name="남의집", cat="한식")
    seen = {spin(client, h).json()["restaurant"]["name"] for _ in range(80)}
    assert seen == {"공용집", "내집"}


def test_spin_without_candidates(client):
    h, cats = setup(client)
    r = spin(client, h)
    assert r.status_code == 404 and "등록된 식당이 없습니다" in r.json()["detail"]
    add(client, h, cats, name="비빔밥", cat="한식")
    r = spin(client, h, categories=["일식"])
    assert r.status_code == 404 and "조건에 맞는 식당이 없습니다" in r.json()["detail"]


def test_spin_is_roughly_uniform(client):
    h, cats = setup(client)
    for n in ("가", "나", "다"):
        add(client, h, cats, name=n)
    counts = Counter(spin(client, h).json()["restaurant"]["name"] for _ in range(150))
    assert set(counts) == {"가", "나", "다"} and min(counts.values()) > 20


def test_history_is_per_user_newest_first(client):
    h, cats = setup(client)
    a = add(client, h, cats, name="비빔밥", cat="한식")
    assert spin(client, h, categories=["한식"]).status_code == 200
    add(client, h, cats, name="스시로", cat="일식")
    spin(client, h, categories=["일식"])
    other = signup(client, username="other001")
    add(client, other, cats, name="남의집")
    spin(client, other)
    hist = client.get("/api/spins", headers=h).json()
    assert [x["restaurant"]["name"] for x in hist] == ["스시로", "비빔밥"]
    assert hist[0]["filter"] == {"categories": ["일식"], "tags": []}
    assert len(client.get("/api/spins", headers=other).json()) == 1  # 남의 기록은 섞이지 않는다
    assert len(client.get("/api/spins", headers=h, params={"limit": 1}).json()) == 1
    # 식당이 삭제되면 기록은 남고 식당만 null
    client.delete(f"/api/restaurants/{a['id']}", headers=h)
    assert [x["restaurant"] and x["restaurant"]["name"] for x in client.get("/api/spins", headers=h).json()] == ["스시로", None]
