# Vercel Production Checklist

이 프로젝트는 자체 서명 JWT를 `blending_session` HTTP-only 쿠키에 담아 로그인 상태를 유지한다. Vercel 운영/프리뷰 환경에서는 아래 항목이 맞아야 기존 세션이 계속 검증된다.

## 인증

- `AUTH_SECRET`을 Production과 Preview 환경에 모두 설정한다.
- `AUTH_SECRET`은 배포마다 바뀌지 않는 긴 랜덤 문자열이어야 한다.
- 기존 호환이 필요할 때만 `JWT_SECRET`을 사용하고, 신규 설정은 `AUTH_SECRET`으로 통일한다.
- `NEXT_PUBLIC_SITE_URL`은 실제 대표 HTTPS 도메인으로 설정한다. 소셜 로그인 Redirect URI도 같은 도메인을 등록한다.
- Admin API에는 배포마다 유지되는 `ADMIN_AUTH_SECRET`과 정확한 Admin HTTPS origin인 `ADMIN_ORIGIN`을 설정한다.
- Admin 프로젝트에는 Web 배포 URL을 `NEXT_PUBLIC_WEB_ORIGIN`으로 설정한다. 일반 Web 세션과 Admin 세션 secret·cookie는 공유하지 않는다.

## MongoDB

- `MONGODB_URI`는 Atlas의 애플리케이션 연결 문자열을 사용한다.
- `MONGODB_DB`를 운영 DB 이름으로 명시한다. 없으면 기본값은 `blending`이다.
- `CRON_SECRET`을 설정한다. Vercel Cron이 매일 `/api/internal/search/reconcile`을 호출해 검색 색인 누락을 복구한다.
- Vercel 함수 인스턴스가 살아있는 동안 `MongoClient`는 전역 Promise로 재사용된다. 콜드 스타트나 새 인스턴스에서는 재연결이 발생할 수 있다.
- 새 운영 DB를 붙인 뒤에는 `pnpm backfill:search`로 `search_documents`를 1회 채운다.
- Admin 배포 전 `pnpm --filter @blending/web admin:indexes`를 실행한다.

## Admin 배포

snapshot, migration, bootstrap, staging smoke, 운영 smoke와 롤백 순서는 [Admin 운영 문서](./admin-operations.md)를 따른다.

## 속도 확인

- 로그인 직후 느리면 `/api/member` 응답 시간을 먼저 본다. 이 경로는 회원 프로필, 경력, 포트폴리오, 알림, 관심 항목을 여러 컬렉션에서 병렬로 읽는다.
- 검색이 느리면 `search_documents` 문서 수와 text index 응답 시간을 확인한다. 큰 데이터셋이나 한국어 부분검색 품질이 중요해지면 Atlas Search 전환을 검토한다.
