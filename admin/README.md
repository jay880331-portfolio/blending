# Blending Admin

PC 운영자를 위한 별도 Next.js 앱이다. 데이터 변경은 모두 `web`의 `/api/admin` API를 통해 수행한다.

## 로컬 실행

```bash
pnpm install
pnpm dev:admin
```

Admin은 `http://localhost:3001`에서 실행된다. Web API의 `ADMIN_ORIGIN`, Admin 앱의 `NEXT_PUBLIC_WEB_ORIGIN`, 양쪽의 Admin 인증 설정이 일치해야 한다.

## 검증

```bash
pnpm --filter @blending/admin lint
pnpm --filter @blending/admin typecheck
pnpm --filter @blending/admin test
pnpm --filter @blending/admin build
```

staging smoke는 저장소 루트의 `.github/workflows/admin-smoke.yml`에서만 실행한다. 필요한 secret과 운영 절차는 [Admin 운영 문서](../docs/admin-operations.md)를 따른다.
