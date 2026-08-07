# 한살매 단어앱 — Supabase 완전 이전판

기존 Google Sheets + Apps Script 백엔드를 Supabase PostgreSQL/Auth/Edge Functions로 교체한 프로젝트입니다. 학생·교사 화면은 기존 디자인과 PWA 동작을 유지하며, 기존 `google.script.run` 호출 규격과 호환되는 API를 제공합니다.

## 포함된 기능

- 학생 회원가입, 로그인, 세션 확인, 로그아웃
- 중등·고등·수능 단어 DB와 Day별 조회
- 자유 시험, 시험 진행상태 저장·복구, 결과 저장
- 오답노트, 암기 처리, 스마트 복습
- 여러 개의 개인 단어장과 단어 이동·일괄 처리
- 교사용 시험 생성·학생 배정·상태 확인·재시험·알림
- 학생 시험 응시·제출·중간저장
- 경험치, 출석 보너스, 레벨, 엠블럼, 월간 랭킹
- 학생별 데이터 접근 차단(RLS)
- 기존 Excel 단어·학생 계정 이관
- GitHub Pages 및 Supabase 자동 배포

## 폴더 구조

```text
public/                         학생·교사 PWA
supabase/migrations/           DB 테이블, 인덱스, RLS 정책
supabase/functions/api/        Apps Script 호환 Edge Function
tools/import_excel.py          Excel 데이터 이관
tools/create_teacher.py        최초 교사 계정 생성
.github/workflows/             자동 배포
```

## 가장 쉬운 설치 순서

### 1. Supabase 프로젝트 만들기

1. <https://supabase.com/dashboard>에서 `New project`를 누릅니다.
2. 프로젝트 이름과 DB 비밀번호를 정하고 프로젝트가 만들어질 때까지 기다립니다.
3. 프로젝트 화면 위쪽의 `Connect` 또는 `Project Settings → API`에서 다음 값을 확인합니다.
   - Project URL
   - anon/public key
   - service_role key — 외부 공개 금지

### 2. PC에 필요한 도구 설치

- Node.js 20 이상
- Python 3.11 이상
- Docker Desktop(로컬 Supabase를 실행할 경우)

```bash
npm install -g supabase
python -m pip install -r tools/requirements.txt
cp .env.example .env
```

`.env`에 본인 Supabase 값을 입력합니다. `.env`는 GitHub에 올리지 마세요.

### 3. DB와 API 배포

프로젝트 폴더에서 다음 명령을 순서대로 실행합니다.

```bash
supabase login
supabase link --project-ref 본인_PROJECT_REF
supabase db push
supabase secrets set ADMIN_CODE=원하는4자리관리자코드 SIGNUP_CODE=학생가입코드
supabase functions deploy api --no-verify-jwt
```

Edge Function URL은 아래 형식입니다.

```text
https://본인_PROJECT_REF.supabase.co/functions/v1/api
```

### 4. 프런트엔드 연결

`public/config.js`에서 `YOUR_PROJECT_REF`를 실제 Project Ref로 바꿉니다.

```js
window.HANSALMAE_CONFIG = {
  apiUrl: "https://실제_PROJECT_REF.supabase.co/functions/v1/api"
};
```

브라우저에 공개되는 것은 API 주소뿐입니다. `service_role` 키를 이 파일에 넣으면 안 됩니다.

### 5. 기존 Excel 데이터 이관

먼저 결과만 확인합니다.

```bash
export SUPABASE_URL="https://본인_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="본인의_service_role_key"
python tools/import_excel.py "기존파일.xlsx" --dry-run
```

문제가 없으면 `--dry-run`을 제거합니다.

```bash
python tools/import_excel.py "기존파일.xlsx"
```

이 도구는 다음을 이관합니다.

- `중등단어DB`, `고등단어DB`, `수능단어DB`
- `학생계정`과 기존 비밀번호
- 학생별 기본 단어장과 경험치 초기 행

운영 전에는 학생 비밀번호 재설정을 권장합니다. 기존 파일에 평문 비밀번호가 있기 때문입니다.

### 6. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소의 `main` 브랜치에 올립니다.
2. 저장소 `Settings → Pages`에서 Source를 `GitHub Actions`로 선택합니다.
3. `Actions` 탭의 `Deploy GitHub Pages`를 실행합니다.

`public/` 폴더가 학생 앱으로 배포됩니다. 교사용 화면 주소는 `/teacher.html`입니다.

## GitHub에서 Supabase도 자동 배포하기

저장소 `Settings → Secrets and variables → Actions`에 다음 Secrets를 추가합니다.

| Secret | 내용 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase 개인 Access Token |
| `SUPABASE_PROJECT_REF` | 프로젝트 Ref |
| `SUPABASE_DB_PASSWORD` | 프로젝트 DB 비밀번호 |
| `ADMIN_CODE` | 관리자 로그인 코드 |
| `SIGNUP_CODE` | 학생 회원가입 코드 |

그 후 `Deploy Supabase` Action을 실행하면 DB migration과 Edge Function이 배포됩니다.

## 최초 교사 프로필

현재 교사용 웹 화면은 기존 앱과 동일하게 관리자 코드로 입장합니다. DB의 `created_by` 기록을 위해 최초 1회 교사 프로필이 필요합니다.

```bash
export SUPABASE_URL="https://본인_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="본인의_service_role_key"
python tools/create_teacher.py
```

입력한 이메일과 비밀번호는 향후 교사별 계정 로그인으로 확장할 때 사용할 수 있습니다.

## 보안 체크리스트

- `SUPABASE_SERVICE_ROLE_KEY`를 브라우저 코드나 GitHub 파일에 넣지 않습니다.
- `.env`를 커밋하지 않습니다.
- 공개 스키마 테이블의 RLS를 끄지 않습니다.
- 운영 전 학생들에게 비밀번호 변경을 안내합니다.
- 관리자 코드는 정기적으로 변경합니다.
- GitHub 저장소를 공개할 경우 Excel 원본과 학생 데이터를 올리지 않습니다.

## 로컬 검증

```bash
supabase start
supabase db reset
supabase functions serve api --no-verify-jwt --env-file .env
python tools/import_excel.py "기존파일.xlsx"
python -m http.server 8080 -d public
```

브라우저에서 <http://localhost:8080>을 열어 학생 회원가입 → 로그인 → 단어 조회 → 시험 제출 → 오답노트 순으로 확인합니다.

## 기존 시스템과 달라진 점

- 비밀번호는 Sheets 평문이 아니라 Supabase Auth에서 해시 형태로 관리됩니다.
- 시트 행 번호 대신 UUID를 사용하므로 행 삭제·정렬에 안전합니다.
- `LockService` 대신 PostgreSQL 제약조건과 원자적 저장을 사용합니다.
- 학생은 본인의 결과·오답·단어장만 접근할 수 있습니다.
- Apps Script 실행시간·동시실행 제한을 받지 않습니다.

## 장애 확인

- `지원하지 않는 함수`가 보이면 최신 Edge Function을 다시 배포합니다.
- `Failed to fetch`가 보이면 `public/config.js`의 Project Ref를 확인합니다.
- 로그인이 안 되면 Supabase Dashboard의 Authentication → Users에서 계정을 확인합니다.
- API 로그는 Supabase Dashboard → Edge Functions → `api` → Logs에서 확인합니다.
