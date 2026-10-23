import AppKit
import WebKit

/// Compile alongside the extension source. This exercises its actual WKWebView,
/// file loader, bridge completion, cancellation and image confinement.
@main
@MainActor
final class QuickLookNativeTests: NSObject, NSApplicationDelegate {
    private var window: NSWindow!
    private var preview: PreviewViewController!
    private var directory: URL!
    private var markdownURL: URL!
    private var failures: [String] = []
    private var count = 0
    private var cancellationCalls = 0
    private let markdown = """
    # Quick Look 렌더링

    **굵게** and *italic* and ~~삭제~~.

    | 열 | 값 |
    | --- | --- |
    | 테스트 | 42 |

    - [x] 완료

    수식 $x^2$ and a footnote[^one].

    [^one]: 각주입니다.

    ```mermaid
    graph LR
      A[시작] --> B[끝]
    ```

    ```swift
    let value = 42
    ```

    ![로컬 이미지](image.png)

    <script>window.previewInjected = true</script>
    """

    static func main() {
        let app = NSApplication.shared
        let delegate = QuickLookNativeTests()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            let renderer = root.appendingPathComponent("build/preview/index.html")
            check(FileManager.default.fileExists(atPath: renderer.path), "built renderer exists")
            directory = FileManager.default.temporaryDirectory.appendingPathComponent("mdeditor-quicklook-\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            markdownURL = directory.appendingPathComponent("미리보기.md")
            try markdown.write(to: markdownURL, atomically: true, encoding: .utf8)
            let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==")!
            try png.write(to: directory.appendingPathComponent("image.png"))
            try coreChecks()
            preview = PreviewViewController(previewURL: renderer)
            window = NSWindow(contentViewController: preview)
            window.setContentSize(NSSize(width: 900, height: 720))
            window.orderFront(nil)
            preview.preparePreviewOfFile(at: markdownURL) { [self] error in
                check(error == nil, "render completion succeeds: \(error?.localizedDescription ?? "ok")")
                if error != nil { finish() }
                inspectDOM()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 50) { [self] in
                check(false, "test host timed out")
                finish()
            }
        } catch { check(false, error.localizedDescription); finish() }
    }

    private func coreChecks() throws {
        check(NSClassFromString("MDPreview.PreviewViewController") != nil, "principal class resolves through Objective-C runtime")
        try check(try PreviewDocument.read(markdownURL) == markdown, "UTF-8 Korean document reads verbatim")
        let bom = directory.appendingPathComponent("bom.md")
        try Data([0xef, 0xbb, 0xbf] + Array("# BOM".utf8)).write(to: bom)
        try check(try PreviewDocument.read(bom) == "# BOM", "UTF-8 BOM is removed")
        let invalid = directory.appendingPathComponent("invalid.md")
        try Data([0xff, 0xfe, 0xff]).write(to: invalid)
        rejects("invalid UTF-8 rejected") { _ = try PreviewDocument.read(invalid) }
        rejects("missing file rejected") { _ = try PreviewDocument.read(directory.appendingPathComponent("missing.md")) }
        rejects("directory rejected") { _ = try PreviewDocument.read(directory) }
        rejects("remote URL rejected") { _ = try PreviewDocument.read(URL(string: "https://example.com/test.md")!) }
        let large = directory.appendingPathComponent("large.md")
        FileManager.default.createFile(atPath: large.path, contents: nil)
        let handle = try FileHandle(forWritingTo: large)
        try handle.truncate(atOffset: UInt64(PreviewDocument.maximumBytes + 1))
        try handle.close()
        rejects("large document rejected") { _ = try PreviewDocument.read(large) }
        let images = PreviewImageHandler()
        images.root = directory
        try check(try images.resourceURL(for: URL(string: "mdpreview-image://document/image.png")!).lastPathComponent == "image.png", "local image allowed")
        rejects("non-image file rejected") { _ = try images.resourceURL(for: URL(string: "mdpreview-image://document/\(markdownURL.lastPathComponent.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)!)")!) }
        rejects("wrong resource host rejected") { _ = try images.resourceURL(for: URL(string: "mdpreview-image://other/image.png")!) }
        rejects("absolute file URL rejected") { _ = try images.resourceURL(for: directory.appendingPathComponent("image.png")) }
        let outside = directory.deletingLastPathComponent().appendingPathComponent("outside-\(UUID().uuidString).png")
        try Data("hidden".utf8).write(to: outside)
        defer { try? FileManager.default.removeItem(at: outside) }
        try FileManager.default.createSymbolicLink(at: directory.appendingPathComponent("escape.png"), withDestinationURL: outside)
        rejects("symlink escape rejected") { _ = try images.resourceURL(for: URL(string: "mdpreview-image://document/escape.png")!) }
        rejects("parent path escape rejected") { _ = try images.resourceURL(for: URL(string: "mdpreview-image://document/%2e%2e/\(outside.lastPathComponent)")!) }
    }

    private func inspectDOM() {
        let script = """
        (() => ({
          heading: document.querySelector('h1')?.textContent,
          bold: !!document.querySelector('strong'), table: !!document.querySelector('table'),
          task: !!document.querySelector('input[type=checkbox][disabled]'),
          math: !!document.querySelector('.katex'), footnote: !!document.querySelector('.footnotes'),
          diagram: !!document.querySelector('.mermaid-block svg'),
          highlight: !!document.querySelector('pre code .hljs-keyword'),
          image: !!Array.from(document.images).find(image => image.alt === '로컬 이미지' && image.complete && image.naturalWidth > 0),
          injected: window.previewInjected === true,
          editor: !!document.querySelector('.cm-editor, textarea, [contenteditable=true]')
        }))()
        """
        preview.webView!.evaluateJavaScript(script) { [self] value, error in
            check(error == nil, "DOM evaluation succeeds")
            guard let state = value as? [String: Any] else { check(false, "DOM state missing"); finish() }
            check(state["heading"] as? String == "Quick Look 렌더링", "rendered heading replaces Markdown syntax")
            for name in ["bold", "table", "task", "math", "footnote", "diagram", "highlight", "image"] {
                check(state[name] as? Bool == true, "renderer feature: \(name)")
            }
            check(state["injected"] as? Bool == false, "Markdown script never executes")
            check(state["editor"] as? Bool == false, "preview contains no editor")
            cancellationCheck()
        }
    }

    private func cancellationCheck() {
        preview.preparePreviewOfFile(at: markdownURL) { [self] error in
            cancellationCalls += 1
            check((error as NSError?)?.code == NSUserCancelledError, "replaced request completes with cancellation")
        }
        preview.preparePreviewOfFile(at: directory.appendingPathComponent("does-not-exist.md")) { [self] error in
            check(error != nil, "missing-file preview completes with error")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [self] in
                check(cancellationCalls == 1, "cancelled completion called exactly once")
                do { try check(try String(contentsOf: markdownURL, encoding: .utf8) == markdown, "preview never changes source file") }
                catch { check(false, error.localizedDescription) }
                finish()
            }
        }
    }

    private func check(_ condition: @autoclosure () throws -> Bool, _ name: String) rethrows {
        count += 1
        if try !condition() { failures.append(name); print("FAIL: \(name)") }
        else { print("PASS: \(name)") }
    }
    private func rejects(_ name: String, _ body: () throws -> Void) {
        do { try body(); check(false, name) } catch { check(true, name) }
    }
    private func finish() -> Never {
        if let directory { try? FileManager.default.removeItem(at: directory) }
        print("Quick Look native: \(count - failures.count)/\(count) checks passed")
        fflush(stdout)
        exit(failures.isEmpty ? 0 : 1)
    }
}
