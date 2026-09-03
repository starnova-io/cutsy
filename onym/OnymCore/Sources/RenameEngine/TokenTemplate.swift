import Foundation

/// Renders `{token}` templates for the `.template` rule.
///
/// Supported tokens:
///   {name}              original base name
///   {counter}           1-based batch position, 3-digit padded (001, 002, …)
///   {counter:N}         N-digit padding
///   {date}              capture date ?? creation date ?? today, as yyyy-MM-dd
///   {date:FORMAT}       custom `DateFormatter` pattern, e.g. {date:yyyyMMdd_HHmm}
///   {model}             EXIF camera model ("" when unknown)
///   {ext}               original extension without the dot
/// Unknown tokens render literally so typos are visible in the preview.
public enum TokenTemplate {
    public static func render(_ pattern: String, base: String, context: RenameContext) -> String {
        var output = ""
        var rest = Substring(pattern)
        while let open = rest.firstIndex(of: "{") {
            output += rest[..<open]
            let afterOpen = rest.index(after: open)
            guard let close = rest[afterOpen...].firstIndex(of: "}") else {
                output += rest[open...]
                return output
            }
            let token = String(rest[afterOpen..<close])
            output += expand(token: token, base: base, context: context)
            rest = rest[rest.index(after: close)...]
        }
        output += rest
        return output
    }

    private static func expand(token: String, base: String, context: RenameContext) -> String {
        let name: String
        let argument: String?
        if let colon = token.firstIndex(of: ":") {
            name = String(token[..<colon])
            argument = String(token[token.index(after: colon)...])
        } else {
            name = token
            argument = nil
        }

        switch name {
        case "name":
            return base
        case "counter":
            let padding = argument.flatMap(Int.init) ?? 3
            let digits = String(context.index + 1)
            return digits.count >= padding
                ? digits
                : String(repeating: "0", count: padding - digits.count) + digits
        case "date":
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = .current
            formatter.dateFormat = argument ?? "yyyy-MM-dd"
            return formatter.string(from: context.effectiveDate ?? Date())
        case "model":
            return context.cameraModel ?? ""
        case "ext":
            return context.fileExtension
        default:
            return "{\(token)}"
        }
    }
}
