import Foundation
#if canImport(PhotosUI) && canImport(UIKit)
import SwiftUI
import PhotosUI

/// PHPicker wrapper that copies picked photos into a temp working folder,
/// keeping their original filenames, and reads their EXIF for tokens.
/// (PhotosPicker's Transferable path drops the filename, so we use PHPicker.)
struct PhotoPicker: UIViewControllerRepresentable {
    let onComplete: ([ImportedPhoto]) -> Void

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.selectionLimit = 0
        config.filter = .images
        let controller = PHPickerViewController(configuration: config)
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onComplete: ([ImportedPhoto]) -> Void

        init(onComplete: @escaping ([ImportedPhoto]) -> Void) {
            self.onComplete = onComplete
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            guard !results.isEmpty else {
                onComplete([])
                return
            }
            let workDir = FileManager.default.temporaryDirectory
                .appendingPathComponent("fileflow-import-\(UUID().uuidString)", isDirectory: true)
            try? FileManager.default.createDirectory(
                at: workDir, withIntermediateDirectories: true)

            let group = DispatchGroup()
            let lock = NSLock()
            var imported: [(Int, ImportedPhoto)] = []

            for (index, result) in results.enumerated() {
                let provider = result.itemProvider
                guard let type = provider.registeredTypeIdentifiers.first else { continue }
                group.enter()
                provider.loadFileRepresentation(forTypeIdentifier: type) { url, _ in
                    defer { group.leave() }
                    guard let url else { return }
                    let name = provider.suggestedName.map { base -> String in
                        let ext = url.pathExtension
                        return ext.isEmpty ? base : "\(base).\(ext)"
                    } ?? url.lastPathComponent
                    let destination = workDir.appendingPathComponent(name)
                    do {
                        try? FileManager.default.removeItem(at: destination)
                        try FileManager.default.copyItem(at: url, to: destination)
                        let exif = ExifReader.read(from: destination)
                        let photo = ImportedPhoto(
                            url: destination,
                            captureDate: exif.captureDate,
                            cameraModel: exif.cameraModel
                        )
                        lock.lock()
                        imported.append((index, photo))
                        lock.unlock()
                    } catch {
                        // Skip unreadable items; the rest of the batch still imports.
                    }
                }
            }

            group.notify(queue: .main) { [onComplete] in
                onComplete(imported.sorted { $0.0 < $1.0 }.map(\.1))
            }
        }
    }
}
#endif
