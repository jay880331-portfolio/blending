# Admin 배포·운영 절차

## 필수 환경 변수

- Web: `MONGODB_URI`, `MONGODB_DB`, `ADMIN_AUTH_SECRET`, `ADMIN_ORIGIN`, `CRON_SECRET`
- Admin: `NEXT_PUBLIC_WEB_ORIGIN`
- staging smoke: `ADMIN_SMOKE_BASE_URL`, `ADMIN_SMOKE_LOGIN_ID`, `ADMIN_SMOKE_PASSWORD`, `MONGODB_URI`, `MONGODB_DB`

값은 Vercel·GitHub Environment secret에만 저장하고 저장소에 기록하지 않는다.

## 배포 전 Go/No-Go

1. Atlas on-demand snapshot을 생성하고 snapshot ID를 변경 기록에 남긴다.
2. `pnpm --filter @blending/web admin:indexes`를 실행한다. 모든 인덱스가 `created` 또는 `existing`으로 끝나야 한다.
3. `pnpm --filter @blending/web migrate:guide-content -- --dry-run` 결과를 검토한 뒤 `--apply`한다.
4. 최초 관리자만 `pnpm --filter @blending/web admin:bootstrap -- --phone <번호> --dry-run`을 검토한 뒤 `--apply`한다.
5. Web Admin API를 staging에 배포한다.
6. 비로그인 요청 401, 일반 사용자 요청 403, Admin session 요청 200을 확인한다.
7. Admin을 staging에 배포하고 `Admin staging smoke` workflow를 실행한다.
8. Admin을 운영에 배포하고 운영 도메인을 연결한다.
9. 운영에서 login, list, detail, soft-delete, restore, audit 순으로 smoke한다. 모두 통과할 때만 Go다.

인덱스·bootstrap 명령은 재실행 가능하다. smoke fixture 명령은 `ADMIN_SMOKE_ENABLED=true` 없이는 실행되지 않으며 고정 ID와 `smokeFixture: true`가 모두 맞는 문서만 제거한다.

## 롤백

- Admin UI 장애: Admin Vercel의 직전 정상 deployment를 Promote한다.
- Admin API 장애: Web Vercel의 직전 정상 deployment를 Promote한다.
- additive field, 감사 로그, 이름 있는 index는 롤백 기간 동안 유지한다.
- 소프트 삭제 데이터는 복구 API로 원복한다.
- 감사 로그는 삭제하거나 되돌리지 않는다.
- 데이터 손상이 의심되면 Admin write를 운영 정책에서 차단한다. Atlas snapshot을 별도 DB로 복원하고 문서 단위 비교 후 필요한 문서만 복구한다.

롤백 후에도 401/403/200 인증 경계와 읽기 smoke를 다시 확인한다.
