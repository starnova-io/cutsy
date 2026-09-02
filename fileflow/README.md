# FileFlow — Batch Rename for iOS

*Rename. Organize. Done.* A batch file renamer for iOS: build a chain of
rules, preview every new name, apply, undo. See
[`../planning/batch-rename-organize-ios.md`](../planning/batch-rename-organize-ios.md)
for the product plan.

## Layout

| Path | What it is |
|---|---|
| `FileFlowCore/` | Swift Package with the platform-independent core. Builds and tests on macOS **and Linux**. |
| `FileFlowCore/Sources/RenameEngine` | Rules, token templates, pipeline, conflict-free planning. Pure functions. |
| `FileFlowCore/Sources/FileOps` | Applies plans to real files: two-phase moves, undo journal. |
| `FileFlowApp/Sources` | SwiftUI app (iOS 17+): rule builder, preview, paywall (StoreKit 2), presets (SwiftData), photo import (PHPicker + ImageIO EXIF). |
| `FileFlowUITests/` | End-to-end XCUITest suite driving the real UI. |
| `project.yml` | [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec that generates `FileFlow.xcodeproj`. |

## Core tests (any platform)

```sh
cd FileFlowCore
swift test
```

32 tests: every rule, chaining order, `{date}/{counter}/{model}` tokens,
collision resolution, and filesystem integration (apply on real temp
directories, swap-collision safety, undo).

## Building the app (macOS + Xcode 16)

```sh
brew install xcodegen
cd fileflow
xcodegen generate
open FileFlow.xcodeproj
```

Products for StoreKit testing: create a `.storekit` configuration with
`io.starnova.fileflow.pro.monthly` ($2.99), `.yearly` ($19.99),
`.lifetime` ($39.99) and select it in the scheme.

## End-to-end tests (simulator)

```sh
xcodebuild test \
  -project FileFlow.xcodeproj \
  -scheme FileFlow \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

The suite launches the app with `--uitest`, which seeds `IMG_XXXX.jpg`
sample files in the sandbox and selects them as a folder source, then
exercises the production flow end to end:

- `testRenameFlowEndToEnd` — add rule → live preview → full preview → apply → renamed on disk
- `testUndoRestoresOriginalNames` — apply then undo restores names
- `testFreeLimitShowsPaywallAtApply` — 25 files on Free hits the paywall, no rename happens
- `testProRuleIsGatedForFreeUsers` — Template rule opens the paywall on Free
- `testProUserCanRunTemplateOverTwentyFiles` — with `--uitest-pro`, 25 files rename via `{counter}` template

`--uitest` hooks live in `UITestSupport.swift` and are inert without the flag.
