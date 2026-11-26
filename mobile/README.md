# 교환가자 iOS · Android 앱

웹앱(`../index.html`)을 [Capacitor 8](https://capacitorjs.com)로 감싼 앱이에요.
화면은 앱 안에 들어 있고, 로그인·데이터·문서는 `https://gyohwan-gaja-application-development.vercel.app` 서버에서 받아요.

- 앱 ID: `com.gyohwangaja.app` · 앱 이름: 교환가자 (`capacitor.config.json`)
- 앱 기능: 공유(친구 초대), 햅틱, 안드로이드 뒤로가기, 외부 링크는 인앱 브라우저, 스플래시·상태바, 회원 탈퇴
- 로그인: 앱은 쿠키 대신 토큰(`Authorization: Bearer`)을 써요. 서버는 앱 주소(`capacitor://localhost`, `https://localhost`)의 요청만 추가로 허용해요.

## 웹 화면을 고친 뒤

```bash
cd mobile
npm install          # 처음 한 번
npm run sync         # ../index.html 등을 www/로 복사하고 iOS·안드로이드 프로젝트에 반영
```

## 안드로이드 (Google Play)

필요: Android Studio (JDK 21 포함)

```bash
npm run android      # Android Studio로 열기
```

1. Android Studio → Build → Generate Signed App Bundle → 새 업로드 키(.jks) 만들기.
   이 키 파일과 비밀번호는 잃어버리면 업데이트를 못 올리니 안전한 곳에 따로 보관하세요. 저장소에 올리지 마세요.
2. 나온 `app-release.aab`를 Google Play Console → 앱 만들기 → 내부 테스트 트랙에 업로드.
3. 업데이트할 때마다 `android/app/build.gradle`의 `versionCode`를 1씩 올리고 `versionName`을 바꿔요.

## iOS (App Store)

필요: Mac + Xcode, Apple Developer Program 가입(연 $99). Mac이 없으면 Codemagic·Ionic Appflow 같은 클라우드 빌드를 써요.

```bash
npm run ios          # Xcode로 열기
```

1. Xcode → App 타깃 → Signing & Capabilities에서 Team 선택(번들 ID `com.gyohwangaja.app`).
2. Product → Archive → Distribute App → App Store Connect 업로드 → TestFlight로 먼저 확인.
3. 업데이트 때마다 Version / Build 번호를 올려요.

## 알림 (Firebase)

- 체크리스트 마감 알림: 휴대폰 안에서 예약해요(마감 3일 전·1일 전 오전 9시). 서버·Firebase가 필요 없어요.
- 멘토 심사 결과·운영 공지: Firebase Cloud Messaging 푸시. 공지는 관리자 대시보드 개요 → "공지 알림 보내기".
- 알림은 학생이 "알림 켜기"를 눌러야 켜지고, 마이 → 알림에서 끌 수 있어요.

연결에 필요한 것 (Firebase 프로젝트 `gyohwan-gaja`):

| 파일 / 값 | 넣는 곳 |
| --- | --- |
| `google-services.json` | `mobile/android/app/` |
| `GoogleService-Info.plist` | `mobile/ios/App/App/` + Xcode에서 App 타깃에 추가(파일을 Xcode 왼쪽 App 폴더로 끌어다 놓고 "Copy items if needed", Target "App" 체크) |
| 서비스 계정 키 JSON 내용 전체 | Vercel 환경변수 `FIREBASE_SERVICE_ACCOUNT` (저장소에 올리지 마세요) |
| APNs 인증 키(.p8) | Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징 → Apple 앱 구성 |

설정 파일을 넣은 뒤 `npm run sync` 하면 앱이 그 플랫폼에서 푸시를 켜요(파일이 없으면 푸시 없이 마감 알림만 동작).

iOS는 Xcode → App 타깃 → Signing & Capabilities → "+ Capability"로 **Push Notifications**와 **Background Modes → Remote notifications**를 추가해야 해요.

## 아이콘·스플래시 다시 만들기

`assets/`의 원본(icon-only, icon-foreground, icon-background, splash, splash-dark)을 바꾼 뒤 `npm run assets`.

## 스토어 심사 준비물

- 개인정보처리방침 URL: https://gyohwan-gaja-application-development.vercel.app/privacy
- 이용약관 URL: https://gyohwan-gaja-application-development.vercel.app/terms
- 앱 내 회원 탈퇴: 마이 → 회원 탈퇴 (App Store 필수 요건)
- 심사용 테스트 계정(아이디·비밀번호)을 심사 메모에 적어 주세요.
- 스크린샷: iPhone 6.9인치, Android 휴대폰 각 2장 이상.
