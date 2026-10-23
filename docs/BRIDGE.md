# Native / web contract

Native app: Swift AppKit NSDocument, bundled WKWebView. Resources/web/index.html.
Web calls `window.webkit.messageHandlers.native.postMessage({type, ...})`.
- appearance: {dark:boolean}: shared chrome theme; native sets the document window appearance (Aqua/Dark Aqua). Follows editor while visible, otherwise effective preview; does not change another document window.
- ready: app ready for document + installed fonts.
- change: {text}: full UTF-8 markdown; NSDocument tracks undo via web, dirty state via change count.
- openLink: {url}: only http/https/mailto; native opens external browser.
- chooseImage: insert a local image via native panel, callback command insertImage {url,alt}.
- title: {name,dirty}: optional status title.
Native calls `window.MDEditor.receive(message)` with JSON object:
- {type:'load',text,name,baseURL?}: replace full document, reset undo history and unsaved marker; baseURL is a file directory URL for relative images.
- {type:'fonts',fonts:[string]}: installed font family names.
- {type:'command',command:string,...}: undo, redo, copy, cut, paste, find, replace, selectAll, toggleLines, toggleEditor, togglePreview, print, bold, italic, insertImage.
- {type:'saved',name,baseURL?}: mark current text saved.
For print native calls async `window.MDEditor.printHTML()` -> complete standalone HTML string; print in separate WKWebView.
`window.MDEditor.getText()` returns latest text; native flushes before save/close.
`window.MDEditor.isDirty()` compares latest text to saved baseline.
`window.MDEditor.prepareClose()` is async: ends IME composition, waits for pending DOM/composition changes, and returns latest text. Native must await it.
`window.MDEditor.receive` queues native messages until editor is ready, web posts ready only after API exists.
Menu state: web sends {type:'viewState',lines:boolean,editor:boolean,preview:boolean}.
Native app identifier: xyz.kryp.mdeditor, website: https://mdeditor.app.kryp.xyz, display name: Mr. Markdown.
URL scheme: mdeditor; HTTPS associated domain requires separate deployed domain/Apple configuration and is not implied.
