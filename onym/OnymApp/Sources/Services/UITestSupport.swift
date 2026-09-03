import Foundation

/// Hooks for the XCUITest suite. Active only when the app is launched with
/// `--uitest`; ships in the binary but is inert in production.
///
/// Launch arguments:
///   --uitest            seed sample files and auto-select them as a folder source
///   --uitest-files=N    number of seeded files (default 3)
///   --uitest-pro        grant Pro without StoreKit
enum UITestSupport {
    static var isActive: Bool {
        ProcessInfo.processInfo.arguments.contains("--uitest")
    }

    static var sampleDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("UITest Sample", isDirectory: true)
    }

    @MainActor
    static func prepareIfNeeded(entitlements: EntitlementStore) {
        guard isActive else { return }
        entitlements.testOverridePro =
            ProcessInfo.processInfo.arguments.contains("--uitest-pro")

        let count = ProcessInfo.processInfo.arguments
            .first { $0.hasPrefix("--uitest-files=") }
            .flatMap { Int($0.dropFirst("--uitest-files=".count)) } ?? 3

        let fm = FileManager.default
        try? fm.removeItem(at: sampleDirectory)
        try? fm.createDirectory(at: sampleDirectory, withIntermediateDirectories: true)
        for index in 1...max(count, 1) {
            let name = String(format: "IMG_%04d.jpg", index)
            fm.createFile(
                atPath: sampleDirectory.appendingPathComponent(name).path,
                contents: Data("sample \(index)".utf8)
            )
        }
    }

    @MainActor
    static func seedSelectionIfNeeded(into model: AppModel) {
        guard isActive else { return }
        if let files = try? FolderLoader.loadFiles(in: sampleDirectory) {
            model.selection = .folder(root: sampleDirectory, files: files)
        }
    }
}
