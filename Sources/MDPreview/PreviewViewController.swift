import AppKit
import QuickLookUI
import WebKit
import UniformTypeIdentifiers
import OSLog

enum PreviewFailure {
    static func error(_ message: String, code: Int = 1) -> NSError {
        NSError(domain: "xyz.kryp.mdeditor.preview", code: code,
                userInfo: [NSLocalizedDescriptionKey: message])
    }
}

/// Files are opened only while reading; no document is created and nothing is written.
enum PreviewDocument {
    static let maximumBytes = 16 * 1024 * 1024

    static func read(_ url: URL) throws -> String {
        guard url.isFileURL else { throw PreviewFailure.error("로컬 Markdown 파일만 미리 볼 수 있습니다.") }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
        guard values.isRegularFile == true else { throw PreviewFailure.error("일반 파일만 미리 볼 수 있습니다.") }
        guard (values.fileSize ?? 0) <= maximumBytes else {
            throw PreviewFailure.error("16 MB 이하의 Markdown 파일만 미리 볼 수 있습니다.")
        }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let data = try handle.read(upToCount: maximumBytes + 1) ?? Data()
        guard data.count <= maximumBytes else { throw PreviewFailure.error("Markdown 파일이 너무 큽니다.") }
        guard let text = String(data: data, encoding: .utf8) else {
            throw PreviewFailure.error("UTF-8 Markdown 파일을 읽을 수 없습니다.")
        }
        return text.hasPrefix("\u{feff}") ? String(text.dropFirst()) : text
    }
}

@MainActor
private final class PreviewScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: PreviewViewController?
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

/// Only image files beneath the Markdown file's directory can pass this scheme.
@MainActor
final class PreviewImageHandler: NSObject, WKURLSchemeHandler {
    var root: URL?
    static let maximumBytes = 30 * 1024 * 1024

    func resourceURL(for requestURL: URL) throws -> URL {
        guard requestURL.scheme == "mdpreview-image", requestURL.host == "document", let root else {
            throw CocoaError(.fileReadNoPermission)
        }
        let resolvedRoot = root.resolvingSymlinksInPath().standardizedFileURL
        let relative = String(requestURL.path.drop(while: { $0 == "/" }))
        let target = resolvedRoot.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        guard target.path.hasPrefix(resolvedRoot.path + "/") else { throw CocoaError(.fileReadNoPermission) }
        let values = try target.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
        guard values.isRegularFile == true,
              let type = UTType(filenameExtension: target.pathExtension), type.conforms(to: .image),
              let size = values.fileSize, size <= Self.maximumBytes else {
            throw CocoaError(.fileReadNoPermission)
        }
        return target
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        do {
            guard let requestURL = task.request.url else { throw CocoaError(.fileReadNoPermission) }
            let target = try resourceURL(for: requestURL)
            let file = try FileHandle(forReadingFrom: target)
            defer { try? file.close() }
            let data = try file.read(upToCount: Self.maximumBytes + 1) ?? Data()
            guard data.count <= Self.maximumBytes else { throw CocoaError(.fileReadNoPermission) }
            let mime = UTType(filenameExtension: target.pathExtension)?.preferredMIMEType
            task.didReceive(URLResponse(url: requestURL, mimeType: mime, expectedContentLength: data.count,
                                        textEncodingName: nil))
            task.didReceive(data)
            task.didFinish()
        } catch { task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}

@MainActor
final class PreviewViewController: NSViewController, @preconcurrency QLPreviewingController, WKScriptMessageHandler, WKNavigationDelegate {
    private static let logger = Logger(subsystem: "xyz.kryp.mdeditor.preview", category: "rendering")
    private(set) var webView: WKWebView?
    private var completion: ((Error?) -> Void)?
    private var requestID: String?
    private var payload: [String: String]?
    private var pageReady = false
    private var timeout: DispatchWorkItem?
    private var injectedPreviewURL: URL?
    private var loadedPreviewURL: URL?

    /// Tests use the same controller with the built renderer, without invoking Finder's host.
    convenience init(previewURL: URL) {
        self.init(nibName: nil, bundle: nil)
        injectedPreviewURL = previewURL
    }

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 900, height: 720))
        preferredContentSize = view.frame.size
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        finish(PreviewFailure.error("다른 미리보기 요청으로 취소되었습니다.", code: NSUserCancelledError))
        webView?.stopLoading()
        webView?.removeFromSuperview()
        webView = nil
        completion = handler
        let id = UUID().uuidString
        requestID = id
        payload = nil
        pageReady = false

        let bundle = Bundle(for: Self.self)
        guard let previewURL = injectedPreviewURL ?? bundle.url(forResource: "index", withExtension: "html", subdirectory: "preview") else {
            finish(PreviewFailure.error("미리보기 렌더러를 찾을 수 없습니다."))
            return
        }
        _ = view
        let images = PreviewImageHandler()
        images.root = url.deletingLastPathComponent()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.setURLSchemeHandler(images, forURLScheme: "mdpreview-image")
        let proxy = PreviewScriptHandler()
        proxy.target = self
        configuration.userContentController.add(proxy, name: "preview")
        let web = WKWebView(frame: view.bounds, configuration: configuration)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self
        web.allowsBackForwardNavigationGestures = false
        view.addSubview(web)
        webView = web
        loadedPreviewURL = previewURL
        web.loadFileURL(previewURL, allowingReadAccessTo: previewURL.deletingLastPathComponent())
        let timeout = DispatchWorkItem { [weak self] in
            guard self?.requestID == id else { return }
            self?.finish(PreviewFailure.error("미리보기 생성 시간이 초과되었습니다."))
        }
        self.timeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 30, execute: timeout)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let result = Result { try PreviewDocument.read(url) }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.requestID == id, self.completion != nil else { return }
                switch result {
                case .success(let text):
                    self.payload = ["text": text, "name": url.lastPathComponent, "requestId": id,
                                    "baseURL": "mdpreview-image://document/"]
                    self.sendDocumentIfReady()
                case .failure(let error): self.finish(error)
                }
            }
        }
    }

    private func sendDocumentIfReady() {
        guard pageReady, let payload, let webView, let id = requestID else { return }
        self.payload = nil
        do {
            let json = try JSONSerialization.data(withJSONObject: payload, options: [.fragmentsAllowed])
            let literal = String(decoding: json, as: UTF8.self)
            webView.evaluateJavaScript("window.MDPreview.load(\(literal))") { [weak self] _, error in
                guard self?.requestID == id else { return }
                if let error { self?.finish(error) }
            }
        } catch { finish(error) }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.webView === webView, message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "ready" { pageReady = true; sendDocumentIfReady(); return }
        guard body["requestId"] as? String == requestID else { return }
        if type == "rendered" {
            // No document paths or content enter logs. This also distinguishes a
            // finished render from a WebKit page that merely launched successfully.
            if completion != nil {
                let loadedImages = body["loadedImages"] as? Int ?? -1
                Self.logger.notice("Markdown Quick Look render completed; loaded images: \(loadedImages)")
            }
            finish(nil)
        }
        else if type == "error" {
            finish(PreviewFailure.error(body["message"] as? String ?? "Markdown 미리보기를 만들 수 없습니다."))
        }
    }

    private func finish(_ error: Error?) {
        timeout?.cancel()
        timeout = nil
        guard let completion else { return }
        self.completion = nil
        completion(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if webView === self.webView { finish(error) }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if webView === self.webView { finish(error) }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView === self.webView { finish(PreviewFailure.error("미리보기 렌더러가 종료되었습니다.")) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Quick Look is read-only; links never open apps or navigate to other local/remote files.
        guard let url = navigationAction.request.url, url.isFileURL,
              url.standardizedFileURL.path == loadedPreviewURL?.standardizedFileURL.path else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}
