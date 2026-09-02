import Foundation

/// One step in a rename pipeline. Rules are Codable so presets can be persisted
/// and exported; keep raw values stable when adding cases.
public enum RenameRule: Codable, Equatable, Sendable {
    case findReplace(find: String, replace: String, caseSensitive: Bool)
    /// Pro. NSRegularExpression pattern; template supports $1…$9 captures.
    case regexReplace(pattern: String, template: String)
    case addPrefix(String)
    /// Appended to the base name, before the extension.
    case addSuffix(String)
    case changeCase(CaseTransform)
    case counter(start: Int, step: Int, padding: Int, position: CounterPosition, separator: String)
    /// Pro. Replaces the whole base name with a rendered token template,
    /// e.g. "Tokyo Trip {date} {counter}". See `TokenTemplate` for tokens.
    case template(String)
    /// New extension without the dot; empty string removes the extension.
    case changeExtension(String)
    /// Collapse runs of whitespace to `replacement` ("" removes spaces).
    case replaceWhitespace(with: String)
    case trimWhitespace

    public enum CaseTransform: String, Codable, Sendable, CaseIterable {
        case lowercase, uppercase, titlecase
    }

    public enum CounterPosition: String, Codable, Sendable, CaseIterable {
        case prefix, suffix
    }

    /// Rules gated behind the Pro entitlement.
    public var requiresPro: Bool {
        switch self {
        case .regexReplace, .template: return true
        default: return false
        }
    }
}

extension RenameRule {
    /// Applies this rule to `base` (name without extension) for `context`.
    /// Extension-affecting rules are handled by the pipeline, not here.
    func apply(to base: String, context: RenameContext) throws -> String {
        switch self {
        case let .findReplace(find, replace, caseSensitive):
            guard !find.isEmpty else { return base }
            let options: String.CompareOptions = caseSensitive ? [] : [.caseInsensitive]
            return base.replacingOccurrences(of: find, with: replace, options: options)

        case let .regexReplace(pattern, template):
            let regex = try NSRegularExpression(pattern: pattern)
            let range = NSRange(base.startIndex..., in: base)
            return regex.stringByReplacingMatches(in: base, range: range, withTemplate: template)

        case let .addPrefix(prefix):
            return prefix + base

        case let .addSuffix(suffix):
            return base + suffix

        case let .changeCase(transform):
            switch transform {
            case .lowercase: return base.lowercased()
            case .uppercase: return base.uppercased()
            case .titlecase: return base.capitalized
            }

        case let .counter(start, step, padding, position, separator):
            let value = start + context.index * step
            let digits = String(value)
            let padded = digits.count >= padding
                ? digits
                : String(repeating: "0", count: padding - digits.count) + digits
            switch position {
            case .prefix: return padded + separator + base
            case .suffix: return base + separator + padded
            }

        case let .template(pattern):
            return TokenTemplate.render(pattern, base: base, context: context)

        case .changeExtension:
            return base

        case let .replaceWhitespace(replacement):
            let parts = base.split(whereSeparator: { $0.isWhitespace })
            return parts.joined(separator: replacement)

        case .trimWhitespace:
            return base.trimmingCharacters(in: .whitespaces)
        }
    }
}
