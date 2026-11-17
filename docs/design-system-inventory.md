# 디자인 시스템 코드·렌더링 인벤토리

본 문서는 실제 소스코드와 부분 브라우저 실측에 기반한 산출물 기록이며, 전수조사·전상태실측·전체도입완료가 아닙니다.

- **기준 증거**: [20260905-design-browser-baseline.md](../.graphops/evidence/20260905-design-browser-baseline.md) (4개 화면 기준선), [20260905-design-browser-after.md](../.graphops/evidence/20260905-design-browser-after.md) (로그인/파트너/프로필 확인)
- **분류 원칙**: `source 선언`, `계산값(computed)`, `기존문서 차이`, `현행유지 결정`, `미검증`을 구분하며, 실제 측정되지 않은 상태는 빈칸 대신 '미측정'으로 표기합니다.

## 1. 공통 기본 컴포넌트 API (`web/src/ui/shared/`)

| 컴포넌트 / 모듈                                                                                              | source 선언 API                                                                                                        | 현행 상태 및 차이                                                                | 현행유지 / 미구현 상태                                      |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Button.tsx](../web/src/ui/shared/Button.tsx), [buttonClassName.ts](../web/src/ui/shared/buttonClassName.ts) | variant(`primary`\|`secondary`\|`ghost`\|`base`), 기본 `type="button"`, `pending` 시 `disabled` 및 `aria-busy="true"`  | 64px CTA 중심 선언. 실제 호출부(LoginApp 등)는 기존 `disabled={submitting}` 유지 | `size`·`danger` 미구현. 호출부 pending API 일괄 연결 미적용 |
| [LinkButton.tsx](../web/src/ui/shared/LinkButton.tsx)                                                        | NextLink 래퍼 `LinkButton`, 일반 `<a>` 태그 래퍼 `AnchorButton` 별도 분리                                              | variant 클래스 공유, DOM 시맨틱 보존                                             | 기존 a/Link 호출 구조 유지                                  |
| [Input.tsx](../web/src/ui/shared/Input.tsx)                                                                  | `Input`, `Textarea`, `Select` 별도 native tag forwardRef, variant `standard`(=`ds-input`), `partner`(=`partner-input`) | ref 및 native props 전달                                                         | 입력창 외형 일괄 강제 없이 variant 분기 유지                |
| [Field.tsx](../web/src/ui/shared/Field.tsx)                                                                  | `FieldLabel`(variant `standard`\|`profile`, `caps`), `PartnerField`(label, hint, children 기존 wrapper)                | PartnerField 기존 구조 보존                                                      | `Field error` 자동 연결 미구현                              |

## 2. 브라우저 실측 렌더링 현황

| 화면 / 뷰포트                         | 대상 요소     | 계산값 (Computed Style)                                                                                | 기존문서([DESIGN.md](../DESIGN.md)) 대비 | 검증 상태                                                                                                           |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 로그인 (/login/phone, 390)            | input         | 342×55.59375, r4, 16px, line 25.6 (focus: border 1.5px, 높이 56.59375로 +1px)                          | 문서 규격 대비 focus 시 높이 1px 증가    | 빈 입력 오류('정보를 정확히 입력해주세요'), pending disabled, 정상 로그인 확인 (360폭 312 / 768폭 720 폭 적응 확인) |
| 로그인 (/login/phone, 390)            | button        | 342×64, r8, font 18px, line 21.6, padding 20px 28px, SeoulNamsan                                       | 문서 규격과 일치                         | 정상 렌더링 및 pending 시 disabled 관찰                                                                             |
| 파트너 (/partner/promotions/new, 390) | 일반/설명/URL | 일반 input 342×54(font 16), 설명 textarea 342×160(font 12), URL·검색태그 342×48(font 12)               | 16px/12px variant 차이                   | 전환 전후 일치 확인 (360폭 312 / 768폭 720 가로 넘침 없음)                                                          |
| 파트너 (/partner/promotions/new, 390) | 등록 button   | 342×64, r8, font 18px, 검정 배경 / 흰 글자, disabled opacity 0.4                                       | 빨간 primary와 다른 변형                 | disabled 관찰 완료 (빨간 primary 규칙 강제 통일 금지)                                                               |
| 프로필 (/home/profile/edit, 390)      | 입력/CTA      | 일반 input 48px(r8), 주소 48px(r4), 원두 44px(font 15), 설명 textarea 144px(line 28), save button 64px | 높이/반경 다변화                         | 전환 전후 유지 확인 (FieldLabel 중복 오류 해소)                                                                     |
| 캘린더 (/community/calendar, 390)     | 탭/헤더/바    | TextTabBar nav 56px(gap 36px, font 16px), 로고 Galmuri11 25px, BottomNav 87px                          | 문서 추정치와 계산값 차이                | baseline만 확인 (after 미측정)                                                                                      |
| 공통 미측정/미검증                    | 전체          | 실제 측정되지 않은 계산값 상태는 모두 '미측정' 표기                                                    | -                                        | iOS/Android WebView, Enter/ref, 긴 문구 오버플로우, 전 컴포넌트·상태 미검증                                         |

## 3. 의미별 예외 및 현행유지 정책

- **화면별 UI 변형 보존 및 추후 판단**: 프로필 Tailwind 입력, OTP 입력, partner-textarea, Review underline input, 아이콘·칩·페이지 숫자, 작은 ConfirmDialog는 '의도적 구현'으로 단정하기보다 화면 맥락에 맞춘 현행 변형을 보존하고 추후 판단합니다. 작은 대화상자 버튼의 64px 미준수를 즉시 결함으로 단정하지 않습니다.
- **배경·글자크기·지속시간**: 화면별 배경색(transparent/surface), 글자 크기(16px/12px), 지속시간 차이를 자동 결함이나 무조건 통일 대상으로 분류하지 않습니다.
- **토스트 지속시간**: LoginApp 2600ms, PartnerApp 2400ms, MapApp(`web/src/ui/map/MapApp.tsx` `showLocationToast`) 실제 2400ms, 홈 일부 1800ms는 소스 관찰값이자 현행 유지 정책입니다 (기존 2000ms 표기는 실제 소스 2400ms로 정정).
- **페이지네이션 현황**: `web/src/ui/community/CommunityApp.tsx`와 `web/src/ui/partner/PartnerApp.tsx` 두 화면 모두 1~5 페이지 번호가 고정 노출됩니다. CommunityApp은 `withArrows=false` 옵션에만 왼쪽 버튼(`<ChevronLeft />`) 코드가 구현되어 있으나 현재 호출부에서 켜지 않고 있으며, PartnerApp은 화살표 버튼 코드가 없습니다. '심각한 결함' 등의 주관적 단정이나 임의 자동 변경을 하지 않고 현행 동작을 정확히 유지·기록합니다.
- **문서 stale 해결 및 남은 정적 예제 불일치 구분**: [docs/design-system.html](design-system.html)에서 실제 없는 폰트 경로를 실제 파일(`../web/public/fonts/`)로 연결하고 다크 모드 토큰([data-theme="dark"])·토글 기능을 제거한 것은 이번 동기화에서 해결했습니다. 반면 HTML 문서 내 세부 폼 예제 등은 정적 참고 예제로서 아직 모든 제품 컴포넌트·상태와 완전 동기화되지 않은 '남은 정적 예제 불일치'로 구분합니다. 인쇄 전용 Pretendard([pretendard.css](../web/src/ui/shared/pretendard.css))는 국소 예외 현황으로 유지합니다.
- **후속 과제**: 토스트·페이지네이션·헤더 공통화, 디자인 자동검사, [DESIGN.md](../DESIGN.md)/HTML 완전 동기화, admin/homepage 표준화는 후속 단계로 분리합니다.
