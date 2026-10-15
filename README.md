# 오늘 뭐 먹지? 🍽️

회원가입·로그인한 개인이 자기 맛집 목록을 만들고, 룰렛을 돌려 점심 식당을 뽑는 웹앱입니다. 가입하면 모두에게 똑같이 보이는 **기본 식당**으로 바로 시작할 수 있고, 내 식당을 더 등록할 수 있습니다.

- 요구사항: [PRD.md](PRD.md) · 진행 계획: [PLAN.md](PLAN.md) · 작업 규칙: [CLAUDE.md](CLAUDE.md)

## 주요 기능

| 영역 | 내용 |
| --- | --- |
| 계정 | 아이디·비밀번호·닉네임으로 회원가입, 로그인(30일 유지), 로그아웃. 로그인해야 쓸 수 있음 |
| 식당 | 기본 식당(공용, 수정·삭제 불가) + 내 식당 등록·수정·삭제, 이름·태그 검색, 카테고리(다중 선택) 필터, 지도/네이버 링크 |
| 뽑기 | 조건(카테고리·태그) 검색해 담기 → 룰렛 → 결과 연출 → 결과 카드, 이번 접속의 최근 8건, 효과음 토글 |
| 기록 | 내가 뽑은 결과 목록(최신순), 가장 많이 뽑힌 식당 TOP 3 |

## 기술 스택

| 계층 | 기술 |
| --- | --- |
| 프런트 | React 19 + Vite + TypeScript, React Router, 플레인 CSS |
| 백엔드 | FastAPI (Python 3.11+), SQLAlchemy 2, Alembic, Pydantic, Uvicorn |
| 데이터 | MariaDB 10.x 이상 (utf8mb4) |

```
lunch-menu/
├── backend/            FastAPI 앱 (app/), 마이그레이션(alembic/), 테스트(tests/), 시드(seed.py)
├── frontend/           React 앱 (src/)
├── deploy/             Nginx·systemd 설정 예시
├── PRD.md PLAN.md      요구사항·계획
└── README.md
```

## 로컬에서 실행하기

필요한 것: Python 3.11 이상, Node.js 20 이상(npm), MariaDB 10.x 이상.

### 1) 데이터베이스 만들기

MariaDB에 접속해 DB와 전용 사용자를 만듭니다(비밀번호는 직접 정하세요).

```sql
CREATE DATABASE lunch_picker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lunch_user'@'127.0.0.1' IDENTIFIED BY '비밀번호';
CREATE USER 'lunch_user'@'localhost' IDENTIFIED BY '비밀번호';
GRANT ALL ON lunch_picker.* TO 'lunch_user'@'127.0.0.1';
GRANT ALL ON lunch_picker.* TO 'lunch_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2) 백엔드

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # DATABASE_URL 의 비밀번호를 위에서 정한 값으로, SECRET_KEY 를 긴 무작위 값으로 고친다 (chmod 600 .env 권장)
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8001
```

- API 문서(Swagger): http://localhost:8001/docs, 상태 확인: http://localhost:8001/api/health
- 비밀번호에 `@ : / # %` 같은 특수문자가 있으면 URL이 깨지므로 영문·숫자를 권장합니다.
- 포트가 8001인 이유: 개발 PC에서 8000번을 다른 프로젝트가 쓰는 경우가 있어서입니다. 바꾸려면 `frontend/vite.config.ts`의 프록시 주소도 함께 바꾸세요.

### 3) 프런트엔드

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173  (/api 는 8001 로 프록시)
```

### 4) 시연용 데이터 (선택)

데모 사용자 1명(아이디 `demo`, 비밀번호 `demo1234`)과 그 사용자의 식당 20개를 만듭니다.

```bash
cd backend
.venv/bin/python seed.py            # 이미 있으면 그대로 둔다
.venv/bin/python seed.py --reset    # 데모 사용자만 지우고 다시 만든다 (다른 사용자는 건드리지 않는다)
```

## 환경변수 (`backend/.env`)

| 이름 | 설명 | 기본값 |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy 접속 문자열 (`mysql+pymysql://사용자:비밀번호@호스트:3306/DB?charset=utf8mb4`) | (필수) |
| `CORS_ORIGINS` | 허용할 프런트 주소, 쉼표로 구분. 운영에서는 서비스 도메인만 | `http://localhost:5173` |
| `SECRET_KEY` | 로그인 토큰 서명 키. 긴 무작위 값(`python -c "import secrets;print(secrets.token_urlsafe(48))"`). 바꾸면 모두 로그아웃되고, 새어 나가면 남이 토큰을 만들 수 있으니 비밀로 둡니다 | (필수) |
| `TRUST_PROXY` | Nginx 같은 신뢰하는 프록시 뒤에서만 `true`. 접속자 IP를 `X-Forwarded-For`의 첫 값으로 본다(로그인 시도 속도 제한용) | `false` |

DB 접속 정보와 `SECRET_KEY`는 `backend/.env`에만 둡니다. `.env`는 git에 올라가지 않습니다(`.gitignore`).

## 마이그레이션 (Alembic)

스키마는 SQLAlchemy 모델(`backend/app/models.py`)로 정의하고 Alembic으로만 바꿉니다. 테이블을 손으로 고치지 마세요.

```bash
cd backend
.venv/bin/alembic upgrade head                                   # 최신으로 올리기
.venv/bin/alembic revision --autogenerate -m "변경 설명"           # 모델 변경으로 새 마이그레이션 만들기 (생성된 파일을 꼭 읽어 볼 것)
.venv/bin/alembic downgrade -1                                   # 한 단계 되돌리기
.venv/bin/alembic current                                        # 현재 버전 보기
```

## 테스트

```bash
cd backend  && .venv/bin/python -m pytest        # 백엔드 (임시 SQLite 사용, 실제 DB를 건드리지 않음)
cd frontend && npm test                          # 프런트 (Vitest + jsdom)
cd frontend && npm run build                     # 타입 검사 + 빌드
```

## 배포 (AWS EC2 3대, 3티어)

운영 구성은 프런트엔드·백엔드·DB 전용 EC2 각 1대입니다. 인스턴스에는 Windows CMD에서 AWS Systems Manager Session Manager(SSM)로 접속합니다. 각 인스턴스의 IAM 인스턴스 프로파일과 SSM Agent가 정상 연결된 상태여야 합니다. 리전, OS, IP, 도메인은 실제 환경의 값으로 바꾸세요.

```text
브라우저 --HTTPS--> 프런트엔드 EC2 (Nginx + React 정적 파일)
                         --사설망 /api--> 백엔드 EC2 (FastAPI/Uvicorn)
                                                  --사설망 3306--> DB EC2 (MariaDB)
```

1. **보안 그룹**: 웹 트래픽은 프런트엔드에만 허용합니다. 백엔드 TCP 8001 인바운드는 프런트엔드 보안 그룹에서만 허용하고, DB TCP 3306 인바운드는 백엔드 보안 그룹에서만 허용합니다. DB와 백엔드를 인터넷에 직접 공개하지 마세요.
2. **DB EC2**: MariaDB와 `lunch_picker` DB를 생성합니다. 전용 DB 사용자는 백엔드에서만 연결할 수 있게 설정하고, 데이터 백업·복구 방법을 마련합니다.
3. **백엔드 EC2**: Python venv와 의존성을 설치하고 코드를 배포합니다. `backend/.env`의 `DATABASE_URL` 호스트에 DB EC2의 사설 주소를 지정하고 운영용 `SECRET_KEY`를 설정합니다. 파일 권한을 `chmod 600`으로 제한한 뒤 DB 연결을 확인하고 `.venv/bin/alembic upgrade head`를 실행합니다.
4. **백엔드 서비스**: [deploy/lunch-picker.service](deploy/lunch-picker.service)를 백엔드 EC2에 맞게 설정해 systemd로 실행합니다. Uvicorn은 백엔드 사설 네트워크에서만 수신하고, 워커는 1개로 둡니다(로그인 시도 제한이 프로세스 메모리에 있음).
5. **프런트엔드 EC2**: `cd frontend && npm ci && npm run build`로 빌드한 뒤 결과물을 Nginx 정적 루트에 배포합니다. [deploy/nginx.conf](deploy/nginx.conf)의 `/api` upstream을 `127.0.0.1`이 아닌 백엔드 EC2 사설 주소로 바꾸고, SPA fallback을 적용합니다.
6. **도메인과 HTTPS**: 서비스 도메인을 프런트엔드 진입 주소에 연결하고 HTTPS 인증서와 갱신을 설정합니다. Nginx에서 HTTP를 HTTPS로 리다이렉트하고 API 프록시의 클라이언트 IP 헤더를 덮어써 전달합니다. 백엔드는 프록시 헤더를 신뢰하도록 설정합니다.
7. **검증**: 브라우저에서 `https://도메인/api/health`가 `{"status":"ok","db":"ok"}`를 반환하는지 확인하고, 회원가입·로그인·식당 관리·룰렛·기록을 점검합니다. 각 EC2와 서비스를 재시작해 자동 기동 및 데이터 유지도 확인합니다.

현재 [deploy/nginx.conf](deploy/nginx.conf)와 [deploy/lunch-picker.service](deploy/lunch-picker.service)는 배포 예시입니다. 실제 3 EC2 환경에 적용하기 전에 Nginx upstream과 Uvicorn 수신 주소를 사설 네트워크 구조에 맞게 변경해야 합니다. DB 접속 정보와 `SECRET_KEY`를 Git, 프런트엔드, 공개 채팅에 넣지 마세요.

## 보안·운영 메모

- 비밀번호는 솔트가 있는 scrypt 해시로만 저장하고, 로그인 토큰은 `SECRET_KEY`로 서명합니다(30일). 브라우저 localStorage에 저장하므로 외부 스크립트를 페이지에 넣지 마세요.
- 틀린 로그인이 IP당 1분에 20번을 넘으면 429로 잠시 막습니다.
- 이메일을 받지 않아 **비밀번호를 잊으면 되찾을 수 없습니다**(비밀번호 재설정은 비목표). 필요하면 DB에서 해당 사용자를 지우고 다시 가입시킵니다.
- 기본 식당(`restaurants.user_id`가 NULL)은 모두에게 보이고 앱에서는 고치거나 지울 수 없습니다. 바꾸려면 DB에서 직접 고칩니다.
- 이전 팀 공유 구조에서 옮길 때(`a1c0de5e7a01` 마이그레이션)는 팀·팀원·기존 뽑기 기록이 지워지고 팀 코드 `9CM35L`의 식당만 기본 식당으로 남습니다. 실행 전에 DB를 백업하세요(`mysqldump`).
