# Blending 클린 아키텍처 규칙 및 의존성 가이드 (Architecture Guide)

> **목적:** 업무 규칙(도메인 및 유스케이스)을 외부 기술(Next.js, React, MongoDB, 외부 SDK)로부터 격리하고, 의존성 역전 원칙(DIP)을 통해 테스트 가능하고 지속 가능한 코드를 유지합니다.

---

## 1. 계층 정의 및 목표 의존성 방향

아래 화살표는 실행 순서가 아니라 **소스 코드의 `import` 방향**입니다. 상위 계층(도메인·유스케이스)은 하위 계층(인프라·프레임워크)을 import해서는 안 됩니다.

```text
[ domain ]                        → 순수 TypeScript 및 도메인 내부
     ↑
[ application ]                   → domain + 유스케이스 포트/타입
     ↑               ↖
[ infrastructure ]   [ ui / store ] → HTTP adapter + 순수 도메인 타입/함수
     ↑               ↑
[ API route / app ] ─┘             → application + infrastructure + Next
```

### 1.1 계층별 책임과 규칙

| 계층 (Layer) | 경로 (Path) | 허용되는 Import | 금지되는 Import |
|---|---|---|---|
| **domain** | `web/src/domain/**` | 순수 TypeScript, 도메인 내부 모델/타입/순수함수 | `application`, `infrastructure`, `ui`, `store`, `adapters`, 프레임워크(`react`, `next`, `mongodb`, `axios` 등) |
| **application** | `web/src/application/**` | `domain`, 유스케이스 포트 인터페이스, 계약 패키지(`@blending/*`) | `infrastructure` (`@/infrastructure/**`), 프레임워크(`react`, `next`, `mongodb`, `axios` 등) |
| **infrastructure** | `web/src/infrastructure/**` | `application` 포트, `domain`, DB 드라이버(`mongodb`), 외부 SDK(`aws`, `solapi` 등) | `ui`, `store`, 순환을 유발하는 비즈니스 직접 소유 |
| **ui / store** | `web/src/ui/**`, `web/src/store/**` | `domain` 타입/순수함수, `adapters/http`, UI 공통 컴포넌트, `react`, `zustand` | 서버 `infrastructure` (`@/infrastructure/**`), `mongodb` |
| **adapters** | `web/src/adapters/**` | `domain`, 전송용 DTO, HTTP client (`axios` 등) | 서버 `infrastructure`, UI 컴포넌트 |
| **app** | `web/app/**` | `application`, `infrastructure`, `ui`, `domain`, `next` | (최상위 조립 계층으로서 DI 및 HTTP 응답 처리 담당) |

### 1.2 핵심 설계 원칙
1. **`infrastructure → application`은 정상적인 의존성입니다:** 인프라 구현체(예: Mongo 저장소)는 유스케이스가 선언한 포트(인터페이스)를 구현(`implements`)합니다.
2. **application에 구체 인프라 타입 노출 금지:** `ClientSession`, `ObjectId`, `NextRequest`, `NextResponse` 등을 유스케이스 시그니처나 파일에 import하지 않습니다.
3. **유스케이스 포트 인터페이스 위치:** 해당 유스케이스 파일 내부 또는 같은 도메인의 `application` 디렉터리에 선언합니다. 거대한 범용 `BaseRepository`를 지양합니다.
4. **조립 책임의 분리:** 구체 저장소 인스턴스화(`new AdminStatsMongoRepository()`) 및 유스케이스로의 주입은 `web/app/api/**` 라우트 핸들러에서 수행합니다.

---

## 2. 자동 아키텍처 검사 규칙 (Rule IDs)

TypeScript Compiler API 기반의 정적 분석 도구(`web/scripts/check-architecture.ts`)가 아래 4가지 규칙을 자동 검사합니다.

### 2.1 `domain-no-outer`
- **검출:** `domain` 코드가 외부 계층(`application`, `infrastructure`, `ui`, `store`, `adapters`) 또는 외부 프레임워크(`react`, `next`, `mongodb`, `axios`)를 참조하는 경우.
- **해결:** 순수 도메인 로직과 타입만 도메인에 남기고, 기술 종속적 코드는 인프라 또는 어댑터로 분리합니다.

### 2.2 `application-no-infrastructure`
- **검출:** `application` 코드가 `@/infrastructure/**` 또는 상대경로로 인프라스트럭처 코드를 참조하는 경우.
- **해결:** 유스케이스에 필요한 포트(인터페이스)를 정의하고, 라우트 핸들러에서 구체 인프라 구현체를 주입(Dependency Inversion)합니다.

### 2.3 `application-no-framework`
- **검출:** `application` 코드가 `react`, `next`, `mongodb`, `axios` 등의 외부 프레임워크 패키지를 import하는 경우 (타입 import 포함).
- **해결:** 프레임워크 종속적인 데이터 타입(예: `ClientSession`)을 유스케이스에서 직접 사용하지 않고 인터페이스 뒤로 추상화합니다.

### 2.4 `ui-store-no-server-infrastructure`
- **검출:** 클라이언트 UI 컴포넌트나 Zustand store가 서버 인프라 코드(`@/infrastructure/**`)나 `mongodb`를 import하는 경우.
- **해결:** 클라이언트는 HTTP 어댑터(`@/adapters/http/**`)를 통해 서버 API와 통신하며, 서버 코드를 직접 참조하지 않습니다.

### 2.5 현재 자동 검사의 한계 및 수동 리뷰 범위
현재 CI 자동 검사(`check-architecture.ts`)는 전체 클린 아키텍처의 완전 강제를 의미하지 않으며, **목표 의존성 방향(§1)**과 **현재 CI 자동 보장 범위**를 구분해야 합니다 (추가 코드 검사기 확장은 이번 문서 마무리 범위가 아님):
- **실제 Rule ID 4개만 보장:** 현재 검사기는 명시된 4개 규칙만 기계적으로 보장합니다.
- **미검사 계층 간선:** `application -> ui/store/adapters` 및 `store -> ui` 의존성은 현재 자동 검사되지 않습니다.
- **외부 framework 목록 제한:** 외부 프레임워크 차단 목록은 `react`, `react-dom`, `next`, `mongodb`, `axios` 5개로 한정됩니다.
- **`process.env` 사용 미검사:** 도메인 및 유스케이스 계층의 `process.env` 직접 참조는 검사되지 않으며, 기존 `domain/daily-note/dailyNoteImageUrl.ts` 등에 실제 존재합니다.
- **수동 리뷰 필요 대상:** `import()` 타입 노드나 비리터럴 동적 경로 등은 정적 분석의 한계로 인해 PR 리뷰 시 수동 확인이 필요합니다.
- **주의:** 이를 전체 클린 아키텍처의 강제 완료로 단정하지 않으며, 기준선(baseline)을 기반으로 점진적으로 개선해 나갑니다.

---

## 3. 점진적 전환 및 기준선(Baseline) 관리 정책

기존 프로젝트의 수많은 의존성을 한 번에 모두 고치는 것은 불가능하므로, **기준선(Baseline) 기반의 점진적 개선 정책**을 적용합니다.

### 3.1 식별자 형식 (Violation Key)
위반 식별자는 줄 번호 없이 **`source + target + rule`**의 조합으로 고유하게 식별됩니다.
- 줄 번호가 변경되어도 코드 수정 전까지 기준선이 안정적으로 유지됩니다.
- 경로 형식: `web/src/application/admin/adminUnitOfWork.ts -> web/src/infrastructure/mongodb/client.ts [application-no-infrastructure]`

### 3.2 기준선 파일 (`docs/architecture-baseline.json`)
- 현재 소스코드에서 발견된 허용된 기존 위반 목록을 보관합니다.
- **신규 위반 차단 (New Violation Block):** baseline에 등록되지 않은 새로운 위반이 발생하면 CI 및 로컬 검사가 즉시 실패(exit 1)합니다.
- **해소된 예외 강제 제거 (Stale Exception Block):** 코드를 리팩토링하여 기존 위반이 해소되었는데 baseline 파일에 여전히 남아 있는 경우, 검사가 실패(exit 1)합니다. 해결된 예외를 기준선에서 즉시 제거해야 합니다.
- **자동 갱신 금지:** 일반 검사 명령(`pnpm check:architecture`)은 baseline을 자동으로 덮어쓰지 않습니다. 의도적인 기준선 갱신 시에만 명시적 명령(`pnpm check:architecture --update-baseline`)을 사용합니다.

### 3.3 순환 의존 (Cycle) 및 미해결 경로 정책
- **미해결 상대경로/alias:** `@/` 또는 상대경로로 import했으나 대상 파일이 없으면 빌드 오류(실패)로 처리합니다.
- **미해결 외부 패키지:** 패키지명을 기준으로 규칙을 적용하고 리포트에 기록합니다.
- **계층 간 순환 (Cross-Layer Cycle):** 금지된 방향의 간선(예: `application -> infrastructure`)을 포함하는 순환은 해당 아키텍처 규칙 위반과 동일하게 처리되어 baseline 비교에 따라 차단됩니다.
- **계층 내 순환 (Intra-Layer Cycle):** 동일 계층 내(예: `infrastructure -> infrastructure`) 순환은 정보성 경고(warning)로 보고하며 검사를 실패시키지 않습니다.

---

## 4. 검증 및 CI 명령어

### 4.1 로컬 검증
```bash
# 아키텍처 경계 검사 실행
pnpm --filter @blending/web run check:architecture

# 아키텍처 검사기 단위 테스트 실행
pnpm --filter @blending/web exec tsx --test scripts/check-architecture.test.ts

# 대시보드 유스케이스 단위 테스트 실행
pnpm --filter @blending/web exec tsx --test src/application/admin/dashboardUseCase.test.ts
```

### 4.2 CI 연동
`.github/workflows/admin-ci.yml` 워크플로우에 `pnpm --filter @blending/web check:architecture` 단계가 추가되어 있어 모든 PR 및 push 시 자동 검증됩니다.

---

## 5. 후속 전환 과제 (Roadmap)

본 단계(작업 1 + 작업 2)에서 검사 체계와 관리자 대시보드 DIP를 완료하였으며, 후속 작업은 아래 순서로 진행됩니다.

1. **작업 3:** 디자인 기본 요소 (`Button`, `LinkButton`, `Input`, `Field`) 공통화 및 화면 적용.
2. **작업 4:** 서버 쓰기 기준 사례 (후기 생성 `createReview` 유스케이스 도입 및 의존성 역전).
3. **작업 5:** 공통 피드백 및 화면 조합 (`Toast`, `Pagination`, `TopAppBar`).
4. **작업 6:** 나머지 기능 및 고위험 경계:
   - `blockedUserEvent.ts`: 순수 목록 필터와 DOM 이벤트 어댑터(`web/src/adapters/browser/blockedUserEvent.ts`) 분리.
   - `adminUnitOfWork.ts`: Mongo `ClientSession` 제거 및 트랜잭션 콜백 패턴 전환.
   - 계정 탈퇴/감사로그 원자성 보존 및 baseline 위반 점진 축소.
