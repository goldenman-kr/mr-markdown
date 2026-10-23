// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MrMarkdown",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "MrMarkdown", targets: ["MD-Editor"])],
    targets: [.executableTarget(name: "MD-Editor", path: "Sources/MD-Editor", exclude: ["Info.plist"])]
)
