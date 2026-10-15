# 오늘 뭐 먹지?

회원가입·로그인(아이디+비밀번호+닉네임)한 개인용 점심 메뉴 웹앱. 모든 가입자에게 보이는 기본 식당(수정·삭제 불가)과 내 식당으로 룰렛을 돌려 식당을 정한다. 팀·대표·잠금 개념은 없다. 기준 문서는 PRD.md(요구사항)와 PLAN.md(진행 순서)다. 대화를 새로 시작하면 두 문서를 먼저 읽는다.

## 스택
- 프런트: React + Vite + TypeScript, React Router, 플레인 CSS (`frontend/`)
- 백엔드: FastAPI (Python 3.14 venv), SQLAlchemy 2, Alembic, Pydantic, PyMySQL (`backend/`)
- DB: MariaDB 11.x (utf8mb4)

## 규칙
- 3티어: 프런트는 백엔드 API(`/api`)만 호출한다. DB 접속 정보는 `backend/.env`에만 둔다.
- 추천 결과는 서버에서만 정한다. 프런트는 연출만 한다.
- API 경로는 PRD 6장을 따른다. 요구사항이 바뀌면 코드보다 PRD를 먼저 고친다.
- 한 요청에 한 기능만 구현한다. 스키마 변경은 Alembic으로만 한다.
- 이 PC의 8000 포트는 다른 프로젝트(flow-task)가 쓰므로 백엔드는 **8001**을 쓴다.

## 실행
- 백엔드: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8001`
- 시드 데이터: `cd backend && .venv/bin/python seed.py [--reset]` (데모 사용자 demo/demo1234, 실제 DB에 만들어지므로 개발 DB에서만)
- 로그인 속도 제한은 프로세스 메모리에 있으므로 운영 백엔드 워커는 1개. 배포 절차는 README.md
- 테스트: `cd backend && .venv/bin/python -m pytest` / `cd frontend && npm test`
- 프런트: `cd frontend && npm run dev` (Vite 프록시가 `/api`를 8001로 전달)
