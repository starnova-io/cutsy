import Foundation
#if canImport(ImageIO)
import ImageIO
#endif

/// Reads the two EXIF fields the {date} and {model} tokens need.
enum ExifReader {
    struct Info {
        var captureDate: Date?
        var cameraModel: String?
    }

    static func read(from url: URL) -> Info {
        #if canImport(ImageIO)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
                as? [CFString: Any] else {
            return Info()
        }
        var info = Info()
        if let exif = properties[kCGImagePropertyExifDictionary] as? [CFString: Any],
           let raw = exif[kCGImagePropertyExifDateTimeOriginal] as? String {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy:MM:dd HH:mm:ss"
            info.captureDate = formatter.date(from: raw)
        }
        if let tiff = properties[kCGImagePropertyTIFFDictionary] as? [CFString: Any] {
            info.cameraModel = tiff[kCGImagePropertyTIFFModel] as? String
        }
        return info
        #else
        return Info()
        #endif
    }
}
