import Foundation
import SwiftData
import RenameEngine

/// A saved rule pipeline. Rules are stored as JSON so the schema stays
/// stable across RenameRule additions.
@Model
final class Preset {
    var name: String
    var rulesData: Data
    var createdAt: Date

    init(name: String, pipeline: RenamePipeline, createdAt: Date = Date()) throws {
        self.name = name
        self.rulesData = try JSONEncoder().encode(pipeline)
        self.createdAt = createdAt
    }

    var pipeline: RenamePipeline? {
        try? JSONDecoder().decode(RenamePipeline.self, from: rulesData)
    }
}
