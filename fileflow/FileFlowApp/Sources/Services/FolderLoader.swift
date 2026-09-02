import Foundation

/// Loads the renameable files of a user-granted folder (top level only,
/// hidden files and subfolders excluded), sorted by name for stable
/// counter ordering.
enum FolderLoader {
    static func loadFiles(in root: URL) throws -> [URL] {
        let contents = try FileManager.default.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )
        return contents
            .filter { (try? $0.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true }
            .sorted {
                $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent)
                    == .orderedAscending
            }
    }
}
