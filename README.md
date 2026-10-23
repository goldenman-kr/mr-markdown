# Mr. Markdown

macOS에서 로컬 Markdown 문서를 작성하는 편집기입니다. 원문을 보존하는 편집창과 읽기 전용 미리보기를 나란히 표시합니다.

1.1.0부터 앱 이름이 **MD-Editor → Mr. Markdown**으로 변경되었습니다. 홈페이지 `https://mdeditor.app.kryp.xyz`, URL 스킴 `mdeditor://`, 앱 식별자 `xyz.kryp.mdeditor`와 기존 설정·즐겨찾기는 유지합니다.

## 실행

`dist/Mr. Markdown-1.1.0-arm64.dmg`를 열고 앱을 응용 프로그램 폴더로 옮기거나, `dist/Mr. Markdown.app`을 직접 더블 클릭하세요. macOS 14 이상에서 실행합니다. 현재 빌드는 이 Mac의 Apple Silicon 아키텍처용입니다.

- **파일**: 새 문서, 열기, 최근 파일, 닫기, 저장, 새 이름으로 저장, 즐겨찾기, 인쇄
- **편집**: 되돌리기, 다시 실행, 잘라내기, 복사, 붙여넣기, 찾기, 바꾸기
- **보기**: 줄 번호, 편집창/미리보기 표시, 전체 화면
- **⌘B / ⌘I**: 선택 영역에 굵게/기울임 적용
- **⌘F / ⌥⌘F**: 찾기/바꾸기
- **⌘S / ⇧⌘S**: 저장/새 이름으로 저장
- 선택 영역 팝업과 상단 도구에서 제목, 목록, 체크리스트, 인용, 코드, 링크, 이미지를 삽입합니다.

각 창의 글꼴·10–20pt 크기·다크 모드를 독립적으로 설정할 수 있습니다. 미리보기의 **편집창과 같음**을 체크하면 편집창의 설정을 따릅니다. 설정은 재실행 후에도 유지됩니다. 상단 도구 모음·화면 구성 메뉴·선택 서식 팝업·하단 상태 표시줄·창 제목 막대는 편집창 테마를 따릅니다. 미리보기만 표시할 때는 미리보기 테마를 따르며, 좌우 본문의 개별 테마는 유지됩니다. 가운데 경계선을 드래그하거나 키보드 좌우 화살표로 창 비율을 조절합니다.

스크롤은 원문의 블록 위치와 렌더링된 문단 위치를 연결해 화면 중앙을 기준으로 양방향 보간합니다. 키보드로 커서가 이동해 편집창이 스크롤될 때도 적용됩니다. 글꼴 크기가 매우 다르면 같은 화면에 보이는 문단의 개수는 달라집니다.

## Finder 스페이스바 미리보기

1.0.1부터 앱에 Quick Look 확장이 포함됩니다. 앱을 `/Applications/Mr. Markdown.app`에 설치한 후 Finder에서 `.md` 파일을 선택하고 스페이스바를 누르면 편집 도구 없이 **렌더링된 문서**가 표시됩니다. 기본 열기 앱 설정과 Quick Look은 별도의 기능입니다. 이 Mac에는 업데이트 설치와 확장 등록을 적용했습니다.

미리보기는 디스크에 **저장된 내용**을 읽습니다. 앱에서 아직 저장하지 않은 편집 내용은 ⌘S로 저장해야 반영됩니다. 제목·표·코드·수식·Mermaid 등은 앱과 같은 렌더러를 사용하고, 밝기 테마는 macOS 설정을 따릅니다. 빈 파일은 빈 문서 안내를 표시합니다.

Quick Look에서는 외부 링크로 이동하거나 인터넷 이미지를 요청하지 않습니다. 문서에 포함된 데이터 이미지를 표시합니다. Finder의 확장 샌드박스는 선택한 Markdown 파일만 허용하므로, 이 Mac의 실제 Quick Look 검사에서는 문서 옆 상대 경로 이미지가 표시되지 않았습니다. 이미지까지 함께 보려면 앱의 이미지 삽입 도구로 데이터 이미지를 포함하세요. UTF-8 Markdown, 최대 16 MiB 파일을 지원합니다.

미리보기가 표시되지 않으면 **시스템 설정 → 일반 → 로그인 항목 및 확장 프로그램 → Quick Look**에서 **Mr. Markdown Preview**가 켜져 있는지 확인하세요. Quick Look 화면을 닫고 파일을 다시 선택하면 새 내용을 읽습니다.

## Markdown 지원

- CommonMark 기본 문법, GFM 표·취소선·자동 링크·체크리스트
- 각주, 정의 목록, 위/아래 첨자, 하이라이트, 이모지
- 코드 블록의 언어별 구문 강조
- KaTeX 수식: `$...$`, `$$...$$`
- Mermaid 다이어그램: `mermaid` 코드 블록
- GitHub 알림 인용: `> [!NOTE]` 등
- `::: note` / `tip` / `warning` / `important` / `caution` / `details` 컨테이너
- 제목 앵커 및 `{#id}` / `{.class}` 속성
- 안전한 HTML, 이미지와 상대 경로 이미지

마크다운에는 서로 호환되지 않는 여러 확장이 있습니다. 위에 적힌 문법을 지원하며 임의의 외부 플러그인 문법을 모두 지원하지는 않습니다. 스크립트·iframe·실행 가능한 HTML은 제거합니다. 미리보기의 체크박스는 편집되지 않습니다.

문서는 UTF-8로 열고 저장합니다. UTF-8 BOM은 열 때 제거합니다. 로컬 이미지는 문서 폴더 아래의 이미지 파일을 읽으며, 폴더 밖으로 벗어나는 경로와 심볼릭 링크는 차단합니다. 이미지 선택 도구는 이미지를 데이터 URI로 삽입하므로 파일을 옮겨도 유지됩니다. 인터넷 이미지는 해당 서버에 연결해야 표시됩니다. 앱 자체의 라이브러리·수식 글꼴·다이어그램은 오프라인으로 동작합니다.

인쇄는 편집 도구를 제외한 렌더링 결과를 macOS 인쇄 대화상자에 전달합니다. PDF 저장은 인쇄 대화상자의 PDF 메뉴를 이용하세요.

## 빌드

필요 도구: macOS 14+, Xcode/Command Line Tools, Node.js 22.18 이상과 npm. 테스트는 설치된 Google Chrome을 사용합니다.

```sh
npm ci
npm run build
open "dist/Mr. Markdown.app"
# 설치 이미지 생성 (선택)
npm run package
```

앱 아이콘 원본은 `assets/icon.svg`이며 PNG와 ICNS도 포함되어 있습니다. 다시 생성하려면 `node scripts/generate-icons.mjs`를 실행합니다.

네이티브 AppKit의 NSDocument가 파일 수명 주기와 메뉴를 관리하고, WKWebView에서 CodeMirror 6 및 markdown-it 기반의 화면을 실행합니다. WebKit의 로컬 ES 모듈 제한을 피하기 위해 웹 코드는 클래식 IIFE 번들로 패키징합니다. 로컬 서버는 실행 앱에 필요하지 않습니다.

## 서명

`scripts/sign-app.sh`는 `MD_SIGN_ACCOUNT`로 지정한 계정의 유효한 **Apple Development** 인증서만 선택합니다. 로컬 `scripts/signing.local.env`에 `MD_SIGN_ACCOUNT='개발자 계정 이메일'`을 설정하거나 환경 변수로 전달하세요. 이 파일은 Git에서 제외됩니다. 선택적으로 `MD_SIGN_IDENTITY`를 함께 지정할 수 있으며 같은 계정인지 검증합니다. 계정을 지정하지 않거나 유효한 인증서가 없으면 로컬 실행용 ad-hoc 서명을 적용합니다. 키체인·인증서·개인키는 저장소에 포함하지 않습니다.

이 개발용 서명은 App Store 배포나 공증을 의미하지 않습니다. 앱 식별자는 `xyz.kryp.mdeditor`, 홈페이지 주소는 `https://mdeditor.app.kryp.xyz`, URL 스킴은 `mdeditor://`입니다. 도메인의 DNS·웹사이트 호스팅은 이 로컬 앱 빌드에서 변경하지 않았습니다.

## 검증

```sh
npm run check
npm test
npm run build:web
npm run test:e2e
npm run build
"./dist/Mr. Markdown.app/Contents/MacOS/Mr. Markdown" --smoke-test
```

`--smoke-test`는 임시 폴더에서 실제 WKWebView 화면, 한글 원문, 표·수식·다이어그램, 상대 이미지, 인쇄 HTML, 네이티브 저장·재열기를 검사한 뒤 종료합니다. 파일 형식·UTF-8·문서 수정 상태·이미지 경로 접근은 `tests/NativeDocumentTests.swift`로도 검증합니다.

브라우저에서 UI만 확인하려면 `npm run build:web` 이후 `npm run dev`를 실행하고 `http://127.0.0.1:4173`을 엽니다. 브라우저 모드는 임시 초안만 저장하며 네이티브 파일 메뉴는 macOS 앱에서 제공합니다.

Quick Look 네이티브 검증:

```sh
xcrun swiftc -parse-as-library -module-name MDPreview -target arm64-apple-macos14.0 \
  -module-cache-path "$PWD/.build/module-cache" Sources/MDPreview/*.swift \
  tests/QuickLookNativeTests.swift -o .build/quicklook-tests
.build/quicklook-tests
```

`web/preview`는 Finder용 읽기 전용 화면, `Sources/MDPreview`는 Quick Look 확장입니다. 확장을 먼저 샌드박스 권한으로 서명한 뒤 앱 전체를 서명합니다. 브라우저 전용 확인 주소는 `http://127.0.0.1:4173/quicklook/`입니다.
