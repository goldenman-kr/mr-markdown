import AppKit

@main
struct NativeDocumentTests {
    @MainActor static func main() throws {
        _ = NSApplication.shared
        let document = MarkdownDocument()
        let sample = "# 한글 문서\n\n**강조**와 café 👩🏽‍💻\n"
        try document.read(from: Data(sample.utf8), ofType: MarkdownDocument.markdownType)
        precondition(document.text == sample, "UTF-8 decoding must preserve Korean and emoji")
        let encoded = try document.data(ofType: MarkdownDocument.markdownType)
        precondition(encoded == Data(sample.utf8))
        document.updateText(sample + "추가")
        precondition(document.isDocumentEdited, "Changed text must mark the document dirty")
        document.updateText(sample)
        precondition(!document.isDocumentEdited, "Undoing to the saved baseline must clear dirty state")
        try document.read(from: Data([0xef, 0xbb, 0xbf]) + Data(sample.utf8), ofType: MarkdownDocument.markdownType)
        precondition(document.text == sample, "UTF-8 BOM must not become visible text")
        do {
            try document.read(from: Data([0xff, 0xfe]), ofType: MarkdownDocument.markdownType)
            fatalError("Invalid UTF-8 must fail instead of silently replacing characters")
        } catch { precondition((error as NSError).code == NSFileReadInapplicableStringEncodingError) }
        let controller = MarkdownDocumentController()
        let markdownType = try controller.typeForContents(of: URL(fileURLWithPath: "/tmp/sample.md"))
        precondition(markdownType == MarkdownDocument.markdownType)
        do {
            _ = try controller.typeForContents(of: URL(fileURLWithPath: "/tmp/sample.pdf"))
            fatalError("Binary files must not be opened as Markdown")
        } catch { precondition((error as NSError).code == NSFileReadUnknownError) }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let root = directory.appendingPathComponent("document")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try Data([0]).write(to: root.appendingPathComponent("image.png"))
        try Data([0]).write(to: root.appendingPathComponent("secret.txt"))
        try Data([0]).write(to: directory.appendingPathComponent("outside.png"))
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("escape.png"), withDestinationURL: directory.appendingPathComponent("outside.png"))
        let images = DocumentImageHandler()
        images.root = root
        let imageURL = try images.resourceURL(for: URL(string: "mdeditor-resource://document/image.png")!)
        precondition(imageURL == root.appendingPathComponent("image.png").resolvingSymlinksInPath())
        for path in ["../outside.png", "escape.png", "secret.txt"] {
            do {
                _ = try images.resourceURL(for: URL(string: "mdeditor-resource://document/" + path)!)
                fatalError("Image handler must deny directory escapes, escaping symlinks, and nonimages")
            } catch { precondition((error as NSError).code == NSFileReadNoPermissionError) }
        }
        print("Native tests passed: UTF-8, BOM, invalid encoding, dirty tracking, baseline reset, file types, image access, traversal/symlink containment.")
    }
}
