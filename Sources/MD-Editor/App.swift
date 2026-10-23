import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate, NSMenuItemValidation {
    let documents = MarkdownDocumentController()
    private var recentMenu: NSMenu!
    private var favoritesMenu: NSMenu!
    private let favoritesKey = "MD-Editor.Favorites"
    private var smoke: NativeSmokeTest?

    func applicationWillFinishLaunching(_ notification: Notification) { buildMenus() }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.activate(ignoringOtherApps: true)
        if ProcessInfo.processInfo.arguments.contains("--smoke-test") {
            let smoke = NativeSmokeTest(controller: documents)
            self.smoke = smoke
            smoke.run()
        }
    }
    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool { !ProcessInfo.processInfo.arguments.contains("--smoke-test") }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            if url.isFileURL { open(url) }
            else if url.scheme == "mdeditor" {
                // A deep link opens the app. File paths from external links are never opened silently.
                if documents.documents.isEmpty { documents.newDocument(nil) }
                NSApp.activate(ignoringOtherApps: true)
            }
        }
    }

    private func buildMenus() {
        let main = NSMenu()
        NSApp.mainMenu = main
        let app = submenu("Mr. Markdown", in: main)
        item("Mr. Markdown에 관하여", action: #selector(about), in: app, target: self)
        item("Mr. Markdown 웹사이트", action: #selector(website), in: app, target: self)
        app.addItem(.separator())
        let services = submenu("서비스", in: app)
        NSApp.servicesMenu = services
        app.addItem(.separator())
        item("Mr. Markdown 가리기", action: #selector(NSApplication.hide(_:)), key: "h", in: app)
        let hide = item("기타 가리기", action: #selector(NSApplication.hideOtherApplications(_:)), key: "h", in: app)
        hide.keyEquivalentModifierMask = [.command, .option]
        item("모두 보기", action: #selector(NSApplication.unhideAllApplications(_:)), in: app)
        app.addItem(.separator())
        item("Mr. Markdown 종료", action: #selector(NSApplication.terminate(_:)), key: "q", in: app)

        let file = submenu("파일", in: main)
        item("새 문서", action: #selector(NSDocumentController.newDocument(_:)), key: "n", in: file, target: documents)
        item("열기…", action: #selector(NSDocumentController.openDocument(_:)), key: "o", in: file, target: documents)
        recentMenu = submenu("최근 파일", in: file)
        recentMenu.delegate = self
        file.addItem(.separator())
        item("닫기", action: #selector(NSWindow.performClose(_:)), key: "w", in: file)
        item("저장", action: #selector(NSDocument.save(_:)), key: "s", in: file)
        let saveAs = item("새 이름으로 저장…", action: #selector(NSDocument.saveAs(_:)), key: "s", in: file)
        saveAs.keyEquivalentModifierMask = [.command, .shift]
        favoritesMenu = submenu("즐겨찾기", in: file)
        favoritesMenu.delegate = self
        file.addItem(.separator())
        item("인쇄…", action: #selector(NSDocument.printDocument(_:)), key: "p", in: file)

        let edit = submenu("편집", in: main)
        command("되돌리기", "undo", key: "z", in: edit)
        let redo = command("다시 실행", "redo", key: "z", in: edit)
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        command("잘라내기", "cut", key: "x", in: edit)
        command("복사", "copy", key: "c", in: edit)
        command("붙여넣기", "paste", key: "v", in: edit)
        command("모두 선택", "selectAll", key: "a", in: edit)
        edit.addItem(.separator())
        command("찾기…", "find", key: "f", in: edit)
        let replace = command("바꾸기…", "replace", key: "f", in: edit)
        replace.keyEquivalentModifierMask = [.command, .option]
        edit.addItem(.separator())
        command("굵게", "bold", key: "b", in: edit)
        command("기울임", "italic", key: "i", in: edit)

        let view = submenu("보기", in: main)
        command("줄 번호 보기", "toggleLines", in: view)
        command("편집창 가리기", "toggleEditor", in: view)
        command("미리보기창 가리기", "togglePreview", in: view)
        view.addItem(.separator())
        item("전체 화면 시작", action: #selector(NSWindow.toggleFullScreen(_:)), key: "f", in: view).keyEquivalentModifierMask = [.command, .control]

        let window = submenu("윈도우", in: main)
        item("최소화", action: #selector(NSWindow.performMiniaturize(_:)), key: "m", in: window)
        item("확대/축소", action: #selector(NSWindow.performZoom(_:)), in: window)
        window.addItem(.separator())
        item("모든 윈도우 앞으로 가져오기", action: #selector(NSApplication.arrangeInFront(_:)), in: window)
        NSApp.windowsMenu = window

        let help = submenu("도움말", in: main)
        item("Mr. Markdown 사용 방법", action: #selector(helpWindow), key: "?", in: help, target: self)
        item("웹사이트 방문", action: #selector(website), in: help, target: self)
        NSApp.helpMenu = help
    }

    private func submenu(_ title: String, in parent: NSMenu) -> NSMenu {
        let menu = NSMenu(title: title)
        let entry = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        entry.submenu = menu
        parent.addItem(entry)
        return menu
    }
    @discardableResult private func item(_ title: String, action: Selector, key: String = "", in menu: NSMenu, target: AnyObject? = nil) -> NSMenuItem {
        let entry = NSMenuItem(title: title, action: action, keyEquivalent: key)
        entry.target = target
        menu.addItem(entry)
        return entry
    }
    @discardableResult private func command(_ title: String, _ command: String, key: String = "", in menu: NSMenu) -> NSMenuItem {
        let entry = item(title, action: #selector(runEditorCommand(_:)), key: key, in: menu, target: self)
        entry.representedObject = command
        return entry
    }
    private var current: MarkdownDocument? { documents.currentDocument as? MarkdownDocument }
    @objc private func runEditorCommand(_ sender: NSMenuItem) { current?.editorCommand(sender) }
    @objc private func openMenuFile(_ sender: NSMenuItem) { if let url = sender.representedObject as? URL { open(url) } }
    private func open(_ url: URL) {
        documents.openDocument(withContentsOf: url, display: true) { _, _, error in
            if let error { NSApp.presentError(error) }
        }
    }
    @objc private func clearRecent(_ sender: Any?) { documents.clearRecentDocuments(sender) }
    @objc private func favoriteCurrent(_ sender: Any?) {
        guard let url = current?.fileURL else { return }
        var paths = UserDefaults.standard.stringArray(forKey: favoritesKey) ?? []
        if !paths.contains(url.path) { paths.append(url.path) }
        UserDefaults.standard.set(paths, forKey: favoritesKey)
    }
    @objc private func clearFavorites(_ sender: Any?) { UserDefaults.standard.removeObject(forKey: favoritesKey) }
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        if menu === recentMenu {
            for url in documents.recentDocumentURLs {
                item(url.lastPathComponent, action: #selector(openMenuFile(_:)), in: menu, target: self).representedObject = url
            }
            if menu.items.isEmpty { item("최근 파일 없음", action: #selector(noAction), in: menu, target: self) }
            menu.addItem(.separator())
            item("목록 지우기", action: #selector(clearRecent(_:)), in: menu, target: self)
        } else {
            item("이 파일 추가하기", action: #selector(favoriteCurrent(_:)), in: menu, target: self)
            menu.addItem(.separator())
            let paths = UserDefaults.standard.stringArray(forKey: favoritesKey) ?? []
            for path in paths {
                let url = URL(fileURLWithPath: path)
                let entry = item(url.lastPathComponent, action: #selector(openMenuFile(_:)), in: menu, target: self)
                entry.representedObject = url
                entry.toolTip = path
            }
            if paths.isEmpty { item("즐겨찾기 없음", action: #selector(noAction), in: menu, target: self) }
            menu.addItem(.separator())
            item("즐겨찾기 목록 지우기", action: #selector(clearFavorites(_:)), in: menu, target: self)
        }
    }
    @objc private func noAction() {}
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(noAction) { return false }
        if menuItem.action == #selector(favoriteCurrent(_:)) { return current?.fileURL != nil }
        if menuItem.action == #selector(runEditorCommand(_:)) {
            guard let editor = current?.currentEditor else { return false }
            switch menuItem.representedObject as? String {
            case "toggleLines": menuItem.state = editor.viewState["lines"] == true ? .on : .off
            case "toggleEditor": menuItem.title = editor.viewState["editor"] == true ? "편집창 가리기" : "편집창 보기"
            case "togglePreview": menuItem.title = editor.viewState["preview"] == true ? "미리보기창 가리기" : "미리보기창 보기"
            default: break
            }
            return true
        }
        return true
    }
    @objc private func website() { NSWorkspace.shared.open(URL(string: "https://mdeditor.app.kryp.xyz")!) }
    @objc private func about() {
        NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "Mr. Markdown", .applicationVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.1.0", .credits: NSAttributedString(string: "Markdown 문서 편집기\nhttps://mdeditor.app.kryp.xyz")])
    }
    @objc private func helpWindow() {
        let alert = NSAlert()
        alert.messageText = "Mr. Markdown 사용 방법"
        alert.informativeText = "왼쪽에서 Markdown 원문을 편집하고 오른쪽에서 결과를 확인합니다.\n\n⌘N 새 문서 · ⌘O 열기 · ⌘S 저장\n⇧⌘S 새 이름으로 저장 · ⌘P 인쇄\n⌘B 굵게 · ⌘I 기울임 · ⌘F 찾기\n⌥⌘F 바꾸기\n\n각 창 위에서 폰트·크기·테마를 설정합니다. 미리보기의 ‘편집창과 같음’을 선택하면 두 창의 설정이 동기화됩니다. 보기 메뉴에서 줄 번호와 창 표시를 바꿀 수 있습니다."
        alert.runModal()
    }
}

@main
struct MDApp {
    @MainActor static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = AppDelegate()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
