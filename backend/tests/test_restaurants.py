import pytest

from app.models import Restaurant
from conftest import categories, signup


def add(client, headers, cats, name="맛집", cat="한식", **extra):
    r = client.post("/api/restaurants", headers=headers, json={"name": name, "category_id": cats[cat], **extra})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def me(client):
    h = signup(client)
    return h, categories(client, h)


def make_default(client, name, category_id, tags=None):
    """기본 식당(user_id NULL)은 마이그레이션이 만든다. 테스트에서는 DB에 직접 넣는다."""
    from app.database import get_db
    from app.main import app

    db = next(app.dependency_overrides[get_db]())
    r = Restaurant(user_id=None, name=name, category_id=category_id, tags=tags or [])
    db.add(r)
    db.commit()
    rid = r.id
    db.close()
    return rid


def test_categories_are_the_fixed_eight(client, me):
    h, cats = me
    assert list(cats) == ["한식", "중식", "일식", "양식", "분식", "아시안", "카페/브런치", "기타"]


def test_create(client, me):
    h, cats = me
    r = add(client, h, cats, name="김밥천국", cat="분식", tags=["싸다", " 가깝다 ", "싸다", ""], link_url="https://map.naver.com/x", memo="점심 추천")
    assert r["category_name"] == "분식" and r["tags"] == ["싸다", "가깝다"] and r["mine"] is True
    assert "rating" not in r  # 별점은 앱에서 관리하지 않는다


def test_validation(client, me):
    h, cats = me
    base = {"name": "a", "category_id": cats["한식"]}
    for bad in (
        {"name": "  "},
        {"name": "x" * 101},
        {"category_id": 99999},
        {"tags": ["1", "2", "3", "4", "5", "6"]},
        {"tags": ["x" * 21]},
        {"link_url": "ftp://x"},
        {"link_url": "naver.com"},
        {"memo": "m" * 301},
    ):
        code = client.post("/api/restaurants", headers=h, json={**base, **bad}).status_code
        assert code in (400, 422), bad


def test_duplicate_name_warns_including_defaults(client, me):
    h, cats = me
    make_default(client, "공용집", cats["한식"])
    assert add(client, h, cats, name="내집")["warning"] is None
    assert add(client, h, cats, name="내집")["warning"]
    assert add(client, h, cats, name="공용집")["warning"]  # 기본 식당과 같은 이름도 경고


def test_each_user_sees_defaults_and_only_own(client, me):
    h, cats = me
    make_default(client, "공용집", cats["한식"])
    add(client, h, cats, name="내집")
    other = signup(client, username="other001", nickname="다른사람")
    add(client, other, cats, name="남의집")
    mine = {r["name"]: r["mine"] for r in client.get("/api/restaurants", headers=h).json()}
    assert mine == {"내집": True, "공용집": False}  # 남의집은 보이지 않는다
    theirs = {r["name"]: r["mine"] for r in client.get("/api/restaurants", headers=other).json()}
    assert theirs == {"남의집": True, "공용집": False}


def test_update_and_delete_own(client, me):
    h, cats = me
    r = add(client, h, cats, name="옛이름", cat="한식")
    body = {"name": "새이름", "category_id": cats["일식"], "tags": ["a"], "link_url": None, "memo": None}
    u = client.put(f"/api/restaurants/{r['id']}", headers=h, json=body).json()
    assert (u["name"], u["category_name"], u["tags"]) == ("새이름", "일식", ["a"])
    assert client.delete(f"/api/restaurants/{r['id']}", headers=h).status_code == 204
    assert client.get("/api/restaurants", headers=h).json() == []
    assert client.delete(f"/api/restaurants/{r['id']}", headers=h).status_code == 404


def test_defaults_are_read_only_and_others_are_hidden(client, me):
    h, cats = me
    default_id = make_default(client, "공용집", cats["한식"])
    body = {"name": "바꿈", "category_id": cats["한식"]}
    assert client.put(f"/api/restaurants/{default_id}", headers=h, json=body).status_code == 403
    assert client.delete(f"/api/restaurants/{default_id}", headers=h).status_code == 403
    other = signup(client, username="other001")
    theirs = add(client, other, cats, name="남의집")
    assert client.put(f"/api/restaurants/{theirs['id']}", headers=h, json=body).status_code == 404  # 있는지도 알려 주지 않는다
    assert client.delete(f"/api/restaurants/{theirs['id']}", headers=h).status_code == 404
    assert [r["name"] for r in client.get("/api/restaurants", headers=other).json()] == ["남의집", "공용집"]


def test_list_search_and_filters(client, me):
    h, cats = me
    add(client, h, cats, name="김밥천국", cat="분식", tags=["싸다"])
    add(client, h, cats, name="스시로", cat="일식", tags=["비쌈", "싸다"])
    add(client, h, cats, name="100%칼국수", cat="한식")
    names = lambda **p: [r["name"] for r in client.get("/api/restaurants", headers=h, params=p).json()]
    assert names() == ["100%칼국수", "스시로", "김밥천국"]  # 최신순
    assert names(q="김밥") == ["김밥천국"]
    assert names(q="%") == ["100%칼국수"]  # %는 와일드카드가 아님
    assert names(q="_") == []
    assert names(q="비쌈") == ["스시로"]  # 태그로도 검색된다
    assert names(q="#싸다") == ["스시로", "김밥천국"]  # #을 붙여도 된다
    assert names(q="#") == []  # 태그어가 비면 이름만 본다
    assert names(category=cats["일식"]) == ["스시로"]
    assert names(category=[cats["일식"], cats["분식"]]) == ["스시로", "김밥천국"]  # 카테고리는 여러 개
    assert names(category=[cats["일식"], cats["분식"], cats["한식"]]) == ["100%칼국수", "스시로", "김밥천국"]
    assert names(tag="비쌈") == ["스시로"]
    assert names(category=cats["분식"], tag="비쌈") == []


def test_get_one_defaults_and_own_but_not_others(client, me):
    h, cats = me
    default_id = make_default(client, "공용집", cats["한식"], ["싸다"])
    mine = add(client, h, cats, name="내집", memo="메모")
    got = client.get(f"/api/restaurants/{mine['id']}", headers=h).json()
    assert (got["name"], got["mine"], got["memo"]) == ("내집", True, "메모")
    shared = client.get(f"/api/restaurants/{default_id}", headers=h).json()
    assert (shared["name"], shared["mine"], shared["tags"]) == ("공용집", False, ["싸다"])
    other = signup(client, username="other001")
    assert client.get(f"/api/restaurants/{mine['id']}", headers=other).status_code == 404  # 남의 식당
    assert client.get("/api/restaurants/99999", headers=h).status_code == 404
    assert client.get(f"/api/restaurants/{mine['id']}").status_code == 401
