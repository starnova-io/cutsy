import Foundation
import Observation
import RenameEngine
import FileOps

/// What the user has picked to rename.
enum FileSelection: Equatable {
    /// Files inside a folder the user granted access to — renamed in place.
    case folder(root: URL, files: [URL])
    /// Photos imported from the library as temp copies — exported with new names.
    case photos([ImportedPhoto])

    var count: Int {
        switch self {
        case let .folder(_, files): return files.count
        case let .photos(photos): return photos.count
        }
    }

    var displayName: String {
        switch self {
        case let .folder(root, files): return "\(root.lastPathComponent) · \(files.count) files"
        case let .photos(photos): return "Photos · \(photos.count) items"
        }
    }
}

struct ImportedPhoto: Equatable, Sendable {
    let url: URL
    let captureDate: Date?
    let cameraModel: String?
}

enum ApplyOutcome: Equatable {
    case renamed(count: Int, journal: UndoJournal)
    case exported(count: Int, destination: URL)
}

@MainActor
@Observable
final class AppModel {
    var selection: FileSelection?
    var rules: [RenameRule] = []
    var isApplying = false
    var applyProgress: Double = 0
    var lastOutcome: ApplyOutcome?
    var lastError: String?
    /// Journal of the most recent in-place batch, kept for Undo.
    var undoJournal: UndoJournal?

    let entitlements: EntitlementStore
    private let renamer = FolderRenamer()

    init(entitlements: EntitlementStore) {
        self.entitlements = entitlements
    }

    var pipeline: RenamePipeline { RenamePipeline(rules: rules) }

    var isOverFreeLimit: Bool {
        guard let selection else { return false }
        return !entitlements.isPro && selection.count > FreeTier.maxFilesPerRun
    }

    var usesProRules: Bool { !entitlements.isPro && pipeline.requiresPro }

    /// Reason the Apply button is blocked by the paywall, if any.
    var paywallReason: String? {
        if isOverFreeLimit {
            return "Free renames up to \(FreeTier.maxFilesPerRun) files per run. Go Pro for unlimited files."
        }
        if usesProRules {
            return "Templates and regex are Pro rules."
        }
        return nil
    }

    // MARK: Contexts & planning

    func contexts() -> [RenameContext] {
        switch selection {
        case .none:
            return []
        case let .folder(_, files):
            return renamer.contexts(for: files)
        case let .photos(photos):
            return photos.enumerated().map { index, photo in
                RenameContext(
                    originalName: photo.url.lastPathComponent,
                    index: index,
                    creationDate: nil,
                    captureDate: photo.captureDate,
                    cameraModel: photo.cameraModel
                )
            }
        }
    }

    func makePlan() throws -> RenamePlan {
        switch selection {
        case .none:
            return RenamePlan(items: [])
        case let .folder(_, files):
            return try renamer.makePlan(pipeline: pipeline, urls: files)
        case .photos:
            return try pipeline.makePlan(contexts: contexts())
        }
    }

    /// First few rows for the live preview under the rule builder.
    func livePreview(limit: Int = 3) -> [(before: String, after: String)] {
        let sample = Array(contexts().prefix(limit))
        return sample.compactMap { context in
            guard let name = try? pipeline.newName(for: context) else { return nil }
            return (context.originalName, name)
        }
    }

    // MARK: Applying

    /// In-place rename for folder selections.
    func applyToFolder() async {
        guard case let .folder(root, files) = selection else { return }
        isApplying = true
        applyProgress = 0
        defer { isApplying = false }
        do {
            let accessing = root.startAccessingSecurityScopedResource()
            defer { if accessing { root.stopAccessingSecurityScopedResource() } }
            let plan = try renamer.makePlan(pipeline: pipeline, urls: files)
            let total = max(plan.changedCount, 1)
            // Update at most ~100 times per batch — one hop to the main
            // actor per file would flood it on large folders.
            let stride = max(total / 100, 1)
            let journal = try renamer.apply(plan: plan, urls: files) { done, _ in
                guard done % stride == 0 || done == total else { return }
                Task { @MainActor in self.applyProgress = Double(done) / Double(total) }
            }
            undoJournal = journal
            lastOutcome = .renamed(count: plan.changedCount, journal: journal)
            // Keep the selection usable: point at the new names.
            let renamed = zip(plan.items, files).map { item, url in
                url.deletingLastPathComponent().appendingPathComponent(item.newName)
            }
            selection = .folder(root: root, files: renamed)
        } catch {
            lastError = friendlyMessage(for: error)
        }
    }

    /// Copies imported photos into `destination` under their new names.
    func exportPhotos(to destination: URL) async {
        guard case let .photos(photos) = selection else { return }
        isApplying = true
        applyProgress = 0
        defer { isApplying = false }
        do {
            let accessing = destination.startAccessingSecurityScopedResource()
            defer { if accessing { destination.stopAccessingSecurityScopedResource() } }
            let existing = (try? FileManager.default
                .contentsOfDirectory(atPath: destination.path)) ?? []
            let plan = try pipeline.makePlan(
                contexts: contexts(),
                reservedNames: Set(existing)
            )
            for (index, pair) in zip(plan.items, photos).enumerated() {
                let target = destination.appendingPathComponent(pair.0.newName)
                try FileManager.default.copyItem(at: pair.1.url, to: target)
                applyProgress = Double(index + 1) / Double(photos.count)
            }
            lastOutcome = .exported(count: photos.count, destination: destination)
        } catch {
            lastError = friendlyMessage(for: error)
        }
    }

    func undoLastBatch() {
        guard let journal = undoJournal else { return }
        do {
            var root: URL?
            if case let .folder(folderRoot, _) = selection { root = folderRoot }
            let accessing = root?.startAccessingSecurityScopedResource() ?? false
            defer { if accessing { root?.stopAccessingSecurityScopedResource() } }
            try renamer.undo(journal)
            undoJournal = nil
            lastOutcome = nil
            // The journal only covers changed files, so reload the folder
            // rather than reconstructing paths from it.
            if case let .folder(folderRoot, files) = selection {
                let reloaded = (try? FolderLoader.loadFiles(in: folderRoot)) ?? files
                selection = .folder(root: folderRoot, files: reloaded)
            }
        } catch {
            lastError = friendlyMessage(for: error)
        }
    }

    func reset() {
        selection = nil
        lastOutcome = nil
        lastError = nil
    }

    private func friendlyMessage(for error: Error) -> String {
        switch error {
        case FolderRenamer.Error.sourceMissing(let name):
            return "\"\(name)\" no longer exists. Reload the folder and try again."
        case FolderRenamer.Error.destinationOccupied(let name):
            return "A file named \"\(name)\" already exists. Adjust your rules and try again."
        default:
            return error.localizedDescription
        }
    }
}

enum FreeTier {
    static let maxFilesPerRun = 20
}
