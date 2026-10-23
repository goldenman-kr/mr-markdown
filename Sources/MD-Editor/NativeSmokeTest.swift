import AppKit
import WebKit

/// Runs against the real bundled WKWebView. Opt-in only; uses disposable files and nonpersistent web storage.
@MainActor
final class NativeSmokeTest {
    private let controller: MarkdownDocumentController
    private var document: MarkdownDocument?
    private var directory: URL?
    private var finished = false
    private let sample = """
    # 네이티브 검증

    **강조**와 한국어 문서

    | 항목 | 값 |
    | --- | --- |
    | 언어 | 한국어 |

    $$x^2 + y^2$$

    ```mermaid
    graph LR
      A[시작] --> B[완료]
    ```

    ![상대 경로 이미지](native-image.png)
    """
    init(controller: MarkdownDocumentController) { self.controller = controller }
    func run() {
        do {
            guard Bundle.main.bundleIdentifier == "xyz.kryp.mdeditor",
                  Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String == "Mr. Markdown",
                  Bundle.main.object(forInfoDictionaryKey: "MDWebsiteURL") as? String == "https://mdeditor.app.kryp.xyz",
                  NSApp.mainMenu?.items.first?.submenu?.title == "Mr. Markdown" else {
                finish("App branding or stable identity mismatch", code: 1); return
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("MD-Editor-Smoke-" + UUID().uuidString)
            self.directory = directory
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=")!
            try png.write(to: directory.appendingPathComponent("native-image.png"))
            let source = directory.appendingPathComponent("NativeSmoke.md")
            try Data(sample.utf8).write(to: source)
            controller.openDocument(withContentsOf: source, display: true) { [weak self] document, _, error in
                guard let self else { return }
                if let error { self.finish("NSDocument open: " + error.localizedDescription, code: 1); return }
                guard let document = document as? MarkdownDocument else {
                    self.finish("Wrong document class for Markdown UTI", code: 1); return
                }
                self.document = document
                document.currentEditor?.onReady = { [weak self] in self?.inspectWeb() }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
                guard let self, !self.finished else { return }
                guard let view = self.document?.currentEditor?.webView else { self.finish("Missing webview", code: 1); return }
                view.evaluateJavaScript("JSON.stringify({url:location.href,api:typeof window.MDEditor,body:document.body.innerText.slice(0,500),scripts:[...document.scripts].map(s=>({src:s.src,type:s.type}))})") { value, error in
                    self.finish("Timed out waiting for bundled WKWebView: \(value ?? "nil"), \(error?.localizedDescription ?? "")", code: 1)
                }
            }
        } catch { finish(error.localizedDescription, code: 1) }
    }
    private func inspectWeb() {
        guard let editor = document?.currentEditor else { finish("Missing native editor", code: 1); return }
        let script = """
        for (let i=0; i<100; i++) {
          const p=document.querySelector('#preview');
          const img=p?.querySelector('img');
          if (p?.querySelector('h1') && p.querySelector('table') && p.querySelector('.katex') && p.querySelector('svg') && img?.complete && img.naturalWidth > 0) break;
          await new Promise(resolve=>setTimeout(resolve,100));
        }
        const p=document.querySelector('#preview');
        const image=p?.querySelector('img');
        const html=await window.MDEditor.printHTML();
        return {text:window.MDEditor.getText(),source:!!document.querySelector('.cm-content[contenteditable="true"]'),heading:p?.querySelector('h1')?.textContent,table:!!p?.querySelector('table'),math:!!p?.querySelector('.katex'),diagram:!!p?.querySelector('svg'),image:!!image?.complete && image.naturalWidth>0,previewReadOnly:!p?.isContentEditable,print:html.includes('네이티브 검증') && html.includes('<table')};
        """
        editor.webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error): self.finish("WKWebView JavaScript: " + error.localizedDescription, code: 1)
            case .success(let value):
                guard let values = value as? [String: Any] else { self.finish("Invalid WK result", code: 1); return }
                let keys = ["source", "table", "math", "diagram", "image", "previewReadOnly", "print"]
                let failures = keys.filter { values[$0] as? Bool != true }
                guard failures.isEmpty, values["text"] as? String == self.sample,
                      values["heading"] as? String == "네이티브 검증" else {
                    self.finish("WK assertions failed: " + String(describing: values), code: 1); return
                }
                self.checkAppearance(dark: true) { [weak self] in
                    self?.checkAppearance(dark: false) { [weak self] in self?.saveRoundtrip() }
                }
            }
        }
    }
    private func checkAppearance(dark: Bool, completion: @escaping () -> Void) {
        guard let editor = document?.currentEditor else { finish("Missing native editor", code: 1); return }
        let script = "(() => { const input=document.getElementById('editor-dark');input.checked=\(dark);input.dispatchEvent(new Event('change')); })()"
        editor.webView.evaluateJavaScript(script) { [weak self] _, error in
            guard let self else { return }
            if let error { self.finish("Appearance bridge: " + error.localizedDescription, code: 1); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                let expected: NSAppearance.Name = dark ? .darkAqua : .aqua
                guard editor.window?.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == expected else {
                    self.finish("Window appearance did not follow web theme", code: 1); return
                }
                completion()
            }
        }
    }
    private func saveRoundtrip() {
        guard let document, let directory else { finish("Missing smoke document", code: 1); return }
        let destination = directory.appendingPathComponent("SavedSmoke.md")
        document.save(to: destination, ofType: MarkdownDocument.markdownType, for: .saveAsOperation) { [weak self] error in
            guard let self else { return }
            do {
                if let error { throw error }
                let data = try Data(contentsOf: destination)
                let reopened = MarkdownDocument()
                try reopened.read(from: data, ofType: MarkdownDocument.markdownType)
                guard reopened.text == self.sample, !document.isDocumentEdited else {
                    self.finish("NSDocument saved roundtrip or baseline failed", code: 1); return
                }
                self.finish("PASS: real bundled WKWebView, new branding and stable URI, Korean source, heading, table, KaTeX, Mermaid, relative image, read-only preview, print HTML, native light/dark appearance, NSDocument open/save/reopen.", code: 0)
            } catch { self.finish("NSDocument save: " + error.localizedDescription, code: 1) }
        }
    }
    private func finish(_ message: String, code: Int32) {
        guard !finished else { return }
        finished = true
        if let directory { try? FileManager.default.removeItem(at: directory) }
        print("Mr. Markdown native smoke: " + message)
        fflush(stdout)
        exit(code)
    }
}
