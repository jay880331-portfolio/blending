# 소셜 로그인 연동 가이드

BLENDING 소셜 로그인은 Next.js API Route에서 OAuth를 시작하고 콜백에서 세션 쿠키를 발급합니다.
앱 WebView에서는 카카오/네이버 버튼을 누를 때 네이티브 SDK로 access token을 받은 뒤 `/api/auth/social/native`에서 동일한 세션 발급 흐름을 사용합니다.

## 공통 환경변수

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=openssl-rand-hex-32
MONGODB_URI=mongodb+srv://...
MONGODB_DB=blending
```

`NEXT_PUBLIC_SITE_URL`은 배포 도메인으로 교체합니다. 콜백 URL은 아래 형식입니다.

```text
{NEXT_PUBLIC_SITE_URL}/api/auth/social/kakao/callback
{NEXT_PUBLIC_SITE_URL}/api/auth/social/naver/callback
{NEXT_PUBLIC_SITE_URL}/api/auth/social/apple/callback
```

## Kakao

### Web OAuth

1. Kakao Developers에서 앱을 만들고 REST API 키를 확인합니다.
2. 카카오 로그인 활성화 후 Redirect URI에 `/api/auth/social/kakao/callback` 주소를 등록합니다.
3. 동의항목에서 닉네임, 프로필 이미지를 필요한 범위로 설정합니다.

이메일은 필수로 요청하지 않습니다. Kakao Developers에서 이메일 동의항목을 설정하지 않은 상태로 `account_email` scope를 요청하면 카카오가 인가 요청을 거부합니다.

```bash
KAKAO_CLIENT_ID=rest_api_key
KAKAO_CLIENT_SECRET=optional_client_secret
```

### App Native SDK

앱에서 카카오톡이 설치되어 있으면 카카오톡 앱 로그인으로 열리고, 설치되어 있지 않으면 카카오 계정 로그인으로 fallback됩니다.

1. Kakao Developers > 앱 설정 > 앱 키에서 Native app key를 확인합니다.
2. Kakao Developers > 플랫폼에 앱 패키지를 등록합니다.
   - Android package: `com.blending.app`
   - iOS bundle id: `com.blending.app`
3. Android 플랫폼에는 테스트/배포에 사용하는 키 해시를 등록합니다. debug keystore 기준 예시는 아래와 같습니다.

```bash
keytool -exportcert -alias androiddebugkey -keystore app/android/app/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64
```

4. 앱 빌드 환경에 Native app key를 넣고 다시 빌드/설치합니다.

```bash
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=native_app_key
```

## Naver

### Web OAuth

1. Naver Developers에서 애플리케이션을 만들고 Web 서비스 URL을 등록합니다.
2. Callback URL에 `/api/auth/social/naver/callback` 주소를 등록합니다.

```bash
NAVER_CLIENT_ID=client_id
NAVER_CLIENT_SECRET=client_secret
```

### App Native SDK

앱에서는 네이버 SDK를 사용합니다. 네이버 앱 로그인이 가능한 환경이면 네이버 앱을 통해 인증하고, 아니면 SDK가 로그인 화면으로 fallback합니다.

1. Naver Developers에서 Android/iOS 앱 설정을 등록합니다.
   - Android package: `com.blending.app`
   - iOS bundle id: `com.blending.app`
   - iOS URL Scheme: `blendingnaver` 또는 `EXPO_PUBLIC_NAVER_URL_SCHEME` 값
2. 앱 빌드 환경에 아래 값을 넣고 다시 빌드/설치합니다.

```bash
EXPO_PUBLIC_NAVER_CLIENT_ID=client_id
EXPO_PUBLIC_NAVER_CLIENT_SECRET=client_secret
EXPO_PUBLIC_NAVER_URL_SCHEME=blendingnaver
```

`EXPO_PUBLIC_*` 값은 앱 바이너리에 포함됩니다. 값을 바꾼 뒤에는 Expo dev server reload만으로는 부족하고 APK/IPA를 다시 빌드해서 설치해야 합니다.

## Apple

Apple은 토큰 교환에 client secret JWT가 필요합니다. 운영에서는 Apple Developer에서 생성한 키로 client secret을 만들어 `APPLE_CLIENT_SECRET`에 넣습니다.

```bash
APPLE_CLIENT_ID=com.blending.web
APPLE_CLIENT_SECRET=generated_apple_client_secret_jwt
```

## 이미지 업로드(R2)

```bash
R2_ACCOUNT_ID=cloudflare_account_id
R2_BUCKET=blending
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BASE_URL=https://assets.example.com
```

R2 버킷은 공개 도메인 또는 커스텀 도메인을 연결해야 앱에서 업로드된 이미지를 바로 표시할 수 있습니다.

## 전화번호 인증(Solapi)

개발 환경에서는 Solapi 환경변수가 없으면 개발모드로 동작하며 응답 메시지에 인증번호가 포함됩니다. `NODE_ENV=production`에서는 아래 환경변수가 모두 필수이며, 누락되면 전화번호 인증 요청이 실패합니다.

```bash
SOLAPI_API_KEY=...
SOLAPI_API_SECRET=...
SOLAPI_SENDER=01012345678
```
