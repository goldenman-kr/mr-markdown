import AppKit
import WebKit
import UniformTypeIdentifiers

@MainActor
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: EditorWindowController?
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

/// The page can read image bytes inside this document's directory only. It never receives filesystem APIs.
@MainActor
final class DocumentImageHandler: NSObject, WKURLSchemeHandler {
    var root: URL?
    static func imageMIME(for extensionName: String) -> String? {
        let known = ["png": "image/png", "apng": "image/apng", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                     "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml", "bmp": "image/bmp",
                     "tif": "image/tiff", "tiff": "image/tiff", "heic": "image/heic", "heif": "image/heif",
                     "avif": "image/avif", "ico": "image/x-icon"]
        if let mime = known[extensionName.lowercased()] { return mime }
        guard let type = UTType(filenameExtension: extensionName), type.conforms(to: .image) else { return nil }
        return type.preferredMIMEType
    }
    func resourceURL(for requestURL: URL) throws -> URL {
        guard requestURL.scheme == "mdeditor-resource", requestURL.host == "document", let root else {
            throw CocoaError(.fileReadNoPermission)
        }
        let resolvedRoot = root.resolvingSymlinksInPath().standardizedFileURL
        let relative = String(requestURL.path.drop(while: { $0 == "/" }))
        let target = resolvedRoot.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        guard target.path.hasPrefix(resolvedRoot.path + "/"),
              Self.imageMIME(for: target.pathExtension) != nil,
              let size = try target.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size <= 30 * 1024 * 1024 else { throw CocoaError(.fileReadNoPermission) }
        return target
    }
    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        do {
            guard let requestURL = task.request.url else { throw CocoaError(.fileReadNoPermission) }
            let target = try resourceURL(for: requestURL)
            let data = try Data(contentsOf: target)
            task.didReceive(URLResponse(url: requestURL, mimeType: Self.imageMIME(for: target.pathExtension),
                                        expectedContentLength: data.count, textEncodingName: nil))
            task.didReceive(data)
            task.didFinish()
        } catch { task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}

@MainActor
final class EditorWindowController: NSWindowController, WKScriptMessageHandler, WKNavigationDelegate {
    private weak var markdown: MarkdownDocument?
    let webView: WKWebView
    private let images = DocumentImageHandler()
    private var ready = false
    var onReady: (() -> Void)?
    private var printer: PreviewPrinter?
    private(set) var viewState = ["lines": true, "editor": true, "preview": true]

    init(document: MarkdownDocument) {
        markdown = document
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = ProcessInfo.processInfo.arguments.contains("--smoke-test") ? .nonPersistent() : .default()
        if ProcessInfo.processInfo.arguments.contains("--smoke-test") {
            let diagnostics = "window.addEventListener('error', e=>window.webkit.messageHandlers.native.postMessage({type:'diagnostic',message:e.message||('Resource failed: '+(e.target.src||e.target.href||e.target.tagName))}),true);window.addEventListener('unhandledrejection',e=>window.webkit.messageHandlers.native.postMessage({type:'diagnostic',message:String(e.reason)}));"
            configuration.userContentController.addUserScript(WKUserScript(source: diagnostics, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        configuration.setURLSchemeHandler(images, forURLScheme: "mdeditor-resource")
        webView = WKWebView(frame: .zero, configuration: configuration)
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 880),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.minSize = NSSize(width: 840, height: 560)
        window.title = "Mr. Markdown"
        if !ProcessInfo.processInfo.arguments.contains("--smoke-test") { window.setFrameAutosaveName("MD-Editor.Document") }
        window.contentView = webView
        super.init(window: window)
        shouldCascadeWindows = true
        window.center()
        let handler = WeakScriptHandler()
        handler.target = self
        configuration.userContentController.add(handler, name: "native")
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .windowBackgroundColor
        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        } else {
            webView.loadHTMLString("<h1>Mr. Markdown</h1><p>편집기 리소스를 찾지 못했습니다. 앱을 다시 빌드해 주세요.</p>", baseURL: nil)
        }
    }
    required init?(coder: NSCoder) { fatalError("No nib used") }
    deinit { /* WKWebView and its nonpersistent data store are scoped to the document window. */ }

    func send(_ value: [String: Any]) {
        guard ready, let data = try? JSONSerialization.data(withJSONObject: value),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.MDEditor.receive(\(json))", completionHandler: nil)
    }
    private func metadata(_ type: String) -> [String: Any] {
        images.root = markdown?.fileURL?.deletingLastPathComponent()
        var message: [String: Any] = ["type": type, "name": markdown?.displayName ?? "제목 없음"]
        if images.root != nil { message["baseURL"] = "mdeditor-resource://document/" }
        return message
    }
    func loadDocument() {
        var message = metadata("load")
        message["text"] = markdown?.text ?? ""
        send(message)
    }
    func documentSaved(text: String) {
        var message = metadata("saved")
        message["text"] = text
        send(message)
    }
    func command(_ command: String) {
        if command == "paste" {
            send(["type": "command", "command": command, "text": NSPasteboard.general.string(forType: .string) ?? ""])
        } else { send(["type": "command", "command": command]) }
    }

    func prepareDocument(_ completion: @escaping (Result<String, Error>) -> Void) {
        guard ready else { completion(.success(markdown?.text ?? "")); return }
        webView.callAsyncJavaScript("return await window.MDEditor.prepareClose();", arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                if let value = value as? String { completion(.success(value)) }
                else { completion(.failure(CocoaError(.fileWriteUnknown))) }
            case .failure(let error): completion(.failure(error))
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            send(["type": "fonts", "fonts": NSFontManager.shared.availableFontFamilies.sorted()])
            loadDocument()
            onReady?()
        case "change": if let text = body["text"] as? String { markdown?.updateText(text) }
        case "openLink":
            if let value = body["url"] as? String, let url = URL(string: value),
               ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") { NSWorkspace.shared.open(url) }
        case "chooseImage": chooseImage()
        case "clipboard":
            if let text = body["text"] as? String {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            }
        case "appearance":
            if let dark = body["dark"] as? Bool {
                window?.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
            }
        case "viewState":
            for key in ["lines", "editor", "preview"] {
                if let value = body[key] as? Bool { viewState[key] = value }
            }
        case "diagnostic":
            if ProcessInfo.processInfo.arguments.contains("--smoke-test") { print("WK diagnostic: \(body["message"] ?? "unknown")"); fflush(stdout) }
        default: break
        }
    }

    private func chooseImage() {
        guard let window else { return }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.png, .jpeg, .gif, .webP, .tiff, .svg]
        panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url, let self else { return }
            do {
                let attrs = try url.resourceValues(forKeys: [.fileSizeKey])
                guard (attrs.fileSize ?? 0) <= 20 * 1024 * 1024 else {
                    throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadTooLargeError,
                                  userInfo: [NSLocalizedDescriptionKey: "이미지는 20 MB 이하로 선택해 주세요."])
                }
                let data = try Data(contentsOf: url)
                let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "image/png"
                self.send(["type": "command", "command": "insertImage", "url": "data:\(mime);base64,\(data.base64EncodedString())", "alt": url.deletingPathExtension().lastPathComponent])
            } catch { self.markdown?.presentError(error) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .linkActivated {
            if let url = navigationAction.request.url, ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        } else if navigationAction.targetFrame?.isMainFrame == true,
                  let url = navigationAction.request.url, !url.isFileURL, url.scheme != "about" {
            decisionHandler(.cancel)
        } else { decisionHandler(.allow) }
    }

    func printPreview(printInfo: NSPrintInfo) {
        guard ready else { return }
        webView.callAsyncJavaScript("return await window.MDEditor.printHTML();", arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let value):
                guard let html = value as? String else { return }
                let printer = PreviewPrinter(info: printInfo, window: self.window, images: self.images)
                self.printer = printer
                printer.finished = { [weak self] in self?.printer = nil }
                printer.load(html)
            case .failure(let error): self.markdown?.presentError(error)
            }
        }
    }
}

@MainActor
final class PreviewPrinter: NSObject, WKNavigationDelegate {
    private let view: WKWebView
    private let info: NSPrintInfo
    private weak var window: NSWindow?
    var finished: (() -> Void)?
    init(info: NSPrintInfo, window: NSWindow?, images: DocumentImageHandler) {
        self.info = info.copy() as! NSPrintInfo
        self.window = window
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        config.setURLSchemeHandler(images, forURLScheme: "mdeditor-resource")
        view = WKWebView(frame: NSRect(x: 0, y: 0, width: 800, height: 1000), configuration: config)
        super.init()
        view.navigationDelegate = self
    }
    func load(_ html: String) { view.loadHTMLString(html, baseURL: URL(string: "mdeditor-resource://document/")) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        info.horizontalPagination = .fit
        let operation = webView.printOperation(with: info)
        operation.showsPrintPanel = true
        operation.showsProgressPanel = true
        if let window {
            operation.runModal(for: window, delegate: self, didRun: #selector(didPrint(_:success:context:)), contextInfo: nil)
        } else { _ = operation.run(); finished?() }
    }
    @objc private func didPrint(_ operation: NSPrintOperation, success: Bool, context: UnsafeMutableRawPointer?) { finished?() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finished?() }
}
