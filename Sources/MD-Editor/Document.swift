import AppKit
import WebKit
import UniformTypeIdentifiers

/// AppKit may read document contents off the main thread before creating its window.
private final class DocumentTextStorage: @unchecked Sendable {
    private let lock = NSLock()
    private var value = ""
    private var baseline = ""
    private var pendingWrite: String?
    var text: String { lock.withLock { value } }
    var saved: String { lock.withLock { baseline } }
    var dataForWriting: Data { lock.withLock { Data((pendingWrite ?? value).utf8) } }
    func load(_ text: String) { lock.withLock { value = text; baseline = text } }
    func edit(_ text: String) { lock.withLock { value = text } }
    func markSaved(_ text: String) { lock.withLock { baseline = text } }
    func beginWrite(_ text: String) { lock.withLock { pendingWrite = text } }
    func endWrite() { lock.withLock { pendingWrite = nil } }
}

@MainActor
@objc(MarkdownDocument)
final class MarkdownDocument: NSDocument {
    static let markdownType = "net.daringfireball.markdown"
    nonisolated private let storage = DocumentTextStorage()
    var text: String { storage.text }
    private var editor: EditorWindowController?
    private var saving = false
    private var queuedSaves: [() -> Void] = []
    override class var autosavesInPlace: Bool { false }

    override func makeWindowControllers() {
        let controller = EditorWindowController(document: self)
        editor = controller
        addWindowController(controller)
    }

    override func read(from data: Data, ofType typeName: String) throws {
        guard let value = String(data: data, encoding: .utf8) else {
            throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadInapplicableStringEncodingError,
                          userInfo: [NSLocalizedDescriptionKey: "UTF-8 Markdown 문서만 열 수 있습니다."])
        }
        storage.load(value.hasPrefix("\u{feff}") ? String(value.dropFirst()) : value)
        DispatchQueue.main.async { [weak self] in self?.editor?.loadDocument() }
    }

    override func data(ofType typeName: String) throws -> Data { storage.dataForWriting }

    func updateText(_ value: String) {
        guard value != text else { return }
        storage.edit(value)
        updateChangeCount(text == storage.saved ? .changeCleared : .changeDone)
    }

    private func flush(_ completion: @escaping (Bool) -> Void) {
        guard let editor else { completion(true); return }
        editor.prepareDocument { [weak self] result in
            switch result {
            case .success(let value): self?.updateText(value); completion(true)
            case .failure(let error): self?.presentError(error); completion(false)
            }
        }
    }

    override func save(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType,
                       completionHandler: @escaping (Error?) -> Void) {
        if saving {
            queuedSaves.append { [self] in self.save(to: url, ofType: typeName, for: saveOperation, completionHandler: completionHandler) }
            return
        }
        saving = true
        flush { [weak self] success in
            guard let self else { return }
            guard success else {
                self.finishSaving(error: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError), completionHandler: completionHandler)
                return
            }
            let snapshot = self.text
            self.storage.beginWrite(snapshot)
            self.writeDocument(to: url, ofType: typeName, for: saveOperation) { error in
                self.storage.endWrite()
                if error == nil {
                    self.storage.markSaved(snapshot)
                    self.updateChangeCount(self.text == snapshot ? .changeCleared : .changeDone)
                    self.editor?.documentSaved(text: snapshot)
                }
                self.finishSaving(error: error, completionHandler: completionHandler)
            }
        }
    }

    private func finishSaving(error: Error?, completionHandler: (Error?) -> Void) {
        saving = false
        completionHandler(error)
        if !queuedSaves.isEmpty { queuedSaves.removeFirst()() }
    }

    private func writeDocument(to url: URL, ofType typeName: String, for operation: NSDocument.SaveOperationType,
                               completionHandler: @escaping (Error?) -> Void) {
        super.save(to: url, ofType: typeName, for: operation, completionHandler: completionHandler)
    }

    override func canClose(withDelegate delegate: Any, shouldClose shouldCloseSelector: Selector?,
                           contextInfo: UnsafeMutableRawPointer?) {
        flush { [weak self] success in
            guard let self else { return }
            if success {
                self.finishClose(withDelegate: delegate, shouldClose: shouldCloseSelector, contextInfo: contextInfo)
            } else {
                guard let shouldCloseSelector else { return }
                typealias Callback = @convention(c) (AnyObject, Selector, NSDocument, Bool, UnsafeMutableRawPointer?) -> Void
                let object = delegate as AnyObject
                let callback = unsafeBitCast(object.method(for: shouldCloseSelector), to: Callback.self)
                callback(object, shouldCloseSelector, self, false, contextInfo)
            }
        }
    }

    private func finishClose(withDelegate delegate: Any, shouldClose selector: Selector?, contextInfo: UnsafeMutableRawPointer?) {
        super.canClose(withDelegate: delegate, shouldClose: selector, contextInfo: contextInfo)
    }

    @objc func editorCommand(_ sender: NSMenuItem) { editor?.command(sender.representedObject as? String ?? "") }
    @objc override func printDocument(_ sender: Any?) { editor?.printPreview(printInfo: printInfo) }
    var currentEditor: EditorWindowController? { editor }
}

@MainActor
final class MarkdownDocumentController: NSDocumentController {
    override var defaultType: String? { MarkdownDocument.markdownType }
    override func documentClass(forType typeName: String) -> AnyClass? { MarkdownDocument.self }
    override func noteNewRecentDocumentURL(_ url: URL) {
        guard !ProcessInfo.processInfo.arguments.contains("--smoke-test") else { return }
        super.noteNewRecentDocumentURL(url)
    }
    override func typeForContents(of url: URL) throws -> String {
        let ext = url.pathExtension.lowercased()
        guard ["md", "markdown", "mdown", "mkd", "txt"].contains(ext) else {
            throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadUnknownError,
                          userInfo: [NSLocalizedDescriptionKey: "Markdown 또는 텍스트 파일을 선택해 주세요."])
        }
        return MarkdownDocument.markdownType
    }
}
