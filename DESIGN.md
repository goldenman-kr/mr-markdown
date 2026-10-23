# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-10-23
- Primary product surfaces: macOS desktop Mr. Markdown; source editor and read-only preview.
- Evidence reviewed: empty repository; user's Korean specification and attached MacDown screenshot. The reference establishes raw syntax styling and split panes; its document content is sample data, not instructions.

## Brand
- Personality: quiet, precise, familiar macOS writing tool.
- Trust signals: local files, native dialogs, honest unsaved state, offline rendering.
- Avoid: promotional dashboards, busy chrome, hidden destructive actions.

## Product goals
- Goals: replace an aging Markdown editor; preserve raw source; immediate preview; dependable local files.
- Non-goals: cloud collaboration, account systems, WYSIWYG conversion.
- Success signals: launchable .app; native menus; source/preview settings; mapped scrolling; verified Markdown and file round trips.

## Personas and jobs
- Primary personas: Korean-speaking Mac user writing mixed prose/code.
- User jobs: edit Markdown, format selections, review rendered content, reopen favorites, print.
- Key contexts: local documents, long Korean paragraphs, light/dark preferences, offline use.

## Information architecture
- Primary navigation: native MD-Editor / 파일 / 편집 / 보기 / 도움말.
- Core routes/screens: one document per native window, two resizable panes.
- Content hierarchy: compact formatting toolbar, independent pane appearance settings, writing surface, quiet status line.

## Design principles
- Raw source is always visible and editable; decorations never replace syntax.
- Content takes priority over chrome; font/theme preferences apply immediately.
- Tradeoffs: broad Markdown dialect coverage documented explicitly; extensions do not promise an impossible universal dialect.

## Visual language
- Color: warm near-white chrome, white pages, muted gray dividers, restrained teal accent. Dark panels use neutral charcoal gray.
- Typography: system UI; source default Menlo 13pt, preview system sans 14pt; installed family dropdowns; 10–20pt sliders.
- Spacing/layout rhythm: 4px units, 40px toolbar, 58px settings, 26px footer; text inset 24–36px.
- Shape/radius/elevation: small 5px control corners; native window; flat panes.
- Motion: no animated document scrolling or decorative transitions.
- Imagery/iconography: simple code/document monogram in a rounded native app icon; familiar inline formatting symbols.

## Components
- Existing components to reuse: AppKit menus/dialogs, CodeMirror source and search, markdown-it tokens.
- New/changed components: pane appearance controls, formatting toolbar, splitter, preview, status bar.
- Variants and states: independent light/dark; preview inherits editor when checkbox selected; disabled controls visibly gray; single-pane modes.
- Token/component ownership: web/src/styles.css; native window and menus in Sources/MD-Editor.

## Accessibility
- Target standard: readable contrast and keyboard-operable controls with accessible labels.
- Keyboard/focus behavior: native Cmd shortcuts; editor undo/history; visible focus; all buttons labeled in Korean.
- Contrast/readability: subdued gutter remains legible; token colors work in both themes.
- Screen-reader semantics: labeled source editor, preview article, toolbars and form controls.
- Reduced motion and sensory considerations: no forced animation.

## Responsive behavior
- Supported breakpoints/devices: macOS 14+, minimum native window 840×560.
- Layout adaptations: resizable panes; compact controls; horizontal code/table scrolling; pane toggles retain one visible pane.
- Touch/hover differences: pointer and keyboard; tooltips provide toolbar labels.

## Interaction states
- Loading: local bundled assets, native initial document queued until web ready.
- Empty: new empty document with placeholder; welcome sample on first launch only.
- Error: native file errors; renderer errors shown without destroying source.
- Success: native saved name and unsaved marker.
- Disabled: preview appearance locked to editor while inheritance is checked.
- Offline/slow network: all application libraries, math fonts and diagrams bundled. Remote images require their remote host.

## Content voice
- Tone: concise Korean.
- Terminology: 편집창, 미리보기, 줄 번호, 편집창과 같음.
- Microcopy rules: report errors with actionable detail; avoid implementation terms in writing flow.

## Implementation constraints
- Framework/styling system: AppKit + WKWebView; bundled TypeScript, CodeMirror 6, markdown-it and extensions.
- Design-token constraints: CSS variables scoped to each pane; preview theme does not mutate editor.
- Performance constraints: debounce parsing; virtualized editor; render/resize image-aware scroll anchors; guard scroll feedback.
- Compatibility constraints: Korean word wrapping uses keep-all; long unbroken tokens can overflow/wrap for usability. HTML sanitized, executable scripts blocked.
- Test/screenshot expectations: Node utility regressions, Playwright interactions, native Swift compilation, app launch smoke; screenshot verdict recorded.

## Open questions
- Domain mdeditor.app.kryp.xyz is the app's identity/help URL; deployment/DNS is outside the requested local app build.
- Apple signing uses only the account explicitly configured in the ignored local signing configuration or environment when its valid development identity is available.

## Finder Quick Look (1.0.1)
- Surface: saved Markdown rendered as a read-only page with no editing toolbar or source pane.
- Shared renderer: web/src/markdown.ts and markdown-body styling; entry point web/preview/main.ts.
- Appearance: system light/dark, system font 14pt, generous page insets; code and tables retain horizontal scrolling.
- Lifecycle: explicit loading/empty/error states, async diagrams/images/fonts before completion; older requests cannot replace a newer file.
- Isolation: ephemeral WebKit store, no editor bridge, no document writes, no remote image requests or external navigation.
- Native owner: Sources/MDPreview, bundled in Contents/PlugIns/MDPreview.appex; only net.daringfireball.markdown is claimed.

## Shared chrome appearance (1.0.2)
- Shared toolbar, layout menu, selection popup, splitter and footer use light/dark chrome tokens on `:root[data-chrome-theme]`.
- Theme owner is the editor while shown; preview-only uses effective preview appearance. Existing independent pane preferences remain intact.
- Avoid a root `.dark` class: descendant Markdown syntax styles must stay scoped to each pane. Light panes explicitly use `color-scheme: light`.
- Native document window receives the same appearance through the web bridge, covering title bar, native popups and attached sheets without changing other windows.

## Mr. series branding (1.1.0)
- Official name: Mr. Markdown, including native menus/About/Help, document titles, toolbar and Quick Look extension label.
- App bundle and DMG volume: Mr. Markdown. Retain the existing document icon.
- Stable identity: xyz.kryp.mdeditor, xyz.kryp.mdeditor.preview, mdeditor:// and https://mdeditor.app.kryp.xyz.
- Retain existing MD-Editor.Favorites / MD-Editor.Document preferences, mdeditor.settings.v1 storage and MDEditor web API for compatibility. Internal source directory names do not change.
