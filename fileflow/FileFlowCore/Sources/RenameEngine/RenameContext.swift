import Foundation

/// Everything the engine may know about one file when computing its new name.
/// Pure value type so the engine stays testable without touching the filesystem.
public struct RenameContext: Sendable, Equatable {
    /// Full original file name including extension, e.g. "IMG_1234.jpg".
    public var originalName: String
    /// Zero-based position of the file within the batch (drives {counter}).
    public var index: Int
    /// Filesystem creation date, if known.
    public var creationDate: Date?
    /// EXIF capture date, if the file is a photo and metadata was read.
    public var captureDate: Date?
    /// EXIF camera model, e.g. "iPhone 15 Pro".
    public var cameraModel: String?

    public init(
        originalName: String,
        index: Int,
        creationDate: Date? = nil,
        captureDate: Date? = nil,
        cameraModel: String? = nil
    ) {
        self.originalName = originalName
        self.index = index
        self.creationDate = creationDate
        self.captureDate = captureDate
        self.cameraModel = cameraModel
    }

    /// "IMG_1234" for "IMG_1234.jpg"; dotfiles like ".gitignore" have no extension.
    public var baseName: String {
        let name = originalName as NSString
        let ext = name.pathExtension
        guard !ext.isEmpty, originalName.first != "." || originalName.dropFirst().contains(".") else {
            return originalName
        }
        return name.deletingPathExtension
    }

    /// "jpg" for "IMG_1234.jpg"; empty when the file has none.
    public var fileExtension: String {
        let name = originalName as NSString
        if originalName.hasPrefix("."), !originalName.dropFirst().contains(".") { return "" }
        return name.pathExtension
    }

    /// Best available date for {date}: capture date wins over filesystem date.
    public var effectiveDate: Date? { captureDate ?? creationDate }
}
