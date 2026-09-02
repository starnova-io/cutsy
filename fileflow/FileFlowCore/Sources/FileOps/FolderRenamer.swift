import Foundation
import RenameEngine

/// Applies a `RenamePipeline` to real files: builds contexts from URLs,
/// plans, applies with a two-phase move (so A→B / B→A swaps can't collide),
/// records an undo journal, and can revert it.
public struct FolderRenamer: Sendable {
    public enum Error: Swift.Error, Equatable {
        case sourceMissing(String)
        case destinationOccupied(String)
    }

    private let fileManager: FileManager

    public init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    /// Builds rename contexts (index order = input order) with filesystem dates.
    public func contexts(for urls: [URL]) -> [RenameContext] {
        urls.enumerated().map { index, url in
            let attributes = try? fileManager.attributesOfItem(atPath: url.path)
            return RenameContext(
                originalName: url.lastPathComponent,
                index: index,
                creationDate: attributes?[.creationDate] as? Date
                    ?? attributes?[.modificationDate] as? Date
            )
        }
    }

    /// Plans against the real directory contents so untouched siblings
    /// are reserved and cannot be clobbered.
    public func makePlan(
        pipeline: RenamePipeline,
        urls: [URL],
        contexts: [RenameContext]? = nil
    ) throws -> RenamePlan {
        let contexts = contexts ?? self.contexts(for: urls)
        let selectedNames = Set(urls.map { $0.lastPathComponent })
        var reserved = Set<String>()
        for directory in Set(urls.map { $0.deletingLastPathComponent() }) {
            let siblings = (try? fileManager.contentsOfDirectory(atPath: directory.path)) ?? []
            reserved.formUnion(siblings.filter { !selectedNames.contains($0) })
        }
        return try pipeline.makePlan(contexts: contexts, reservedNames: reserved)
    }

    /// Executes the plan. Phase 1 parks every changing file under a temporary
    /// unique name; phase 2 moves it to its final name. Returns the journal
    /// needed to undo. `progress` is called after each completed file.
    @discardableResult
    public func apply(
        plan: RenamePlan,
        urls: [URL],
        progress: (@Sendable (Int, Int) -> Void)? = nil
    ) throws -> UndoJournal {
        precondition(plan.items.count == urls.count, "plan and urls must align")

        var moves: [(from: URL, temp: URL, to: URL)] = []
        for (item, url) in zip(plan.items, urls) where item.status != .unchanged {
            guard fileManager.fileExists(atPath: url.path) else {
                throw Error.sourceMissing(item.originalName)
            }
            let directory = url.deletingLastPathComponent()
            let temp = directory.appendingPathComponent(".fileflow-tmp-\(UUID().uuidString)")
            let destination = directory.appendingPathComponent(item.newName)
            moves.append((url, temp, destination))
        }

        for move in moves {
            try fileManager.moveItem(at: move.from, to: move.temp)
        }
        var completed = 0
        for move in moves {
            if fileManager.fileExists(atPath: move.to.path) {
                // Reserved-name planning should prevent this; fail loudly if not.
                throw Error.destinationOccupied(move.to.lastPathComponent)
            }
            try fileManager.moveItem(at: move.temp, to: move.to)
            completed += 1
            progress?(completed, moves.count)
        }

        return UndoJournal(entries: moves.map {
            .init(directory: $0.from.deletingLastPathComponent().path,
                  originalName: $0.from.lastPathComponent,
                  newName: $0.to.lastPathComponent)
        })
    }

    /// Reverts a journal (newest batch of moves back to original names),
    /// using the same two-phase scheme.
    public func undo(_ journal: UndoJournal) throws {
        var moves: [(from: URL, temp: URL, to: URL)] = []
        for entry in journal.entries {
            let directory = URL(fileURLWithPath: entry.directory, isDirectory: true)
            let current = directory.appendingPathComponent(entry.newName)
            guard fileManager.fileExists(atPath: current.path) else {
                throw Error.sourceMissing(entry.newName)
            }
            let temp = directory.appendingPathComponent(".fileflow-tmp-\(UUID().uuidString)")
            moves.append((current, temp, directory.appendingPathComponent(entry.originalName)))
        }
        for move in moves { try fileManager.moveItem(at: move.from, to: move.temp) }
        for move in moves {
            if fileManager.fileExists(atPath: move.to.path) {
                throw Error.destinationOccupied(move.to.lastPathComponent)
            }
            try fileManager.moveItem(at: move.temp, to: move.to)
        }
    }
}

/// Serializable record of one applied batch, enough to reverse it.
public struct UndoJournal: Codable, Equatable, Sendable {
    public struct Entry: Codable, Equatable, Sendable {
        public let directory: String
        public let originalName: String
        public let newName: String
    }

    public var entries: [Entry]
    public var appliedAt: Date

    public init(entries: [Entry], appliedAt: Date = Date()) {
        self.entries = entries
        self.appliedAt = appliedAt
    }

    public var isEmpty: Bool { entries.isEmpty }
}
