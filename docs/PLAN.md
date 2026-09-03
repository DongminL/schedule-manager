# 알바 근무 일정 관리 웹 서비스 — 기획서

## 1. 서비스 개요

매장 알바생들의 근무 일정을 관리하는 웹 서비스. 모든 인프라를 무료 티어로만 구성하는 것을 원칙으로 하며, 알바생 대부분이 스마트폰으로 접속하는 상황을 고려해 반응형 UI를 기본 요건으로 한다.

## 2. 사용자 역할

| 역할 | 설명 |
|---|---|
| 매니저 (MANAGER) | 계정 관리, 일정 승인/거절, 본인 일정은 승인 없이 즉시 수정 가능 |
| 알바생 (STAFF) | 본인 일정 확인, 일정 변경/교환 신청 |

알바생은 별도 회원가입 없이 **매니저가 직접 계정을 생성**한다.

## 3. 기능 명세

### 3.1 매니저 기능

- **계정 관리**
  - 알바생 계정 생성 (이름, 연락처 입력 → 임시 비밀번호: 연락처와 동일, 최초 로그인시 변경 강제)
  - 계정 정보 수정
  - 계정 삭제 (소프트 삭제 — 실제로는 `isActive = false` 처리, 과거 근무 기록과의 참조 무결성 유지)
  - 계정별 기본 근무 요일 및 시간대 설정 → 이 패턴을 기반으로 캘린더에 반복 근무 이벤트를 자동 생성
- **일정 변경 승인/거절**
  - 알바생이 신청한 변경/교환 요청 검토
  - 승인 처리 시, 같은 사람이 겹치는 시간대에 이중으로 배정되지 않는지 자동으로 충돌 검증한 뒤 반영
  - 거절 시 사유 입력 필수
  - 처리된 요청은 삭제하지 않고 상태(승인/거절)와 사유를 그대로 보존해 이력으로 남긴다
  - 매니저 본인이 직접 캘린더 일정을 수정하는 경우 승인 절차 없이 즉시 반영

### 3.2 알바생 기능

- **일정 변경 신청** (아래 세 가지 모두 매니저 승인 필요)
  - 특정 날짜 근무 시간 변경
  - 특정 근무의 근무자 변경 (신청자는 대상에게 수락을 먼저 받은 후, 매니저의 승인 필요, 이중 승인 구조)
  - 근무자 간 근무 시간 교환 (신청자는 대상에게 수락을 먼저 받은 후, 매니저의 승인 필요, 이중 승인 구조)
  - 이미 동일한 이벤트에 대해 대기 중인 신청이 있으면 추가 신청이 불가능하도록 제한
- **최초 로그인 시 비밀번호 변경 강제**
- 본인이 신청한 요청의 상태 확인 (대기 / 승인 / 거절)

### 3.3 공통 기능

- 메인 페이지에서 전체 일정 확인
- 알바생은 본인 일정만 필터링해서 볼 수 있음

## 4. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트/백엔드 | Next.js (App Router API Routes), TypeScript | 하나의 배포로 통합 |
| 테스트 | Jest, Playwright, TestContainers | Unit Test, E2E Test 작성 필수 |
| 배포 | Netlify | 무료 티어, 상업적 사용 명시적 허용 (Vercel Hobby는 비상업 전용이라 제외) |
| DB | Neon Postgres, Redis Cloud, TypeORM | 무료 티어, 만료 없음 |
| 인증 | Auth.js (Credentials Provider) | 구글 OAuth 불필요, ID/PW 로그인 + JWT 세션 |

## 5. 데이터 모델 (ERD Specification)

### 📋 테이블 목록 (Overview)

| 테이블명 | 한글명 / 설명 | 비고 |
| --- | --- | --- |
| **`users`** | 사용자/직원 정보 | 권한, 캘린더 색상, 로그인 ID, 최초 로그인 비밀번호 변경 강제 |
| **`default_schedule`** | 요일별 기본 고정 스케줄 | 주간 반복 근무 패턴 (`start_date`~`end_date` 유효기간) |
| **`updated_schedule`** | 특정 일자 예외 / 일회성 스케줄 | `kind` = `ADD` / `MODIFY` / `CANCEL` |
| **`schedule_change_requests`** | 스케줄 변경 요청 공통 테이블 | 대타, 맞교환, 시간조정 공통 헤더 |
| **`swap_requests`** | 맞교환(`SWAP`) 상세 요청 | `schedule_change_requests` 하위 상세 |
| **`substitute_requests`** | 대타(`SHIFT`) 상세 요청 | `schedule_change_requests` 하위 상세 |
| **`time_adjustment_requests`** | 시간 조정(`TIME_ADJUST`) 상세 요청 | `schedule_change_requests` 하위 상세 |

- 상세 3종 테이블은 `schedule_change_requests`와 1:1로 연결되며 부모 FK에 `UNIQUE` 제약을 둔다 (불필요한 JOIN 방지).
- 모든 시각 컬럼은 `TIMESTAMPTZ`(UTC 저장, KST 기준), 날짜 컬럼은 `DATE`. `id`는 `SERIAL` PK.

---

### 1. `users` (사용자)

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 사용자 고유 ID |
| `phone_number` | `VARCHAR(20)` | **NOT NULL** | **UQ** | - | 휴대폰 번호 (로그인 ID) |
| `password` | `VARCHAR(255)` | **NOT NULL** | - | - | 비밀번호 해시 |
| `name` | `VARCHAR(50)` | **NOT NULL** | - | - | 사용자 이름 |
| `role` | `VARCHAR(10)` | **NOT NULL** | - | `'STAFF'` | 사용자 권한 (`MANAGER` / `STAFF`) |
| `color` | `VARCHAR(7)` | **NOT NULL** | - | `'#cccccc'` | 캘린더 표시 색상 (`#rrggbb`) |
| `is_active` | `BOOLEAN` | **NOT NULL** | - | `true` | 활성/퇴사 여부 |
| `must_change_password` | `BOOLEAN` | **NOT NULL** | - | `true` | 최초 로그인 시 비밀번호 변경 강제 (임시 비밀번호 = 전화번호) |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 수정 일시 |

- `UNIQUE INDEX uq_users_phone_number (phone_number)`

---

### 2. `default_schedule` (기본 근무 패턴)

> 주간 반복 패턴. `start_time`/`end_time`은 time-of-day(1970-01-01 KST 기준)만 의미가 있으며, `start_date`~`end_date`가 반복 유효기간을 정한다.

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 기본 스케줄 고유 ID |
| `user_id` | `INT` | **NOT NULL** | FK → `users.id` | - | 사용자 ID (`ON DELETE RESTRICT`) |
| `day_of_week` | `VARCHAR(3)` | **NOT NULL** | - | - | 근무 요일 (`SUN`,`MON`,`TUE`,`WED`,`THU`,`FRI`,`SAT`) |
| `start_time` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 근무 시작 시각 |
| `end_time` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 근무 종료 시각 |
| `start_date` | `DATE` | **NOT NULL** | - | - | 반복 시작 날짜 |
| `end_date` | `DATE` | NULL | - | - | 반복 종료 날짜 (NULL이면 무기한) |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 수정 일시 |

- `INDEX idx_default_schedule_user_dow (user_id, day_of_week)`
- `INDEX idx_default_schedule_window (start_date, end_date)`

---

### 3. `updated_schedule` (일자별 예외 / 일회성 스케줄)

> 패턴 발생분에 덮어씌우는 일자 단위 예외, 또는 패턴과 무관한 일회성 근무.

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 예외 스케줄 고유 ID |
| `user_id` | `INT` | **NOT NULL** | FK → `users.id` | - | 사용자 ID (`ON DELETE RESTRICT`) |
| `default_schedule_id` | `INT` | NULL | FK → `default_schedule.id` | - | `NULL` = 일회성 근무(`kind` = `ADD`), `NOT NULL` = 패턴 예외(`MODIFY` / `CANCEL`) (`ON DELETE CASCADE`) |
| `kind` | `VARCHAR(10)` | **NOT NULL** | - | - | 예외 종류 (`ADD` / `MODIFY` / `CANCEL`) |
| `update_date` | `DATE` | **NOT NULL** | - | - | 적용 일자 |
| `start_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 근무 시작 시각 |
| `end_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 근무 종료 시각 |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 수정 일시 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | - | - | 삭제 일시 (소프트 딜리트) |
| `version` | `INT` | **NOT NULL** | - | `1` | 낙관적 락 (Optimistic Lock) 버전 |

- `INDEX idx_updated_schedule_user_date (user_id, update_date)`
- `INDEX idx_updated_schedule_date (update_date)`
- `UNIQUE INDEX uq_updated_schedule_occurrence (default_schedule_id, update_date)` — `WHERE deleted_at IS NULL AND default_schedule_id IS NOT NULL` (동일 패턴 발생분당 활성 예외 1건 보장)

---

### 4. `schedule_change_requests` (근무 변경 요청 공통)

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 변경 요청 고유 ID |
| `user_id` | `INT` | **NOT NULL** | FK → `users.id` | - | 요청자 ID (`ON DELETE RESTRICT`) |
| `approve_by` | `INT` | NULL | FK → `users.id` | - | 최종 승인자 ID (`ON DELETE SET NULL`) |
| `type` | `VARCHAR(12)` | **NOT NULL** | - | - | 요청 유형 (`SHIFT` / `SWAP` / `TIME_ADJUST`) |
| `update_date` | `DATE` | **NOT NULL** | - | - | 변경 대상 일자 |
| `start_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 대상 근무 시작 시각 |
| `end_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 대상 근무 종료 시각 |
| `target_default_schedule_id` | `INT` | NULL | FK → `default_schedule.id` | - | 대상 포인터 (둘 중 하나만 설정, `ON DELETE CASCADE`) |
| `target_updated_schedule_id` | `INT` | NULL | FK → `updated_schedule.id` | - | 대상 포인터 (둘 중 하나만 설정, `ON DELETE CASCADE`) |
| `reason` | `VARCHAR(500)` | **NOT NULL** | - | - | 변경 요청 사유 |
| `reject_reason` | `VARCHAR(500)` | NULL | - | - | 거절 사유 (거절 시에만 작성) |
| `status` | `VARCHAR(20)` | **NOT NULL** | - | `'PENDING'` | 요청 상태 (`PENDING` / `WAITING_PEER_ACCEPT` / `APPROVAL` / `REJECT`) |
| `peer_accepted_at` | `TIMESTAMPTZ` | NULL | - | - | 상대방 수락 일시 (맞교환/대타) |
| `created_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | **NOT NULL** | - | `now()` | 수정 일시 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | - | - | 삭제 일시 |
| `version` | `INT` | **NOT NULL** | - | `1` | 낙관적 락 (Optimistic Lock) 버전 |

- `INDEX idx_scr_status (status)`, `INDEX idx_scr_user (user_id)`, `INDEX idx_scr_update_date (update_date)`
- `UNIQUE INDEX uq_scr_pending_default_target (user_id, update_date, target_default_schedule_id)` — `WHERE status IN ('PENDING','WAITING_PEER_ACCEPT') AND deleted_at IS NULL AND target_default_schedule_id IS NOT NULL`
- `UNIQUE INDEX uq_scr_pending_updated_target (user_id, target_updated_schedule_id)` — `WHERE status IN ('PENDING','WAITING_PEER_ACCEPT') AND deleted_at IS NULL AND target_updated_schedule_id IS NOT NULL`

---

### 5. `swap_requests` (근무 맞교환 요청 상세)

> `schedule_change_requests.type = 'SWAP'` 일 때 연결되는 상세 테이블입니다.

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 맞교환 상세 고유 ID |
| `schedule_change_request_id` | `INT` | **NOT NULL** | FK → `schedule_change_requests.id` | - | 부모 변경 요청 ID (`ON DELETE CASCADE`) |
| `peer_user_id` | `INT` | **NOT NULL** | FK → `users.id` | - | 교환 상대방 ID (`ON DELETE RESTRICT`) |
| `swap_date` | `DATE` | **NOT NULL** | - | - | 교환할 상대방 근무 일자 |
| `start_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 상대방 근무 시작 시각 |
| `end_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 상대방 근무 종료 시각 |
| `peer_target_default_schedule_id` | `INT` | NULL | FK → `default_schedule.id` | - | 상대방 대상 포인터 (`ON DELETE CASCADE`) |
| `peer_target_updated_schedule_id` | `INT` | NULL | FK → `updated_schedule.id` | - | 상대방 대상 포인터 (`ON DELETE CASCADE`) |

- `UNIQUE INDEX uq_swap_requests_parent (schedule_change_request_id)`
- `INDEX idx_swap_requests_peer (peer_user_id)`

---

### 6. `substitute_requests` (대타 요청 상세)

> `schedule_change_requests.type = 'SHIFT'` 일 때 연결되는 상세 테이블입니다.

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 대타 상세 고유 ID |
| `schedule_change_request_id` | `INT` | **NOT NULL** | FK → `schedule_change_requests.id` | - | 부모 변경 요청 ID (`ON DELETE CASCADE`) |
| `user_id` | `INT` | **NOT NULL** | FK → `users.id` | - | 대타 근무를 수행할 대상자 ID (`ON DELETE RESTRICT`) |

- `UNIQUE INDEX uq_substitute_requests_parent (schedule_change_request_id)`
- `INDEX idx_substitute_requests_user (user_id)`

---

### 7. `time_adjustment_requests` (근무 시간 조정 요청 상세)

> `schedule_change_requests.type = 'TIME_ADJUST'` 일 때 연결되는 상세 테이블입니다.

| 컬럼명 (Field) | 타입 (Type) | Null | Key | 기본값 (Default) | 설명 (Comment) |
| --- | --- | --- | --- | --- | --- |
| `id` | `SERIAL` | **NOT NULL** | **PK** | - | 시간 조정 상세 고유 ID |
| `schedule_change_request_id` | `INT` | **NOT NULL** | FK → `schedule_change_requests.id` | - | 부모 변경 요청 ID (`ON DELETE CASCADE`) |
| `adjust_start_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 조정 요청할 새 시작 시각 |
| `adjust_end_at` | `TIMESTAMPTZ` | **NOT NULL** | - | - | 조정 요청할 새 종료 시각 |

- `UNIQUE INDEX uq_time_adjustment_requests_parent (schedule_change_request_id)`

### 9. 데이터 흐름

설명해주신 비즈니스 로직을 바탕으로 정리한 **스케줄 관리 시스템의 데이터 흐름도(Data Flow) 및 처리 알고리즘**입니다.

이 구조는 "기본 반복 패턴(Default) 위에 예외 및 변경 사항(Override)을 덮어씌우는 아키텍처"입니다.

---

#### 1. 전체 데이터 흐름도 (High-Level Architecture)

```
[1. 기본 일정 등록]
  └─► DefaultSchedule (요일별 반복 근무 정의)
         │
         ▼
[2. 변경/추가/삭제 이벤트 발생]
  └─► ScheduleChangeRequests 생성 (대타 / 맞교환 / 시간조정 / 근무추가 등)
         │ (PENDING ──► WAITING_PEER_ACCEPT ──► MANAGER 승인)
         ▼
[3. 승인(APPROVAL) 시 일정 반영]
  └─► updatedSchedule (특정 날짜의 근무 수정/추가/취소 예외 레코드 생성)
  └─► DefaultSchedule.end_date 설정 (특정 날짜 이후 반복 종료 시)
         │
         ▼
[4. 캘린더/스케줄 최종 조회 (View Resolution)]
  └─► DefaultSchedule과 updatedSchedule을 조합하여 최종 근무표 도출

```

---

#### 2. 케이스별 상세 데이터 흐름

```
+-----------------------------------------------------------------------------------+
| 구분            | 원천 테이블                  | 반영 테이블 & 방식                         |
+-----------------------------------------------------------------------------------+
| 1. 근무 시간조정 | ScheduleChangeRequests     | updatedSchedule INSERT                    |
|    / 대타 / 교환 | (TIME_ADJUST / SHIFT/ SWAP)| - default_schedule_id 연결                 |
|                 |                            | - update_date, 새로운 start/end_time 저장  |
+-----------------------------------------------------------------------------------+
| 2. 일회성 근무  | ScheduleChangeRequests     | updatedSchedule INSERT                    |
|    추가         | (또는 관리자 직접 추가)    | - default_schedule_id = NULL              |
|                 |                            | - update_date, start/end_time 저장        |
+-----------------------------------------------------------------------------------+
| 3. 특정 일자    | ScheduleChangeRequests     | updatedSchedule INSERT (단건 취소 레코드) |
|    단건 삭제/취소| (휴무/결근 처리)           | - default_schedule_id 연결                 |
|                 |                            | - update_date 저장                        |
|                 |                            | - start_time = NULL, end_time = NULL      |
+-----------------------------------------------------------------------------------+
| 4. 특정 일자    | 관리자 설정 / 계약 종료    | DefaultSchedule UPDATE                    |
|    이후 반복 종료|                            | - 해당 기본 스케줄의 end_date = '종료일'  |
+-----------------------------------------------------------------------------------+

```

##### 1. 기본 근무의 시간 변경 / 대타 / 맞교환 승인 시

1. 요청자가 `ScheduleChangeRequests` (상세: `TimeAdjustmentRequests`, `SubstituteRequests`, `SwapRequests`)를 등록합니다.
2. 교환 대상자(Peer) 수락 및 관리자 승인이 완료되면 `status = 'APPROVAL'`로 변경됩니다.
3. 승인 트랜잭션 내에서 `updatedSchedule`에 새로운 행을 `INSERT`합니다:
* `user_id`: 실제 근무할 대상자 ID (대타/교환의 경우 변경된 대상자)
* `default_schedule_id`: 기존 기본 스케줄 ID
* `update_date`: 변경 대상 일자
* `start_time` / `end_time`: 변경된 시간



##### 2. 새로운 일회성 근무 추가 시

* 기본 요일 근무와 별개로 특정 날짜에 근무가 추가되는 경우:
* `updatedSchedule`에 `default_schedule_id = NULL`로 `INSERT`됩니다.

##### 3. 특정 날짜의 단일 반복 일정 삭제/취소 시 (휴무/결근 등)

* 특정 날짜 하루만 기본 스케줄을 비우고 싶을 때:
* `updatedSchedule`에 `start_time = NULL`, `end_time = NULL`로 `INSERT`하여 해당 일자에 근무가 없음(Cancel)을 명시합니다.

##### 4. 특정 날짜 이후로 반복 일정을 영구 종료할 때

* 직원의 근무 요일이 완전히 바뀌거나 퇴사하는 경우:
* `DefaultSchedule` 테이블의 `end_date` 컬럼에 종료 기준 날짜를 업데이트합니다.
* 이후 날짜부터는 해당 `DefaultSchedule`이 조회되지 않습니다.

---

### 3. 최종 스케줄 조회(캘린더 렌더링) 알고리즘

특정 날짜($D$)에 사용자($U$)의 최종 근무 일정을 산출할 때의 우선순위 로직입니다.

```
                  [날짜 D에 해당하는 기본 요일 확인]
                                │
                                ▼
         [DefaultSchedule에서 user_id = U 이고 요일 일치하는가?]
         [단, D <= end_date (또는 end_date IS NULL) 조건 충족]
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
              [YES: 있음]                  [NO: 없음]
                 │                             │
                 ▼                             ▼
   [updatedSchedule에 (U, D)가 있는가?]      [updatedSchedule에 (U, D)가 있는가?]
                 │                             │
         ┌───────┴───────┐                     ┌───────┴───────┐
         ▼               ▼                     ▼               ▼
      [있음]           [없음]                [있음]          [없음]
         │               │                     │               │
  ┌──────┴──────┐        │                     │             [근무 없음]
  ▼             ▼        ▼                     ▼
[시간이 NULL?] [시간값] [DefaultSchedule 시간] [updatedSchedule 시간]
  │             │
[휴무/삭제]   [수정된 시간]

```

## 6. 인증/권한 설계

- Auth.js Credentials 로그인, JWT 세션 전략 (서버리스 환경에 적합)
- 미들웨어에서 role 기반 라우트 보호 (`/admin/*`은 MANAGER만 접근)
- 비밀번호는 bcrypt로 해싱 저장

## 7. UI/UX 설계

- Next.js App Router 기반, SCSS, Module CSS, Lucide React 아이콘 사용
- 다크 모드 지원 (시스템, light, dark 전환 토글), Zustand로 전역 상태 관리
- DESIGN-cal.md 참고

## 8. 프로젝트 구조

- DDD 패턴 기반으로 MVC로 분리

```
src/
 ┣ user/
 ┃ ┣ domain/ (User 엔티티, 인터페이스)
 ┃ ┣ dto/
 ┃ ┣ service/
 ┃ ┗ controller/
 ┣ order/
 ┃ ┣ domain/ (Order 엔티티)
 ┃ ┣ dto/
 ┃ ┣ service/
 ┃ ┗ controller/
 ┣ core/
 ┃ ┣ db/ (공용 DB, ORM 설정, 리포지토리 인터페이스)
 ┃ ┣ utils/ (공용 유틸)
 ┃ ┗ config/
```