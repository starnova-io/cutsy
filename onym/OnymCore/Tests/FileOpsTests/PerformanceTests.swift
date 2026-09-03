import Foundation
import Testing
import RenameEngine
@testable import FileOps

/// Performance smoke tests: generous thresholds so slow CI never flakes,
/// with printed timings for humans watching a local run.
@Suite("Performance", .serialized)
struct PerformanceTests {
    let fm = FileManager.default

    private func measure(_ label: String, _ block: () throws -> Void) rethrows -> Double {
        let start = DispatchTime.now()
        try block()
        let seconds = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1e9
        print("[bench] \(label): \(String(format: "%.3f", seconds))s")
        return seconds
    }

    @Test func planning50kNamesWithDateTemplateIsFast() throws {
        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "IMG_", replace: "", caseSensitive: true),
            .template("Trip {date:yyyy-MM-dd} {model} {counter:4}"),
        ])
        let date = Date()
        let contexts = (0..<50_000).map {
            RenameContext(
                originalName: "IMG_\($0).jpg", index: $0,
                captureDate: date, cameraModel: "iPhone 15 Pro"
            )
        }
        var plan: RenamePlan?
        let seconds = try measure("plan 50k names ({date} template)") {
            plan = try pipeline.makePlan(contexts: contexts)
        }
        #expect(plan?.items.count == 50_000)
        #expect(plan?.changedCount == 50_000)
        // Interactive budget: full preview of a huge batch stays sub-10s
        // even on a slow CI container; typical hardware should be well under 1s.
        #expect(seconds < 10)
    }

    @Test func applyAndUndo10kFilesOnDisk() throws {
        let dir = fm.temporaryDirectory
            .appendingPathComponent("onym-bench-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: dir) }

        let names = (0..<10_000).map { String(format: "IMG_%05d.jpg", $0) }
        for name in names {
            fm.createFile(atPath: dir.appendingPathComponent(name).path, contents: Data())
        }
        let urls = names.map { dir.appendingPathComponent($0) }

        let pipeline = RenamePipeline(rules: [.template("Trip {counter:5}")])
        let renamer = FolderRenamer()

        var plan: RenamePlan?
        let planSeconds = try measure("plan 10k real files") {
            plan = try renamer.makePlan(pipeline: pipeline, urls: urls)
        }
        var journal: UndoJournal?
        let applySeconds = try measure("apply 10k renames (two-phase)") {
            journal = try renamer.apply(plan: plan!, urls: urls)
        }
        let undoSeconds = try measure("undo 10k renames") {
            try renamer.undo(journal!)
        }

        #expect(try Set(fm.contentsOfDirectory(atPath: dir.path)) == Set(names))
        #expect(planSeconds < 30)
        #expect(applySeconds < 60)
        #expect(undoSeconds < 60)
    }
}
