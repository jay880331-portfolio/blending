# BLENDING Design System

> 카테고리: Custom (Brand)
> 톤: 흰 배경 + 검정 본문 + 단일 빨강 강조 + 4색 하이라이터. 한글 본문 + 픽셀 로고의 대비.
> 이 문서는 **저장소 코드 실측 기준**이다. 값을 바꾸려면 코드와 이 문서를 같은 커밋에서 함께 바꾼다.
> 실제 코드 및 부분 렌더링 실측 현황은 [docs/design-system-inventory.md](docs/design-system-inventory.md)를 참조한다.
> 본 문서는 실제 소스 코드(`web/src/ui/shared/`, `globals.css`)와 부분 브라우저 실측에 기반하며, 전수조사·전상태실측·전체도입완료가 아닌 점진적 표준화 범위다.

---

## 0. 적용 범위와 토큰 원천

| 패키지 | 이 문서 적용 | 토큰 원천 (source of truth) |
|---|---|---|
| `web/` | **기준 대상** | `web/app/globals.css` `:root` + `.ds-*` 유틸리티 |
| `app/` | 간접 적용 | Expo **WebView 컨테이너**다. 자체 UI가 거의 없고 화면은 `web/`을 그대로 띄운다. 네이티브 스플래시·시스템 UI만 앱 몫 |
| `admin/` | **부분 적용** | `admin/app/globals.css` — 토큰 **이름은 동일, 값은 다름**. §15 참조 |
| `homepage/` | **부분 적용** | `homepage/app/globals.css` — web 팔레트를 축약 복제. §15 참조 |

**규칙**
- 색·반경·폰트·그림자는 반드시 `var(--토큰)`으로 쓴다. 새 토큰이나 새 색을 만들지 않는다.
- 토큰은 **Tailwind theme에 등록되어 있지 않다.** Tailwind v4 CSS-first(`@import "tailwindcss"`, `tailwind.config` 없음, `@theme` 블록 없음)이므로 소비는 항상 arbitrary value 문법이다 — `bg-[var(--surface)]`, `text-[var(--fg-muted)]`, `rounded-[var(--radius-lg)]`.
- `text-gray-500`, `bg-red-500` 같은 Tailwind 기본 팔레트 클래스는 `web/src/ui/` 전체에서 **0건**이다. 이 상태를 유지한다.
- 스택: Next.js 16.2.6 / React / TailwindCSS 4.3.0 / TypeScript strict.

---

## 1. 비주얼 테마 & 분위기
- **여백 큰 모던 미니멀** 위에 **레트로 픽셀 로고 한 점**.
- 본문은 한글 친화적 산세리프(서울남산체)로 차분하게, 로고만 픽셀(Galmuri11)로 인상 남기기.
- 장식 최소. 색은 검정/회색/흰색이 99%, 빨강은 강조 1회, 하이라이터 4색은 커뮤니티 콘텐츠 분류 표식.

---

## 2. 컬러 토큰 (`web/app/globals.css` `:root` 실측)

라이트 팔레트 **단일**이다. 다크 모드는 구현되어 있지 않다(§14).

### 2.1 Surface & Foreground
| Token | Value | 용도 |
|---|---|---|
| `--bg` | `#ffffff` | 페이지 배경 |
| `--surface` | `#ffffff` | 카드/모달/내비 |
| `--surface-alt` | `#fafafa` | 보조 표면(스켈레톤, 태그 배경, 비선택 칩) |
| `--surface-high` | `#ffffff` | 떠 있는 시트 (라이트에서는 surface와 동일) |
| `--fg` | `#000000` | 본문 텍스트, 토스트 배경 |
| `--fg-strong` | `#000000` | 헤드라인 |
| `--fg-muted` | `#6b7280` | 보조 텍스트 |
| `--fg-subtle` | `#9ca3af` | 캡션/플레이스홀더/비활성 탭 |
| `--fg-faint` | `#d1d5db` | 비당월 날짜 등 최약 텍스트 |
| `--border` | `#f3f4f6` | 디바이더/카드 보더 |
| `--border-strong` | `#e5e7eb` | 입력 보더 |
| `--border-dashed` | `#d1d5db` | 업로드 영역 점선 |

### 2.2 Accent (단일)
| Token | Value | 용도 |
|---|---|---|
| `--accent` | `#ff0000` | CTA, 활성 탭, 활성 아이콘, 오늘 날짜, 포커스 — **유일한 액센트** |
| `--accent-hover` | `#e10000` | Primary 버튼 hover (색 계산 대신 고정 토큰을 쓴다) |
| `--accent-soft` | `rgba(255,0,0,0.2)` | 셀렉션 하이라이트, **Primary 버튼 disabled 배경** |

### 2.3 Semantic
| Token | Value |
|---|---|
| `--success` | `#17a34a` |
| `--warn` | `#eab308` |
| `--danger` | `#dc2626` |
| `--info` | `#4a90e2` |

### 2.4 하이라이터 — 커뮤니티 탭 전용
| Token | Value | 카테고리 |
|---|---|---|
| `--hl-yellow` | `rgba(250,204,21,0.3)` | Official |
| `--hl-blue` | `rgba(96,165,250,0.3)` | Seminar |
| `--hl-green` | `rgba(52,211,153,0.3)` | Meetup |
| `--hl-red` | `rgba(255,0,0,0.2)` | 강조 |

### 2.5 캘린더 도트
| Token | Value |
|---|---|
| `--dot-yellow` | `#ffd700` |
| `--dot-blue` | `#4a90e2` |
| `--dot-green` | `#50e3c2` |

### 2.6 그림자
| Token | Value | 용도 |
|---|---|---|
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.04)` | Primary 버튼 **전용**. 카드에는 쓰지 않는다 |
| `--shadow-modal` | `0 8px 32px rgba(0,0,0,0.12)` | 모달/바텀시트/토스트 |
| `--shadow-nav` | `0 -4px 20px rgba(0,0,0,0.02)` | BottomNav 위쪽 그림자 |

### 2.7 앱 셸
| Token | Value | 비고 |
|---|---|---|
| `--app-shell-max-width` | `100vw` | 모든 도메인 App 루트가 `max-w-[var(--app-shell-max-width)]`로 소비. **데스크톱 축소 컨테이너 없음** |
| `--app-safe-area-bottom` | `max(env(safe-area-inset-bottom), 24px)` | |
| `--app-bottom-nav-height` | `calc(62px + var(--app-safe-area-bottom))` | 하단 고정 UI 위치 계산의 기준값 |

---

## 3. 타이포그래피

### 3.1 로드되는 폰트 (`web/public/fonts/`)
| 폰트 | 웨이트 | 역할 | 선언 위치 |
|---|---|---|---|
| **SeoulNamsan** | 300 / 500 / 700 / 800 | `--font-body` `--font-display` `--font-label` — 본문 전부 | `globals.css` |
| **Galmuri11** | 400 / 700 | `--font-logo` — **로고 워드마크 전용** | `globals.css` |
| **Material Symbols Outlined / Filled** | 300 | 아이콘 폰트 2벌 | `globals.css` |
| **Pretendard** | 100~900 | `web`에서는 **국소 사용만** — `ResumeModal`, `ProfileSwipeCard`(canvas). 본문 토큰이 아니다 | `src/ui/shared/pretendard.css` |
| **Bodoni Moda** | Latin | `ResumeModal` **전용** 세리프. 컴포넌트 내부 `@font-face` | `ResumeModal.tsx` |

| 토큰 | 값 |
|---|---|
| `--font-logo` | `"Galmuri11", "Courier New", monospace` |
| `--font-display` / `--font-body` / `--font-label` | `"SeoulNamsan", -apple-system, BlinkMacSystemFont, system-ui, sans-serif` |
| `--font-mono` | `ui-monospace, "JetBrains Mono", monospace` |

> `Pretendard`와 `Bodoni Moda`는 이력서/프로필 카드라는 **별도 인쇄형 표현**에서만 쓴다. 일반 화면에 끌어오지 않는다. `admin`은 본문 폰트가 Pretendard다(§15).

### 3.2 타입 스케일 = `.ds-*` 유틸리티 클래스
`globals.css`에 실제로 정의된 클래스다. 화면에서는 새 크기를 만들지 말고 이 클래스를 쓴다.

| 클래스 | px | weight | line-height | letter-spacing |
|---|---|---|---|---|
| `.ds-display-l` | 32 | 700 | 1.2 | -0.02em |
| `.ds-display-m` | 24 | 700 | 1.25 | -0.015em |
| `.ds-h1` | 20 | 700 | 1.3 | -0.01em |
| `.ds-h2` | 18 | 700 | 1.35 | -0.01em |
| `.ds-h3` | 16 | 600 | 1.4 | 0 |
| `.ds-body-l` | 16 | 400 | 1.6 | 0 |
| `.ds-body` | 14 | 400 | 1.6 | 0 |
| `.ds-body-s` | 13 | 400 | 1.5 | 0 |
| `.ds-label` | 12 | 500 | 1.4 | 0.02em |
| `.ds-label-caps` | 12 | 700 | 1.4 | **0.16em** + `text-transform: uppercase` |
| `.logo-wordmark` | (지정 크기) | 700 | 1.0 | **0** + `font-synthesis: none` |

색 유틸리티: `.ds-muted` `.ds-subtle` `.ds-danger` `.ds-accent` `.ds-inverse` `.ds-inline-link`(fg + 700 + underline), `.tab-caps`(letter-spacing 0.16em).

### 3.3 사용 규칙
- `BLENDING` 워드마크는 `.logo-wordmark`(Galmuri11, `letter-spacing: 0`). 픽셀 획이 촘촘하게 보이도록 tracking을 넣지 않는다.
- 워드마크가 좌우 아이콘과 겹치면 글자 크기를 줄이기 전에 아이콘 컬럼 폭을 먼저 조정한다.
- 영문 ALL CAPS는 `.ds-label-caps` 또는 `.tab-caps`로 `0.16em` tracking을 준다.
- 한글 헤드라인에는 ALL CAPS를 적용하지 않는다 — 무게/크기로만 위계를 만든다.
- 한 화면에 노출되는 타입 사이즈는 **최대 4단계**.
- `Galmuri11`은 로고 전용이다. 버튼·탭·카드·숫자 카운터·페이지네이션에 쓰지 않는다.

### 3.4 화면 확장 시 폰트 일관성
- 새 탭/도메인을 추가해도 §3.2 스케일을 그대로 따른다. 레퍼런스 시안의 글자가 커 보여도 기존 위계를 우선한다.
- 콘텐츠 리스트 타이틀은 `18px / 700 / line-height 1.3`(`.ds-h2`)을 기본으로 한다. 보조 설명 `14px / 400`, 메타 `12–13px`.
- 최상위 텍스트 탭은 **`16px`**(`TextTabBar` 실측). 별도 승인 없이 18px 이상으로 키우지 않는다.
- 카테고리 칩/필터 칩은 `13px / 500`, 선택 상태만 `700`.
- 상세 화면 대표 제목은 `24–28px`. 본문 문단은 `16px / line-height 1.6–1.8`을 넘기지 않는다.
- 폼 섹션 제목 `20px / 700`, 필드 라벨 `13px / 500–700`, 입력 본문 `16px`.
- 구현 전후로 기존 커뮤니티 화면의 카드/탭/폼과 나란히 비교해, 특정 도메인만 한 단계 크게 보이면 낮춘다.

### 3.5 목록 공통 컴팩트 규칙
- 목록·홈 섹션·프로필 명함 내부 정보의 제목/라벨은 `16px / 700` 또는 `12px`, 내용과 메타는 `12px`.
- 조회수/댓글수/좋아요 숫자는 `12–13px`, 메타 아이콘은 `17px`.
- 목록 카드에 탭명을 반복하는 배지를 넣지 않는다.
- 카드 내부 세로 간격 `8px`, 행 패딩 `16px`.

---

## 4. 보더 반경

| Token | web / homepage | admin | 적용 대상 |
|---|---|---|---|
| `--radius-sm` | 2px | 3px | 태그/뱃지, 하이라이터, 캘린더 이벤트 막대 |
| `--radius-md` | 4px | 6px | 입력 필드, 체크박스 |
| `--radius-lg` | 8px | 10px | 카드, 버튼, 토스트, BottomNav 아이템 |
| `--radius-xl` | 12px | 16px | 모달/바텀시트 |
| `--radius-pill` | 9999px | 9999px | 아바타, 날짜 원형, 토글, 필터 칩, 아이콘 버튼 |

**규칙**: 한 화면에 반경 2단계 초과 금지 (예: 카드 `lg` + 칩 `sm`).

---

## 5. 스페이싱 (4px 그리드)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80`

| 패턴 | 값 |
|---|---|
| 인풋 내부 패딩 | `14px 16px` (textarea `18px 16px`) |
| 카드 내부 패딩 | 20px |
| 섹션 사이 갭 | 32px |
| 페이지 좌우 패딩 | 24px (`px-6`) |
| 폼 필드 사이 | 32px |
| 헤드라인 → 본문 | 8px |
| 본문 → 보조 텍스트 | 4px |

---

## 6. 컴포넌트 사양

`web/src/ui/shared/`에 있는 것이 공통 컴포넌트다. 신규 UI 작업 전 여기부터 확인하고, 없으면 여기에 만든다.

### 6.1 버튼 — [Button.tsx](web/src/ui/shared/Button.tsx) / [LinkButton.tsx](web/src/ui/shared/LinkButton.tsx) (`globals.css` `.ds-btn` 기반)
공통 컴포넌트로 [`Button.tsx`](web/src/ui/shared/Button.tsx)와 [`LinkButton.tsx`](web/src/ui/shared/LinkButton.tsx)(Next Link용 `LinkButton`, 일반 a태그용 `AnchorButton`)를 사용한다. variant는 `primary`, `secondary`, `ghost`, `base`를 지원하며, 기본 `type="button"`, `pending` 상태 시 `disabled` 및 `aria-busy="true"`가 적용된다.

| | 값 |
|---|---|
| `.ds-btn` 기본 / `base` | `min-height: 64px`, `width: 100%`, flex center, `gap: 8px`, `padding: 20px 28px`, `radius: var(--radius-lg)`, `18px / 700 / line-height 1.2` |
| `.ds-btn-primary` / `primary` | `background: var(--accent)`, `color: #fff`, `box-shadow: var(--shadow-card)`, hover `var(--accent-hover)` |
| `.ds-btn-secondary` / `secondary` | `border: 1px solid var(--border-strong)`, 배경 transparent, hover 시 보더 `var(--fg-muted)` |
| `.ds-btn-ghost` / `ghost` | `min-height: auto`, `width: auto`, `padding: 8px 12px`, `14px / 500`, `color: var(--fg-muted)` |

**상태**
- active: `transform: scale(0.98)`, transition `150ms ease-out`
- disabled(기본): `opacity: 0.4`, `cursor: not-allowed`
- **Primary disabled은 opacity가 아니다** — `background: var(--accent-soft)`, `color: var(--accent)`, 그림자 제거, `opacity: 1`

**규칙**
- 같은 그룹의 Primary/Secondary는 크기·무게·세로 패딩을 동일하게 맞추고 색과 보더로만 위계를 만든다.
- 한 화면 주요 CTA는 최대 1개. 보조 CTA가 뒤따르면 같은 폭·높이를 유지한다.
- 작성/등록/제출 같은 완료 액션은 TopAppBar 우측 텍스트 버튼으로 두지 않고, 본문 하단 풀폭 Primary로 배치한다.
- 버튼 내부 아이콘은 18–20px, 텍스트와 gap 8px.
- 아이콘 버튼은 `radius-pill`, 히트 영역 44×44 이상.

### 6.2 입력 및 폼 필드 — [Input.tsx](web/src/ui/shared/Input.tsx) / [Field.tsx](web/src/ui/shared/Field.tsx)
- 공통 입력 컴포넌트 [`Input.tsx`](web/src/ui/shared/Input.tsx)는 `Input`, `Textarea`, `Select`를 제공하며 variant로 `standard`(`.ds-input`)와 `partner`(`.partner-input`)를 지원한다.
- 공통 폼 필드 컴포넌트 [`Field.tsx`](web/src/ui/shared/Field.tsx)는 `FieldLabel`(variant `standard` | `profile`, `caps`)과 `PartnerField`(`label`, `hint`, `children`)를 제공한다.
- 현재 `size`, `danger` prop이나 자동 `error` 연결은 구현되어 있지 않으며(호출부에서 상태 제어), 입력 외형 일괄 강제 없이 variant 분기를 유지한다.
- `width: 100%`, `border: 1px solid var(--border-strong)`, `radius: var(--radius-md)`(4px), 배경 transparent
- `padding: 14px 16px`, `font-size: 16px / 400 / line-height 1.6`
- placeholder: `color: var(--fg-subtle)` — **플레이스홀더를 실제로 쓴다**
- focus: `border-color: var(--accent)`, `border-width: 1.5px`, 그림자 없음
- 파트너 폼 전용 변형 `.partner-input` / `.partner-input-with-icon` / `.partner-textarea`(패딩 `18px 16px`) / `.partner-field-error`
- **플로팅 라벨 패턴은 이 저장소에 없다.** 새로 도입하려면 공통 컴포넌트를 먼저 만들고 이 문서를 함께 고친다.

### 6.3 체크박스 / 라디오 (`TermsConsentCheckbox`)
- `18×18`, `border: 1.5px var(--border-strong)`, `radius: var(--radius-md)`(체크) / `pill`(라디오)
- 체크 색은 네이티브 `accent-color: var(--accent)`
- 라벨은 `13px / line-height 1.25 / var(--fg-muted)`, `gap: 12px`, 상단 정렬

### 6.4 토글 (Switch)
- 트랙 `44×24`(`h-6 w-11`), `radius-pill`, 비활성 `var(--fg-faint)`, 활성 `var(--accent)`
- 노브 `20×20`, `background: var(--surface)`, `border: 1px var(--border-strong)`, 활성 시 `translateX(20px)`
- 구현은 `sr-only` 체크박스 + `peer-checked:` 조합이다(별도 JS 상태 없음)

### 6.5 태그 / 칩 / 뱃지
- 기본 태그: `padding: 2px 8px`, `radius-sm`, 배경 `var(--surface-alt)`, 텍스트 `var(--fg-muted)`, `12px / 500`
- 필터 칩: `radius-pill`, `13px / 500`, 비선택 `surface-alt + fg-muted`, 선택 `surface + fg + 700`
- `OfficialBadgeChip`: `radius-sm`, `background: var(--fg)`, `px-2 py-0.5`, `12px / 700`, 아이콘 12px
- `OfficialAvatarBadge`: `radius-pill`, `height: 18px`, `10px`, `background: var(--accent)`, `px-2`
- 알림 도트: `8×8`, `radius-pill`, `background: var(--accent)`
- 화면 최상위에서 큰 콘텐츠 묶음을 전환하는 버튼은 칩이 아니라 `TextTabBar`를 쓴다.

### 6.6 하이라이터 — `.hl` + `.hl-*`
```html
<span class="hl hl-yellow">단어</span>
```
- `.hl`: `padding: 0 4px`, `border-radius: var(--radius-sm)`, `box-decoration-break: clone`
- 텍스트 색은 부모 상속(검정 유지)
- **카테고리 매핑 강제**: 노랑=Official, 파랑=Seminar, 그린=Meetup, 빨강=강조
- **사용처는 `CommunityApp.tsx` 뿐이다.** `OfficialBadgeList.test.ts`가 커뮤니티 밖에서 `hl-yellow`가 쓰이지 않음을 단언한다 — 이 경계를 깨지 않는다.

### 6.7 카드 — `.ds-card`
- `border: 1px solid var(--border)`, `radius: var(--radius-lg)`, `background: var(--surface)`, `padding: 20px`, **`box-shadow: none`**
- **콘텐츠 목록에 카드뷰를 쓰지 않는다.** Events / Event Reviews / Recipe / Q&A / Partner Promotions / Partner Reviews 목록은 §6.8 리스트 행을 쓴다.
- 카드는 폼 내부 보조 패널, 상태 안내, 모달 내부 정보 묶음처럼 "목록이 아닌 단일 정보 블록"에만 쓴다.

### 6.8 리스트 아이템 (콘텐츠 행)
```
[썸네일] [헤드라인 + 메타/칩] [우측 메타/액션]
```
행 자체는 아직 도메인 화면(`CommunityApp` 등)에 로컬 구현되어 있고, 메타 조각만 공통이다.

- 제목 `18px / 700 / line-height 1.3`. 목록 화면과 홈 섹션 목록 모두 동일.
- gap 16px, vertical center, py 0–8px.
- `ViewCountMeta`(공통): `h-8`, `grid-cols-[17px_auto] gap-1`, 아이콘 17px, 숫자 `12px tabular-nums var(--fg-muted)`, 1000 이상은 `k` 축약.
- `DetailAuthorMeta`(공통): 아바타 `44×44 pill`, 이름 `14px / 700`, 날짜 `13px`, 소속 `12px`, `gap: 12px`.
- 우측 메타 컬럼은 52px. 하트+댓글을 함께 보여주는 행은 112px 안에서 `52px + 52px` 슬롯을 고정해, 세로로 스캔할 때 하트끼리·댓글끼리 같은 x축에 오게 한다. 같은 목록에 두 형태가 섞이면 **모든 행을 112px로 예약**한다.
- 숫자는 `tabular-nums`로 두고 줄바꿈시키지 않는다.
- **헤드라인 하이라이터는 커뮤니티 탭 한정.** 다른 탭의 리스트 타이틀은 평문(`--fg-strong`)이다.

### 6.9 캘린더 (`CommunityApp`)
- 7열 그리드(`grid-cols-7`), 셀 높이 `80px`(`h-20`)
- 요일 헤더 `12px`, `var(--fg-subtle)`, 중앙 정렬
- 일자 `14px`, 원형 `32×32`(`h-8 w-8 radius-pill`), 비당월 `var(--fg-faint)`
- **오늘**: `background: var(--accent)`, 흰 텍스트, 700
- 이벤트 막대: 날짜 아래 `10px / leading-3`, `.hl` + 카테고리 `hl-*` 배경, 한 주에 **최대 2행**(`grid-rows-2`), 초과분은 `+N`
- 여러 날 일정은 같은 주 안에서 하나의 연속 막대로 그린다. 시작/끝에서만 `radius-sm`을 주고(`rounded-l` / `rounded-r`), 주 경계에서는 다음 주 행에 새 구간을 만든다
- 날짜 선택 시트의 날짜 버튼은 `44×44`(`h-11 w-11`) pill

### 6.10 내비게이션

**TopAppBar** — 전용 공통 컴포넌트는 아직 없고, 아이콘 그룹만 `HeaderIconActions`로 공통화되어 있다.
- 레이아웃: `[메뉴/뒤로] [BLENDING(.logo-wordmark, center)] [알림·검색]`
- `HeaderIconActions`: 컨테이너 `h-11 w-[84px]`, 버튼 각 `44×40`, Bell 23px, Search 24px, 미읽음 도트 `8×8 pill accent`
- 로고는 가운데 컬럼 중앙 정렬. 아이콘과 겹치면 아이콘 컬럼 폭을 먼저 조정한다

**TextTabBar** (`web/src/ui/shared/TextTabBar.tsx`) — 최상위 콘텐츠 전환의 **유일한 패턴**
- 높이 `56px`(`h-14`), 좌우 패딩 `24px`(`px-6`), 탭 간격 `36px`(`gap-9`)
- `font-size: 16px`, `line-height: 1.4`, 가로 스크롤(`scrollbar-none`)
- 활성 `font-bold text-[var(--accent)]` / 비활성 `font-normal text-[var(--fg-subtle)]`
- 카운트는 라벨 옆 `tabular-nums` span. 괄호나 구분자를 붙이지 않고, 자릿수 때문에 탭 위치가 흔들리지 않게 한다
- **배경 pill, 카드, 보더, 하단 인디케이터 라인을 만들지 않는다.** 텍스트 색과 무게만으로 상태를 구분한다
- 적용 대상: Partner Lounge `홍보관/리뷰관`, Community `CALENDAR/RECIPE/Q&A`, MyPage `게시글/댓글`, `즐겨찾기`, `내 관심 글`, `FAQ 분류` 등
- 2차 필터(장비 카테고리, 이벤트 유형, 폼 내부 선택지)는 칩으로 유지한다

**BottomNav** (`web/src/ui/shared/BottomNav.tsx`)
- 셸: `px-5 pt-3 pb-[calc(var(--app-safe-area-bottom)+10px)]`, `border-top: 1px var(--border)`, `bg-[var(--surface)]/95`, `backdrop-blur-xl`, `shadow-[var(--shadow-nav)]`
- 아이템: `height: 40px`, `radius: var(--radius-lg)`, 아이콘 `32px`(Material Symbols)
- 활성 `var(--accent)` / 비활성 `var(--fg-subtle)`, active 시 `scale(0.98)`
- **슬롯 5개 고정 순서**: `location_on`(내주변) → `groups`(커뮤니티) → `home`(홈) → `local_cafe`(파트너) → `person`(프로필)
- **불변 규칙**: 아이콘 전용이다. 시각적 텍스트 라벨을 넣지 않는다(접근성 이름은 `aria-label`로 제공). 레퍼런스 시안에 라벨이 보여도 추가하지 않는다
- 현재 도메인 아이콘 하나만 accent로 활성화한다. 특정 슬롯에만 라벨·배지·다른 크기·다른 y-position을 주지 않는다
- 화면별 시안을 근거로 새 하단바를 만들지 말고 이 컴포넌트를 재사용한다
- 하단 고정 UI는 `--app-bottom-nav-height`를 기준으로 위치를 잡는다

### 6.11 모달 / 바텀시트 / 팝업
- `ConfirmDialog`, `ReportDialog`: 네이티브 `<dialog>`, `backdrop: rgba(0,0,0,0.35)`, 카드 `radius-xl`, `padding: 20px`, `background: var(--surface)`
- `AppPopupHost`(`appPopup.module.css`): 바텀시트형 — `border-radius: var(--radius-xl) var(--radius-xl) 0 0`, `box-shadow: var(--shadow-modal)`, backdrop `color-mix(in srgb, var(--fg) 40%, transparent)`
- `PostcodeSearchField`: 풀스크린 시트 — radius 없음, `shadow-[0_0_0_1px_var(--border)]`
- 구조: 헤더(제목) + 본문 + 하단 버튼 그룹
- 바텀시트 그랩 핸들: `h-1 w-10 radius-pill`

### 6.12 토스트
- 하단 고정, `radius: var(--radius-lg)`, `background: var(--fg)`, `color: var(--surface)`, `padding: 12px 16px`, `14px / 700`, `box-shadow: var(--shadow-modal)`
- 위치: `bottom-[calc(env(safe-area-inset-bottom)+24px)]` 또는 BottomNav 위, `max-w-[var(--app-shell-max-width)] px-6`
- 자동 디스미스는 소스별로 Login 2600ms / Partner 2400ms / Map 2400ms / 홈 일부 1800ms로 동작한다. 액션 텍스트 없음
- **현재 `LoginApp` / `PartnerApp` 등에 각각 로컬 복제되어 있다.** 다음에 토스트를 건드릴 때 `web/src/ui/shared/`로 추출하고 사용처를 함께 교체한다

### 6.13 페이지네이션
```
1  2  3  4  5
```
- `totalPages <= 1`이면 영역 전체를 렌더하지 않는다. `1 >`처럼 단일 페이지 + 화살표만 남기지 않는다
- 숫자 `14px`, 간격 `gap-7`(28px). 현재 페이지 `font-bold text-[var(--accent)]`, 나머지 `text-[var(--fg-muted)]`
- 페이지 버튼은 1~5번만 고정 표시하고 초과분은 `…`
- CommunityApp에는 withArrows=false 옵션의 왼쪽화살표 코드만 있고 현재 호출부에서는 사용하지 않는다. PartnerApp에는 화살표가 없다.
- `tabular-nums`는 PartnerApp 숫자에만 적용된다
- CTA와 함께 쓰면 페이지네이션 아래 여백 최소 40px, CTA 그룹 내부 gap 12px

### 6.14 스켈레톤 / 로딩
- 스켈레톤: `animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-alt)]`
- 전역 라우트 로딩: `GlobalLoadingBar`(`startGlobalLoading` / `stopGlobalLoading`) + `.global-loading-overlay`(`color-mix(in srgb, var(--surface) 82%, transparent)` + `blur(6px)`) + 커피컵 진행 애니메이션(`96×71`, clip-path 기반)

---

## 7. 레이아웃

### 7.1 컨테이너 — 모바일 단일 폭
- `--app-shell-max-width: 100vw`. 도메인 App 루트가 `max-w-[var(--app-shell-max-width)] mx-auto`로 소비한다.
- **데스크톱용 축소 컨테이너나 사이드바 레이아웃은 구현되어 있지 않다.** 웹은 앱 WebView와 같은 모바일 폭 화면을 그대로 쓴다.
- 좌우 gutter는 `px-6`(24px)가 기본.
- 넓은 화면 레이아웃이 필요해지면 브레이크포인트를 즉흥으로 넣지 말고 `--app-shell-max-width`부터 정하고 이 절을 고친다.

### 7.2 뷰포트
`app/layout.tsx`: `lang="ko"`, `maximumScale: 1`, `userScalable: false`, `viewportFit: "cover"`. `GlobalZoomGuard`가 핀치줌을 막는다 — 앱 WebView와 동작을 맞추기 위한 것이니 해제하지 않는다.

### 7.3 페이지 구조
1. TopAppBar (sticky)
2. TextTabBar (필요 시, sticky)
3. Section heading + 짧은 보조 텍스트
4. Body 콘텐츠
5. BottomNav (fixed)

### 7.4 섹션 헤더 패턴
```
[H2 18-20px bold]                        [icon-only ghost button]
────────────────────────────────────────  (1px var(--border))
```
우측 액션은 32×32 ghost, 색상 `var(--fg-muted)`.

### 7.5 그리드 정렬
모든 요소는 4px 그리드에 맞춘다. 카드 내부는 8px 그리드까지 허용.

### 7.6 도메인 라우트
`web/app/`: `chat` · `community` · `home` · `login` · `map` · `mypage` · `open` · `partner` · `profile` · `signup` · `store-login` (+`api`, `bridge-test`).

---

## 8. 모션
- 기본 트랜지션 `150ms ease-out`, 시트/모달 `200–220ms ease-out`, 패널 진입 `360ms`
- active scale: `0.95`(아이콘 버튼) / `0.98`(블록 버튼, BottomNav 아이템)
- 정의된 키프레임: `member-slide-in`(220ms, translateX 28px→0), `comment-action-sheet-in`(220ms, translateY 100%→0), `barista-directory-slide-in`(360ms, clip-path), `map-user-location-pulse`(2.8s infinite), `chat-send-progress`
- `@media (prefers-reduced-motion: reduce)`에서 위 애니메이션을 모두 무력화한다. **새 애니메이션을 추가하면 이 블록에도 반드시 추가한다**

---

## 9. 아이콘
현재 3계열을 혼용한다. 새 아이콘은 아래 우선순위로 고른다.

1. **Material Symbols Outlined / Filled** — 내비게이션과 시스템 아이콘. `.material-symbols-outlined` 클래스, 기본 `24px / weight 300`. 채움 상태는 `.filled` 클래스를 덧붙여 전환한다(가변 폰트가 아니라 **아웃라인/채움 2벌을 self-host**하므로, `.filled`가 `font-family`를 Filled 파일로 바꾸고 `FILL 1`을 함께 지정한다)
2. **lucide-react** (`^1.14.0`) — 그 외 UI 아이콘. `size` prop으로 크기 지정
3. **자체 SVG** — 브랜드 아이콘 전용(`SocialBrandIcons.tsx`). 브랜드 고유색 hex는 여기서만 허용

색상: 기본 `--fg`, 보조 `--fg-subtle`, 활성/긍정 `--accent`, 위험 `--danger`.
이모지를 아이콘 대용으로 쓰지 않는다.

---

## 10. i18n & 접근성
- 기본 언어는 한국어(`lang="ko"`). iOS 지원 언어도 한국어로 선언되어 있다
- 영문 카테고리(CALENDAR / RECIPE / Q&A)는 ALL CAPS + `0.16em` tracking
- 아이콘 전용 버튼에는 반드시 `aria-label`을 준다(BottomNav, HeaderIconActions 참조)
- 본문과 핵심 문구를 작은 회색 텍스트에 의존시키지 않는다. 색만으로 의미를 전달하지 않는다
- 좌우 여백/포지셔닝은 가능한 한 logical property(`padding-inline-start` 등)를 쓰고, 사용자 생성 콘텐츠에는 `dir="auto"`를 준다

---

## 11. 색 하드코딩 예외
`var(--토큰)` 대신 hex를 쓸 수 있는 경우는 셋뿐이다. 그 밖의 hex는 리뷰에서 되돌린다.

1. **canvas 렌더링** — `ProfileSwipeCard`처럼 Canvas API가 CSS 변수를 읽을 수 없는 경우
2. **브랜드 고유색** — `SocialBrandIcons.tsx`의 Instagram/Threads/YouTube 그라디언트
3. **`ResumeModal`** — 앱 토큰과 의도적으로 분리된 인쇄형 이력서 팔레트

---

## 12. 인쇄
`@media print`: A4 12mm 마진, `.business-card-print-root`만 노출, `.business-card-print-actions`는 숨김. 명함 텍스처는 `business-card-paper-texture`(SVG feTurbulence 노이즈, `opacity 0.15`, `multiply`).

---

## 13. Do / Don't

### Do
- ✅ 흰 배경 + 검정 텍스트 + 빨강 강조 1회
- ✅ 색·반경·폰트·그림자는 `var(--토큰)`으로만
- ✅ 타입은 `.ds-*` 클래스 재사용
- ✅ 영문 ALL CAPS에 `0.16em` tracking
- ✅ 로고만 Galmuri11, 본문은 SeoulNamsan
- ✅ 하이라이터 4색은 **커뮤니티 탭에서만**
- ✅ 카드는 flat — 그림자 대신 1px 보더로 분리
- ✅ Primary CTA는 풀폭 + accent + `radius-lg`, 페이지당 1개
- ✅ 아이콘 전용 컨트롤에 `aria-label`
- ✅ 새 애니메이션은 `prefers-reduced-motion` 블록에도 등록

### Don't
- ❌ 새 색·새 토큰 발명
- ❌ Tailwind 기본 팔레트 클래스(`text-gray-500` 등) 사용
- ❌ 빨강 한 화면에 3회 이상
- ❌ 본문·탭·버튼에 Galmuri11
- ❌ 일반 화면에 Pretendard / Bodoni Moda 끌어오기
- ❌ 카드에 그림자(elevation) 추가
- ❌ `radius-xl`(12px) 초과 (pill 제외)
- ❌ 한 화면에 4개 초과 폰트 사이즈
- ❌ 그라데이션 배경
- ❌ 이모지를 의미 전달 수단으로 사용
- ❌ 커뮤니티 탭 밖에서 `hl-yellow` / `hl-blue` / `hl-green` 사용
- ❌ 카테고리 분류가 없는 리스트 타이틀에 하이라이터를 장식으로 적용
- ❌ BottomNav에 텍스트 라벨 추가, 순서 변경, 별도 하단바 신설
- ❌ TextTabBar에 pill / 카드 / 보더 / 인디케이터 라인 추가

---

## 14. 미구현 — 규격을 만들기 전에 확인할 것

아래는 **현재 코드에 존재하지 않는다.** 필요해지면 즉흥 구현하지 말고, 토큰과 공통 컴포넌트를 먼저 만든 뒤 이 문서를 같은 커밋에서 고친다.

| 항목 | 현재 상태 |
|---|---|
| **다크 모드** | `web/` 전체에서 `data-theme`, `prefers-color-scheme`, Tailwind `dark:` 사용 **0건**. 다크 팔레트 토큰도 없다. 라이트 단일 팔레트다 |
| **플로팅 라벨 입력** | 구현 없음. `.ds-input`은 placeholder 방식이다 |
| **데스크톱 컨테이너 / 사이드바** | `--app-shell-max-width: 100vw`. 반응형 브레이크포인트 레이아웃 없음 |
| **공통 TopAppBar** | `HeaderIconActions`만 공통. 헤더 셸은 화면마다 로컬 구현 |
| **공통 리스트 행 / 페이지네이션 / 토스트** | 도메인 화면에 로컬 복제. 다음에 손댈 때 `web/src/ui/shared/`로 추출한다 |
| **Tailwind `@theme` 연결** | 토큰이 Tailwind theme에 등록되어 있지 않아 `text-accent` 같은 유틸리티는 쓸 수 없다 |

---

## 15. 앱별 토큰 차이 (`admin` / `homepage`)

토큰 **이름은 세 앱이 동일**하다. 값만 다르므로, 코드는 항상 `var(--토큰)`으로 쓰면 각 앱에서 알아서 맞는 값이 나온다. **컴포넌트를 앱 사이에 옮길 때 hex를 옮기지 말 것.**

### 15.1 admin — 운영 콘솔용 저자극 팔레트
| Token | web | admin |
|---|---|---|
| `--bg` | `#ffffff` | `#f6f6f8` |
| `--surface-alt` | `#fafafa` | `#f3f3f6` |
| `--fg` | `#000000` | `#232327` |
| `--fg-strong` | `#000000` | `#141417` |
| `--fg-muted` | `#6b7280` | `#5f5f68` |
| `--fg-subtle` | `#9ca3af` | `#8e8e97` |
| `--fg-faint` | `#d1d5db` | `#d2d2d9` |
| `--border` | `#f3f4f6` | `#ececf0` |
| `--border-strong` | `#e5e7eb` | `#dddde3` |
| `--border-dashed` | `#d1d5db` | `#cfcfd6` |
| `--accent` | `#ff0000` | `#e5484d` |
| `--accent-hover` | `#e10000` | `#cf3a3f` |
| `--accent-soft` | `rgba(255,0,0,0.2)` | `rgba(229,72,77,0.12)` |
| `--hl-red` | `rgba(255,0,0,0.2)` | `rgba(229,72,77,0.16)` |
| `--danger` | `#dc2626` | `#d64545` |
| `--font-body` / `-display` / `-label` | SeoulNamsan | **Pretendard** |
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.04)` | `0 1px 2px rgba(20,20,26,0.05)` |
| `--shadow-modal` | `0 8px 32px rgba(0,0,0,0.12)` | `0 16px 48px rgba(20,20,26,0.16)` |
| `--shadow-nav` | `0 -4px 20px rgba(0,0,0,0.02)` | `0 -4px 20px rgba(20,20,26,0.04)` |
| `--radius-sm / md / lg / xl` | `2 / 4 / 8 / 12px` | `3 / 6 / 10 / 16px` |

동일: `--surface` `--surface-high` `--hl-yellow` `--hl-blue` `--hl-green` `--dot-*` `--success` `--warn` `--info` `--font-logo` `--font-mono` `--radius-pill` `--app-*`.

**admin 규칙**: 운영자가 오래 보는 화면이라 순검정·순빨강 대신 채도를 낮춘 팔레트를 쓴다. 본문은 Pretendard, 로고만 Galmuri11. 반경이 web보다 한 단계 크다.

### 15.2 homepage — web 팔레트의 축약 복제
- Surface/Foreground/Border/Accent/`--radius-*`는 **web과 동일한 값**이다(표기만 대문자 hex).
- 정의되지 않은 토큰: `--surface-alt` 외 하이라이터 `--hl-*`, `--dot-*`, semantic(`--success` 등), `--font-display` / `--font-label` / `--font-mono`, `--shadow-*`, `--app-*`.
- `@font-face`는 SeoulNamsan 4종 + **Galmuri11 700만** 선언되어 있다. Material Symbols와 Pretendard는 로드하지 않는다.
- **homepage에서 위 미정의 토큰을 쓰지 말 것.** 필요하면 `homepage/app/globals.css`에 web과 같은 이름·값으로 먼저 추가한다.

---

## 16. 명세서를 받았을 때 적용 순서
1. **공통 컴포넌트 확인**: `rg`와 `code-review-graph`로 `web/src/ui/shared/`와 유사 UI를 먼저 찾는다. 있으면 재사용, 없으면 재사용 가능한 최소 컴포넌트를 먼저 만든다
2. **레이아웃**: 모바일 폭 기준으로 화면 종류를 정한다(페이지 / 리스트 / 폼 / 모달)
3. **셸 부착**: TopAppBar + (필요 시) TextTabBar + BottomNav. 하단 고정 요소는 `--app-bottom-nav-height` 기준
4. **섹션 분할**: `.ds-h2` 헤더 + 디바이더, 섹션 간 32px
5. **리스트/카드 선택**: 콘텐츠 목록은 §6.8 리스트 행, 단일 정보 블록만 §6.7 카드
6. **CTA 배치**: Primary는 페이지당 1개, 본문 하단 풀폭 `.ds-btn .ds-btn-primary`
7. **카테고리 표시**: 커뮤니티 탭 내부일 때만 하이라이터 4색 매핑. 그 외 탭은 평문 + 칩/뱃지
8. **체크리스트(§13) 통과** 후 `pnpm lint`, `pnpm typecheck`, `pnpm format`
