import Foundation

/// An ordered chain of rules plus the logic that turns a batch of contexts
/// into a conflict-free rename plan. Pure computation — no filesystem access.
public struct RenamePipeline: Codable, Equatable, Sendable {
    public var rules: [RenameRule]

    public init(rules: [RenameRule]) {
        self.rules = rules
    }

    public var requiresPro: Bool { rules.contains { $0.requiresPro } }

    /// Computes the new full name (base + extension) for one file.
    public func newName(for context: RenameContext) throws -> String {
        var base = context.baseName
        var ext = context.fileExtension
        for rule in rules {
            if case let .changeExtension(newExt) = rule {
                ext = newExt
            } else {
                base = try rule.apply(to: base, context: context)
            }
        }
        base = Self.sanitize(base)
        if base.isEmpty { base = context.baseName }
        return ext.isEmpty ? base : "\(base).\(ext)"
    }

    /// Builds the full plan for a batch: applies the chain to every context,
    /// then resolves name collisions (within the batch and against
    /// `reservedNames`, e.g. untouched siblings in the same folder).
    public func makePlan(
        contexts: [RenameContext],
        reservedNames: Set<String> = []
    ) throws -> RenamePlan {
        var items: [RenamePlan.Item] = []
        var taken = Set(reservedNames.map { $0.lowercased() })

        for context in contexts {
            let proposed = try newName(for: context)
            var resolved = proposed
            var status: RenamePlan.Item.Status = .rename

            if proposed == context.originalName {
                status = .unchanged
            } else if taken.contains(proposed.lowercased()) {
                resolved = Self.deduplicate(proposed, taken: taken)
                status = .conflictResolved
            }
            taken.insert(resolved.lowercased())
            items.append(.init(
                originalName: context.originalName,
                newName: resolved,
                status: status
            ))
        }
        return RenamePlan(items: items)
    }

    /// Strips characters that are illegal or hazardous in file names.
    static func sanitize(_ name: String) -> String {
        let cleaned = name
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
            .replacingOccurrences(of: "\0", with: "")
            .trimmingCharacters(in: .whitespaces)
        // A leading dot would silently hide the file.
        return cleaned.hasPrefix(".") ? String(cleaned.dropFirst()) : cleaned
    }

    /// "Trip.jpg" → "Trip 2.jpg", "Trip 3.jpg", … until free.
    static func deduplicate(_ name: String, taken: Set<String>) -> String {
        let ns = name as NSString
        let ext = ns.pathExtension
        let base = ext.isEmpty ? name : ns.deletingPathExtension
        var attempt = 2
        while true {
            let candidate = ext.isEmpty ? "\(base) \(attempt)" : "\(base) \(attempt).\(ext)"
            if !taken.contains(candidate.lowercased()) { return candidate }
            attempt += 1
        }
    }
}

/// Immutable result of planning: what would be renamed to what.
public struct RenamePlan: Equatable, Sendable {
    public struct Item: Equatable, Sendable {
        public enum Status: Equatable, Sendable {
            case rename
            case unchanged
            case conflictResolved
        }
        public let originalName: String
        public let newName: String
        public let status: Status
    }

    public let items: [Item]

    public var changedItems: [Item] { items.filter { $0.status != .unchanged } }
    public var changedCount: Int { changedItems.count }
    public var conflictCount: Int { items.filter { $0.status == .conflictResolved }.count }
}
