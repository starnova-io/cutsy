import Foundation
import Testing
@testable import RenameEngine

private func context(
    _ name: String,
    index: Int = 0,
    capture: Date? = nil,
    model: String? = nil
) -> RenameContext {
    RenameContext(originalName: name, index: index, captureDate: capture, cameraModel: model)
}

private let aug21 = ISO8601DateFormatter().date(from: "2026-08-21T10:30:00Z")!

@Suite("Name parsing")
struct NameParsingTests {
    @Test func baseAndExtension() {
        #expect(context("IMG_1234.jpg").baseName == "IMG_1234")
        #expect(context("IMG_1234.jpg").fileExtension == "jpg")
        #expect(context("archive.tar.gz").baseName == "archive.tar")
        #expect(context("archive.tar.gz").fileExtension == "gz")
        #expect(context("README").baseName == "README")
        #expect(context("README").fileExtension == "")
        #expect(context(".gitignore").baseName == ".gitignore")
        #expect(context(".gitignore").fileExtension == "")
    }
}

@Suite("Individual rules")
struct RuleTests {
    @Test func findReplace() throws {
        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "IMG_", replace: "", caseSensitive: true)
        ])
        #expect(try pipeline.newName(for: context("IMG_1234.jpg")) == "1234.jpg")
    }

    @Test func findReplaceCaseInsensitive() throws {
        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "img_", replace: "photo-", caseSensitive: false)
        ])
        #expect(try pipeline.newName(for: context("IMG_1234.jpg")) == "photo-1234.jpg")
    }

    @Test func prefixAndSuffix() throws {
        let pipeline = RenamePipeline(rules: [.addPrefix("Trip "), .addSuffix(" final")])
        #expect(try pipeline.newName(for: context("beach.jpg")) == "Trip beach final.jpg")
    }

    @Test func caseTransforms() throws {
        #expect(try RenamePipeline(rules: [.changeCase(.lowercase)])
            .newName(for: context("IMG Beach.JPG")) == "img beach.JPG")
        #expect(try RenamePipeline(rules: [.changeCase(.uppercase)])
            .newName(for: context("beach.jpg")) == "BEACH.jpg")
        #expect(try RenamePipeline(rules: [.changeCase(.titlecase)])
            .newName(for: context("tokyo trip day one.jpg")) == "Tokyo Trip Day One.jpg")
    }

    @Test func counterPaddingAndStep() throws {
        let pipeline = RenamePipeline(rules: [
            .counter(start: 10, step: 5, padding: 4, position: .suffix, separator: "_")
        ])
        #expect(try pipeline.newName(for: context("a.jpg", index: 0)) == "a_0010.jpg")
        #expect(try pipeline.newName(for: context("a.jpg", index: 3)) == "a_0025.jpg")
    }

    @Test func counterPrefixPosition() throws {
        let pipeline = RenamePipeline(rules: [
            .counter(start: 1, step: 1, padding: 3, position: .prefix, separator: "-")
        ])
        #expect(try pipeline.newName(for: context("beach.jpg", index: 41)) == "042-beach.jpg")
    }

    @Test func regexReplaceWithCaptures() throws {
        let pipeline = RenamePipeline(rules: [
            .regexReplace(pattern: "^IMG_(\\d+)$", template: "photo-$1")
        ])
        #expect(try pipeline.newName(for: context("IMG_0042.jpg")) == "photo-0042.jpg")
    }

    @Test func invalidRegexThrows() {
        let pipeline = RenamePipeline(rules: [.regexReplace(pattern: "([", template: "x")])
        #expect(throws: (any Error).self) {
            try pipeline.newName(for: context("a.jpg"))
        }
    }

    @Test func changeExtension() throws {
        #expect(try RenamePipeline(rules: [.changeExtension("jpeg")])
            .newName(for: context("photo.jpg")) == "photo.jpeg")
        #expect(try RenamePipeline(rules: [.changeExtension("")])
            .newName(for: context("photo.jpg")) == "photo")
    }

    @Test func whitespaceRules() throws {
        #expect(try RenamePipeline(rules: [.replaceWhitespace(with: "_")])
            .newName(for: context("WhatsApp Image  2026.jpg")) == "WhatsApp_Image_2026.jpg")
        #expect(try RenamePipeline(rules: [.replaceWhitespace(with: "")])
            .newName(for: context("a b c.jpg")) == "abc.jpg")
        #expect(try RenamePipeline(rules: [.trimWhitespace])
            .newName(for: context("  padded  .jpg")) == "padded.jpg")
    }
}

@Suite("Token templates")
struct TemplateTests {
    @Test func tripTemplate() throws {
        let pipeline = RenamePipeline(rules: [.template("Tokyo Trip {date} {counter}")])
        let name = try pipeline.newName(for: context("IMG_1234.jpg", index: 0, capture: aug21))
        #expect(name == "Tokyo Trip 2026-08-21 001.jpg")
        let third = try pipeline.newName(for: context("IMG_1236.jpg", index: 2, capture: aug21))
        #expect(third == "Tokyo Trip 2026-08-21 003.jpg")
    }

    @Test func customDateFormatAndModel() throws {
        let pipeline = RenamePipeline(rules: [.template("{date:yyyyMMdd} {model} {counter:2}")])
        let name = try pipeline.newName(
            for: context("x.heic", index: 8, capture: aug21, model: "iPhone 15 Pro")
        )
        #expect(name == "20260821 iPhone 15 Pro 09.heic")
    }

    @Test func nameAndExtTokens() throws {
        let pipeline = RenamePipeline(rules: [.template("{name}_{ext}")])
        #expect(try pipeline.newName(for: context("beach.jpg")) == "beach_jpg.jpg")
    }

    @Test func unknownTokenRendersLiterally() throws {
        let pipeline = RenamePipeline(rules: [.template("{bogus}-{counter}")])
        #expect(try pipeline.newName(for: context("a.jpg", index: 0)) == "{bogus}-001.jpg")
    }

    @Test func templateAndRegexAreProGated() {
        #expect(RenamePipeline(rules: [.template("{counter}")]).requiresPro)
        #expect(RenamePipeline(rules: [.regexReplace(pattern: "a", template: "b")]).requiresPro)
        #expect(!RenamePipeline(rules: [.addPrefix("x"), .trimWhitespace]).requiresPro)
    }
}

@Suite("Chaining")
struct ChainTests {
    @Test func chainAppliesInOrder() throws {
        // Find "IMG_" → remove spaces → lowercase → add date → add counter
        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "IMG_", replace: "", caseSensitive: true),
            .replaceWhitespace(with: ""),
            .changeCase(.lowercase),
            .addSuffix("-2026-08-21"),
            .counter(start: 1, step: 1, padding: 3, position: .suffix, separator: "_"),
        ])
        let name = try pipeline.newName(for: context("IMG_My Beach.JPG", index: 1))
        #expect(name == "mybeach-2026-08-21_002.JPG")
    }

    @Test func orderMatters() throws {
        let prefixThenUpper = RenamePipeline(rules: [.addPrefix("go-"), .changeCase(.uppercase)])
        let upperThenPrefix = RenamePipeline(rules: [.changeCase(.uppercase), .addPrefix("go-")])
        #expect(try prefixThenUpper.newName(for: context("a.txt")) == "GO-A.txt")
        #expect(try upperThenPrefix.newName(for: context("a.txt")) == "go-A.txt")
    }
}

@Suite("Sanitizing and planning")
struct PlanTests {
    @Test func illegalCharactersAreSanitized() throws {
        let pipeline = RenamePipeline(rules: [.addPrefix("a/b: ")])
        #expect(try pipeline.newName(for: context("x.txt")) == "a-b- x.txt")
    }

    @Test func emptyResultFallsBackToOriginal() throws {
        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "photo", replace: "", caseSensitive: true)
        ])
        #expect(try pipeline.newName(for: context("photo.jpg")) == "photo.jpg")
    }

    @Test func planMarksUnchanged() throws {
        let pipeline = RenamePipeline(rules: [.trimWhitespace])
        let plan = try pipeline.makePlan(contexts: [context("clean.jpg")])
        #expect(plan.items[0].status == .unchanged)
        #expect(plan.changedCount == 0)
    }

    @Test func collisionsWithinBatchAreResolved() throws {
        let pipeline = RenamePipeline(rules: [.template("photo")])
        let plan = try pipeline.makePlan(contexts: [
            context("a.jpg", index: 0),
            context("b.jpg", index: 1),
            context("c.jpg", index: 2),
        ])
        #expect(plan.items.map(\.newName) == ["photo.jpg", "photo 2.jpg", "photo 3.jpg"])
        #expect(plan.conflictCount == 2)
    }

    @Test func reservedNamesAreAvoidedCaseInsensitively() throws {
        let pipeline = RenamePipeline(rules: [.changeCase(.lowercase)])
        let plan = try pipeline.makePlan(
            contexts: [context("PHOTO.jpg")],
            reservedNames: ["Photo.jpg"]
        )
        #expect(plan.items[0].newName == "photo 2.jpg")
        #expect(plan.items[0].status == .conflictResolved)
    }

    @Test func pipelineRoundTripsThroughCodable() throws {
        let pipeline = RenamePipeline(rules: [
            .findReplace(find: "a", replace: "b", caseSensitive: false),
            .counter(start: 1, step: 1, padding: 3, position: .suffix, separator: "-"),
            .template("{date} {counter}"),
            .changeExtension("png"),
        ])
        let data = try JSONEncoder().encode(pipeline)
        let decoded = try JSONDecoder().decode(RenamePipeline.self, from: data)
        #expect(decoded == pipeline)
    }
}
