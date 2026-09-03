// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OnymCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "RenameEngine", targets: ["RenameEngine"]),
        .library(name: "FileOps", targets: ["FileOps"]),
    ],
    targets: [
        .target(name: "RenameEngine"),
        .target(name: "FileOps", dependencies: ["RenameEngine"]),
        .testTarget(name: "RenameEngineTests", dependencies: ["RenameEngine"]),
        .testTarget(name: "FileOpsTests", dependencies: ["FileOps"]),
    ]
)
