import Foundation
import Testing
import RenameEngine
@testable import FileOps

/// End-to-end tests of the engine against a real filesystem:
/// create files in a temp directory, plan, apply, verify on disk, undo.
@Suite("FolderRenamer on a real filesystem")
struct FolderRenamerTests {
    let fm = FileManager.default

    func makeSandbox(files: [String]) throws -> URL {
        let dir = fm.temporaryDirectory
            .appendingPathComponent("namesy-tests-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        for name in files {
            fm.createFile(atPath: dir.appendingPathComponent(name).path,
                          contents: Data(name.utf8))
        }
        return dir
    }

    func names(in dir: URL) throws -> Set<String> {
        Set(try fm.contentsOfDirectory(atPath: dir.path))
    }

    @Test func applyRenamesOnDisk() throws {
        let dir = try makeSandbox(files: ["IMG_1234.jpg", "IMG_1235.jpg", "IMG_1236.jpg"])
        defer { try? fm.removeItem(at: dir) }
        let urls = ["IMG_1234.jpg", "IMG_1235.jpg", "IMG_1236.jpg"]
            .map { dir.appendingPathComponent($0) }

        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "IMG_", replace: "Beach ", caseSensitive: true),
        ])
        let renamer = FolderRenamer()
        let plan = try renamer.makePlan(pipeline: pipeline, urls: urls)
        try renamer.apply(plan: plan, urls: urls)

        #expect(try names(in: dir) == ["Beach 1234.jpg", "Beach 1235.jpg", "Beach 1236.jpg"])
        // Content moved with the file, not recreated.
        let moved = dir.appendingPathComponent("Beach 1234.jpg")
        #expect(try String(contentsOf: moved, encoding: .utf8) == "IMG_1234.jpg")
    }

    @Test func planningIsDryRun() throws {
        let dir = try makeSandbox(files: ["a.txt"])
        defer { try? fm.removeItem(at: dir) }
        let urls = [dir.appendingPathComponent("a.txt")]

        let pipeline = RenamePipeline(rules: [.addPrefix("renamed-")])
        _ = try FolderRenamer().makePlan(pipeline: pipeline, urls: urls)

        #expect(try names(in: dir) == ["a.txt"])
    }

    @Test func swapCollisionIsHandledByTwoPhaseMove() throws {
        // a→b while b→a: naive sequential moves would clobber.
        let dir = try makeSandbox(files: ["a.txt", "b.txt"])
        defer { try? fm.removeItem(at: dir) }
        let urls = ["a.txt", "b.txt"].map { dir.appendingPathComponent($0) }

        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "a", replace: "TMP", caseSensitive: true),
            .findReplace(find: "b", replace: "a", caseSensitive: true),
            .findReplace(find: "TMP", replace: "b", caseSensitive: true),
        ])
        let renamer = FolderRenamer()
        let plan = try renamer.makePlan(pipeline: pipeline, urls: urls)
        #expect(plan.items.map(\.newName) == ["b.txt", "a.txt"])
        try renamer.apply(plan: plan, urls: urls)

        #expect(try names(in: dir) == ["a.txt", "b.txt"])
        // Contents prove the swap actually happened.
        #expect(try String(contentsOf: dir.appendingPathComponent("b.txt"), encoding: .utf8) == "a.txt")
        #expect(try String(contentsOf: dir.appendingPathComponent("a.txt"), encoding: .utf8) == "b.txt")
    }

    @Test func untouchedSiblingsAreNeverClobbered() throws {
        let dir = try makeSandbox(files: ["photo.jpg", "PHOTO 1.jpg"])
        defer { try? fm.removeItem(at: dir) }
        // Only rename photo.jpg → "PHOTO 1.jpg" would collide with the sibling.
        let urls = [dir.appendingPathComponent("photo.jpg")]

        let pipeline = RenamePipeline(rules: [
            .changeCase(.uppercase),
            .addSuffix(" 1"),
        ])
        let renamer = FolderRenamer()
        let plan = try renamer.makePlan(pipeline: pipeline, urls: urls)
        #expect(plan.items[0].status == .conflictResolved)
        try renamer.apply(plan: plan, urls: urls)

        let result = try names(in: dir)
        #expect(result.contains("PHOTO 1.jpg"))
        #expect(result.count == 2)
        // The sibling's content is intact.
        let sibling = dir.appendingPathComponent("PHOTO 1.jpg")
        #expect(try String(contentsOf: sibling, encoding: .utf8) == "PHOTO 1.jpg")
    }

    @Test func undoRestoresOriginalNames() throws {
        let original = ["IMG_0001.jpg", "IMG_0002.jpg", "notes.txt"]
        let dir = try makeSandbox(files: original)
        defer { try? fm.removeItem(at: dir) }
        let urls = original.map { dir.appendingPathComponent($0) }

        let pipeline = RenamePipeline(rules: [.template("Trip {counter}")])
        let renamer = FolderRenamer()
        let plan = try renamer.makePlan(pipeline: pipeline, urls: urls)
        let journal = try renamer.apply(plan: plan, urls: urls)

        #expect(try names(in: dir) == ["Trip 001.jpg", "Trip 002.jpg", "Trip 003.txt"])
        try renamer.undo(journal)
        #expect(try names(in: dir) == Set(original))
    }

    @Test func journalRoundTripsThroughCodable() throws {
        let journal = UndoJournal(entries: [
            .init(directory: "/tmp/x", originalName: "a.jpg", newName: "b.jpg")
        ])
        let data = try JSONEncoder().encode(journal)
        let decoded = try JSONDecoder().decode(UndoJournal.self, from: data)
        #expect(decoded.entries == journal.entries)
    }

    @Test func progressIsReportedPerFile() throws {
        let files = (1...5).map { "f\($0).txt" }
        let dir = try makeSandbox(files: files)
        defer { try? fm.removeItem(at: dir) }
        let urls = files.map { dir.appendingPathComponent($0) }

        let pipeline = RenamePipeline(rules: [.addPrefix("out-")])
        let renamer = FolderRenamer()
        let plan = try renamer.makePlan(pipeline: pipeline, urls: urls)

        final class Box: @unchecked Sendable { var ticks: [Int] = [] }
        let box = Box()
        try renamer.apply(plan: plan, urls: urls) { done, _ in box.ticks.append(done) }
        #expect(box.ticks == [1, 2, 3, 4, 5])
    }

    @Test func missingSourceThrowsBeforeAnyMove() throws {
        let dir = try makeSandbox(files: ["real.txt"])
        defer { try? fm.removeItem(at: dir) }
        let urls = [dir.appendingPathComponent("ghost.txt")]
        let pipeline = RenamePipeline(rules: [.addPrefix("x-")])
        let plan = try pipeline.makePlan(contexts: [
            RenameContext(originalName: "ghost.txt", index: 0)
        ])
        #expect(throws: FolderRenamer.Error.sourceMissing("ghost.txt")) {
            try FolderRenamer().apply(plan: plan, urls: urls)
        }
        #expect(try names(in: dir) == ["real.txt"])
    }
}
