# Blending 소셜 로그인 설정

이 프로젝트는 웹 단독 실행과 앱 WebView 실행을 모두 지원합니다.

- 웹 단독 실행: 기존 OAuth 경로(`/api/auth/social/kakao`, `/api/auth/social/naver`)를 사용합니다.
- 앱 WebView 실행: 네이티브 SDK 로그인을 먼저 시도하고, 실패하면 기존 웹 OAuth로 자동 fallback합니다.

## Kakao Developers 설정

### 기존 웹 OAuth

Vercel 또는 웹 실행 환경에 아래 값을 설정합니다.

```bash
KAKAO_CLIENT_ID=카카오_REST_API_KEY
KAKAO_CLIENT_SECRET=카카오_CLIENT_SECRET_선택값
NEXT_PUBLIC_SITE_URL=https://blending.ridge-it.site
```

Kakao Developers에서 카카오 로그인을 활성화하고 Redirect URI에 아래 주소를 등록합니다.

```text
https://blending.ridge-it.site/api/auth/social/kakao/callback
```

### 앱 네이티브 로그인

카카오톡 앱 로그인까지 사용하려면 Kakao Developers의 플랫폼 설정을 추가합니다.

```text
Android package: com.blending.app
iOS bundle id: com.blending.app
```

Android는 빌드 키에 맞는 키 해시도 등록해야 합니다.

```bash
keytool -exportcert -alias androiddebugkey -keystore app/android/app/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64
```

앱 빌드 환경에는 Native app key를 설정합니다.

```bash
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=카카오_NATIVE_APP_KEY
```

## Naver Developers 설정

### 기존 웹 OAuth

Vercel 또는 웹 실행 환경에 아래 값을 설정합니다.

```bash
NAVER_CLIENT_ID=네이버_CLIENT_ID
NAVER_CLIENT_SECRET=네이버_CLIENT_SECRET
NEXT_PUBLIC_SITE_URL=https://blending.ridge-it.site
```

Naver Developers에서 Callback URL에 아래 주소를 등록합니다.

```text
https://blending.ridge-it.site/api/auth/social/naver/callback
```

### 앱 네이티브 로그인

네이버 앱 로그인을 사용하려면 Naver Developers에 앱 환경을 추가합니다.

```text
Android package: com.blending.app
iOS bundle id: com.blending.app
iOS URL Scheme: blendingnaver
```

앱 빌드 환경에는 아래 값을 설정합니다.

```bash
EXPO_PUBLIC_NAVER_CLIENT_ID=네이버_CLIENT_ID
EXPO_PUBLIC_NAVER_CLIENT_SECRET=네이버_CLIENT_SECRET
EXPO_PUBLIC_NAVER_URL_SCHEME=blendingnaver
```

## 앱 빌드 주의사항

`EXPO_PUBLIC_*` 값은 앱 바이너리에 포함됩니다. 값을 추가하거나 바꾼 뒤에는 Expo reload만으로는 반영되지 않으며 APK 또는 IPA를 다시 빌드해서 설치해야 합니다.

네이티브 앱 설정이 아직 없어도 로그인은 막히지 않습니다. 앱 WebView에서 네이티브 SDK 로그인이 실패하면 기존 웹 OAuth로 자동 이동합니다.
