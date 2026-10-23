# Mr. Markdown 1.1.0 이름 변경 및 설치 검증

검증일: 2026-10-23 (Asia/Seoul)

앱 화면, 문서 창 제목, 기본 메뉴, 앱 정보·도움말, Quick Look 표시 이름을 Mr. Markdown으로 변경했습니다. 앱/확장 버전은 1.1.0, build 4입니다. URI `https://mdeditor.app.kryp.xyz`, URL scheme `mdeditor://`, 앱 식별자 `xyz.kryp.mdeditor`, 확장 식별자 `xyz.kryp.mdeditor.preview` 및 기존 설정·즐겨찾기 저장 키는 유지했습니다.

- TypeScript strict, 단위 테스트 23개, Playwright 회귀 테스트 21개 통과.
- 실제 앱 WKWebView/NSDocument smoke: 새 메뉴·표시 이름과 URI, 한국어·표·수식·Mermaid·이미지 렌더링, 인쇄 HTML, 네이티브 라이트/다크 전환, 문서 열기·저장·재열기 통과.
- 요청 계정 [로컬 서명 계정]의 Apple Development 인증서로 서명. 설치본 중첩 코드 서명 strict 검증 통과.
- `/Applications/Mr. Markdown.app` 설치 및 실행 프로세스 확인. 기존 설치본은 `build/previous-installed-1.0.2/MD-Editor.app`에 보존.
- Quick Look 1.1.0: `/Applications/Mr. Markdown.app/Contents/PlugIns/MDPreview.appex` 단일 활성 등록 확인.
- 설치 파일 `dist/Mr. Markdown-1.1.0-arm64.dmg`, 볼륨 이름 Mr. Markdown. hdiutil 체크섬 검증 통과.
- `.omx/artifacts/mr-markdown-1.1.0-dark.png` 시각 검토: 새 이름이 도구 모음에 정상 표시되고 다크 테마·화면 구성 메뉴 유지.

아래는 이전 버전 검증 이력입니다.

---

# MD-Editor 1.0.2 다크 테마 업데이트

검증일: 2026-10-22 (Asia/Seoul)

- 상단 도구 모음·화면 구성 메뉴·선택 서식 팝업·가운데 구분선·하단 상태 표시줄·창 제목 막대에 테마 적용.
- 공통 UI는 편집창 테마를 따르고 미리보기 전용 화면은 미리보기 테마를 따릅니다. 좌우 창의 테마·글꼴 설정과 저장 형식은 유지합니다.
- `web/src/styles.css`: 공통 UI 색상 토큰과 다크 팔레트, 밝은 창의 color-scheme 분리.
- `web/src/main.ts`: 공통 테마 선택과 네이티브 appearance 브리지.
- `Sources/MD-Editor/EditorWindow.swift`: 문서 창에 Aqua/Dark Aqua 적용. 다른 문서 창의 테마를 변경하지 않습니다.
- 앱/Quick Look 확장: 1.0.2, build 3. 개발자 서명: 요청 계정 [로컬 서명 계정], 팀 [팀 ID 생략].

| 확인 | 결과 |
| --- | --- |
| TypeScript strict | 통과 |
| 단위 테스트 | 23개 통과 |
| Playwright 전체 회귀 | 21개 통과 |
| 실제 앱 WebKit/NSDocument smoke | 다크·라이트 네이티브 창 전환, 렌더링·저장·재열기 통과 |
| 독립 코드 검토 | 확정적 회귀 없음 |
| 설치본 중첩 코드 서명 strict 검증 | 통과 |

화면 테스트는 다크 공통 UI, 메뉴 hover, 혼합 테마 독립성, 미리보기 전용 화면 전환, 설정 재실행 유지, 라이트 테마 복귀, 문서 원문/수정 상태 보존을 확인합니다. `.omx/artifacts/md-editor-1.0.2-dark-chrome.png`를 시각 검토했습니다.

설치본: `/Applications/MD-Editor.app`. 소스 빌드 산출물: `build/release-1.0.2/MD-Editor.app`, `dist/MD-Editor.app`. 설치 이미지: `dist/MD-Editor-1.0.2-arm64.dmg`. 이전 설치본은 `build/previous-installed-1.0.1.app`에 보존했습니다. 업데이트 전 실행 중인 편집기 프로세스가 없어 문서를 종료하지 않고 교체했으며 새 설치본을 실행했습니다.

아래 기록은 이전 버전 검증 이력입니다.

---

# MD-Editor 1.0.1 Quick Look 업데이트 검증

검증일: 2026-10-21 (Asia/Seoul)

## 변경과 전달 파일

- `Sources/MDPreview/PreviewViewController.swift`: 읽기 전용 NSViewController + QLPreviewingController, UTF-8 읽기, 요청 교체/취소, 완료/오류/시간 초과 처리, 제한된 로컬 이미지 핸들러.
- `web/preview/`: 기존 Markdown 렌더러를 공유하는 Finder 전용 화면. 원문 편집 UI 없이 제목·표·수식·다이어그램·강조 코드 표시, 시스템 밝기 테마 적용.
- 빌드가 `Contents/PlugIns/MDPreview.appex`를 포함하고 확장부터 앱 순서로 서명합니다. 앱/확장 버전 1.0.1, build 2.
- 새 빌드: `build/release/MD-Editor.app`와 `dist/MD-Editor-1.0.1-arm64.dmg`.
- 이 Mac의 `/Applications/MD-Editor.app`에 업데이트 설치. 이전 설치본은 `build/previous-installed-1.0.0.app`에 보존했습니다. 실행 중이던 기존 `dist/MD-Editor.app` 프로세스와 문서는 종료하지 않았습니다.

## 확인한 결과

| 검사 | 결과 |
| --- | --- |
| TypeScript strict | 통과 |
| 기존 Node 단위 테스트 | 23개 통과 |
| Playwright 기존 편집기 + Quick Look 화면 | 20개 통과 (기존 16 + 신규 4) |
| Quick Look 네이티브 WKWebView 호스트 | 32개 검사 통과 |
| 실제 macOS QLPreviewView 호스트 | 설치된 확장의 렌더링 완료 로그 확인 |
| 실제 새 앱의 WKWebView + NSDocument smoke | 열기·렌더링·인쇄 HTML·저장·재열기 통과 |
| 셸 구문 / 앱·확장 plist | 통과 |
| Apple Development 중첩 서명 / strict 검증 | 통과, 요청 계정 [로컬 서명 계정], 팀 [팀 ID 생략] |
| 설치/확장 등록 | `/Applications`의 xyz.kryp.mdeditor.preview 1.0.1 활성 상태 `+` 확인 |

새 화면 테스트는 렌더링 결과, 편집 UI 부재, 완료 브리지, 악성 HTML 정화, 외부 요청/링크 차단, 오래된 요청 교체, 빈 문서, 시스템 다크 모드 및 데이터 이미지 로딩을 확인했습니다. 브라우저 캡처 `.omx/artifacts/quicklook-light.png`, `quicklook-dark.png`를 시각 검토했습니다.

실제 Quick Look 호스트 검증 중 샌드박스 WebKit이 네트워크 프로세스 연결 권한을 요구하는 것을 확인하여 `com.apple.security.network.client`를 추가했습니다. 원격 리소스는 웹 페이지 CSP로 차단합니다. 확장은 app-sandbox와 user-selected.read-only를 사용하며 `.md` UTI에만 등록합니다.

실제 시스템 호스트는 공개 `QLPreviewView` API를 이용해 `.md`를 요청했습니다. 설치된 `/Applications/MD-Editor.app/Contents/PlugIns/MDPreview.appex` 프로세스가 선택되었고 `QLDisplayBundleContainerView → NSRemoteView`가 표시되었습니다. WebKit 브리지에서 렌더링을 완료한 후 확장이 출력한 `Markdown Quick Look render completed` 로그를 확인했습니다. 상대 PNG만 있는 샘플은 `loaded images: 0`, 데이터 PNG 1개 + 상대 PNG 1개인 샘플은 `loaded images: 1`로 기록되어 포함 이미지의 실제 로딩도 확인했습니다. 증거: `.omx/artifacts/quicklook-system-host.log`. 원격 WindowServer 화면은 이 실행 환경에서 비트맵 캡처되지 않아 해당 검정 캡처를 증거로 사용하지 않았습니다.

## 사용 및 범위

- Finder에서 파일을 선택하고 Space를 누릅니다. Quick Look은 저장된 파일만 읽고 편집하거나 저장하지 않습니다.
- 원격 인터넷 이미지는 요청하지 않습니다. 데이터 이미지는 지원합니다. 실제 Finder 확장 샌드박스에서는 선택 파일 외의 상대 경로 이미지가 로드되지 않았습니다. 같은 PNG가 일반 네이티브 호스트에서는 로드되어, 렌더링 문제와 파일 접근 제한을 구분했습니다.
- 이 Mac의 현재 macOS/arm64에서 실행 확인했습니다. macOS 14를 최소 빌드 대상으로 사용합니다.
- 아래 1.0.0 기록은 이전 전달본 검증 이력입니다.

---

# MD-Editor 1.0.0 검증 결과

검증일: 2026-10-21 (Asia/Seoul)

## 전달 파일

- `dist/MD-Editor.app`: macOS 14 이상, Apple Silicon arm64
- `dist/MD-Editor-1.0.0-arm64.dmg`: 앱을 응용 프로그램 폴더로 옮길 수 있는 디스크 이미지
- 앱 아이콘: `assets/icon.svg`, `assets/AppIcon.png`, `assets/AppIcon.icns`
- 사용 안내: `README.md`, `docs/시작하기.md`

## 자동 검증

| 검사 | 결과 |
| --- | --- |
| TypeScript strict typecheck | 통과 |
| Node 단위 테스트 | 23개 통과 |
| Playwright 화면/상호작용 테스트 | 16개 통과 |
| Swift 네이티브 문서/경로 테스트 | 통과 |
| 실제 .app의 WKWebView 통합 smoke | 통과 |
| Info.plist / 셸 스크립트 구문 검사 | 통과 |
| 개발자 코드 서명 및 strict 검증 | 통과 (키체인 접근 가능한 실행 환경) |

화면 테스트는 원문과 읽기 전용 미리보기, 한글 단어 줄바꿈 CSS, 서식/되돌리기, 문서 변경 시 이력 초기화, 저장 스냅샷, 글꼴·테마·설정 상속·재실행 유지, 줄 번호와 창 토글, 찾기/바꾸기, HTML 정화, Mermaid 레이블과 경합, 비대칭 양방향 중앙 스크롤 및 커서 이동, 최소 창 크기, 검색창 클립보드, CDP 한글 IME composition 중 저장, 오프라인 인쇄용 수식 글꼴, 한글 제목 링크를 포함합니다.

네이티브 테스트는 UTF-8 한글/이모지, BOM, 잘못된 인코딩 거부, 수정 상태와 저장 기준점, 문서 유형, 이미지 폴더 이탈과 심볼릭 링크 차단을 검증했습니다. 실제 WKWebView smoke에서는 NSDocumentController로 .md 파일을 열고, 원문·제목·표·KaTeX·Mermaid·상대 경로 이미지·인쇄 HTML을 확인한 후 새 파일로 저장하고 재열어 내용을 대조했습니다.

## 서명

- Authority: `Apple Development: [로컬 서명 계정] ([인증서 ID 생략])`
- TeamIdentifier: `[팀 ID 생략]` (개인 팀)
- Identifier: `xyz.kryp.mdeditor`
- Hardened runtime: 적용
- `codesign --verify --deep --strict dist/MD-Editor.app`: 성공

초기 샌드박스 내부 조회는 키체인 접근 제한으로 인증서를 찾지 못했습니다. 권한 있는 실행 환경에서 기존 인증서를 확인하여 서명했습니다. 새로운 인증서·계정·권한을 만들지 않았습니다. 개발자 서명은 공증이나 App Store 배포를 의미하지 않습니다.

## 확인 범위와 남은 한계

- 실제 프린터의 종이 출력과 모든 프린터 드라이버는 테스트하지 않았습니다. 네이티브 인쇄 동작과 인쇄 HTML 생성은 구현됐으며 오프라인 수식 글꼴 화면을 검증했습니다.
- 한글 IME는 브라우저 composition 자동 테스트를 통과했습니다. 모든 macOS 입력기의 장시간 수동 스트레스 테스트는 수행하지 않았습니다.
- 화면 확인 도구가 응답하지 않아 네이티브 창의 수동 조작 캡처는 수집하지 못했습니다. 실제 WebKit 실행은 앱 내 smoke로 검증했고 시각 검토는 Playwright 캡처를 사용했습니다.
- macOS 14 최소 대상으로 컴파일했으나 이 Mac의 현재 운영체제에서 실행 검증했습니다. Intel 바이너리는 생성하지 않았습니다.
- `https://mdeditor.app.kryp.xyz`는 앱의 홈페이지 메타데이터에 반영했습니다. DNS·호스팅·HTTPS associated domains·공개 배포는 변경하지 않았습니다.
- 마크다운 확장의 지원 목록은 README에 명시했습니다. 서로 다른 모든 외부 방언의 완전 호환을 보장하지 않습니다.

## 재현

```sh
npm ci
npm run verify
npm run build
./dist/MD-Editor.app/Contents/MacOS/MD-Editor --smoke-test
npm run package
```

Swift 문서 테스트:

```sh
mkdir -p .build/module-cache
xcrun swiftc -parse-as-library -module-cache-path "$PWD/.build/module-cache" \
  Sources/MD-Editor/Document.swift Sources/MD-Editor/EditorWindow.swift \
  tests/NativeDocumentTests.swift -o .build/native-tests
.build/native-tests
```
