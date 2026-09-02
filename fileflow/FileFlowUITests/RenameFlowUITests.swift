import XCTest

/// End-to-end tests of the shipping UI. The app is launched with `--uitest`,
/// which seeds IMG_XXXX.jpg sample files in the sandbox and auto-selects
/// them as a folder source, so tests exercise the exact production flow
/// (rules → preview → apply → undo) without the system document picker.
final class RenameFlowUITests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    private func launch(files: Int = 3, pro: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--uitest", "--uitest-files=\(files)"]
        if pro { app.launchArguments.append("--uitest-pro") }
        app.launch()
        return app
    }

    private func addPrefixRule(_ app: XCUIApplication, prefix: String) {
        app.buttons["addRule"].tap()
        app.buttons["ruleKind-addPrefix"].tap()
        let field = app.textFields["ruleField-primary"]
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText(prefix)
        app.buttons["ruleDone"].tap()
    }

    // MARK: Core flow

    func testRenameFlowEndToEnd() {
        let app = launch(files: 3)

        // Seeded source is selected on launch.
        XCTAssertTrue(app.staticTexts["selectedSource"].waitForExistence(timeout: 5))

        addPrefixRule(app, prefix: "Beach ")

        // Live preview appears under the builder.
        XCTAssertTrue(app.staticTexts["Beach IMG_0001.jpg"].waitForExistence(timeout: 3))

        // Full preview shows every file, before → after.
        app.buttons["previewButton"].tap()
        let rows = app.descendants(matching: .any)
            .matching(identifier: "previewRow")
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 3))
        XCTAssertEqual(rows.count, 3)
        let header = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "3 of 3 files will change")
        )
        XCTAssertTrue(header.firstMatch.exists)

        // Apply and confirm the success alert.
        app.buttons["applyButton"].tap()
        let alert = app.alerts["Renamed"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.staticTexts["Renamed 3 files. You can undo this batch."].exists)
        alert.buttons["Done"].tap()

        // The selection now shows the renamed files.
        addPrefixRule(app, prefix: "x")
        XCTAssertTrue(app.staticTexts["xBeach Beach IMG_0001.jpg"].waitForExistence(timeout: 3))
    }

    func testUndoRestoresOriginalNames() {
        let app = launch(files: 3)
        XCTAssertTrue(app.staticTexts["selectedSource"].waitForExistence(timeout: 5))

        addPrefixRule(app, prefix: "Trip ")
        app.buttons["previewButton"].tap()
        app.buttons["applyButton"].tap()

        let alert = app.alerts["Renamed"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        alert.buttons["Undo"].tap()

        // Back on the builder, the live preview reflects the original names.
        XCTAssertTrue(app.staticTexts["Trip IMG_0001.jpg"].waitForExistence(timeout: 3))
        // And Settings confirms there is no batch left to undo.
        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.staticTexts["Nothing to undo"].waitForExistence(timeout: 3))
    }

    // MARK: Monetization gates

    func testFreeLimitShowsPaywallAtApply() {
        let app = launch(files: 25)
        XCTAssertTrue(app.staticTexts["selectedSource"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Over the free limit of 20 files"].exists)

        addPrefixRule(app, prefix: "x-")
        app.buttons["previewButton"].tap()
        XCTAssertTrue(app.buttons["applyButton"].waitForExistence(timeout: 3))
        app.buttons["applyButton"].tap()

        // Paywall, not a rename.
        XCTAssertTrue(app.buttons["paywallDismiss"].waitForExistence(timeout: 5))
        app.buttons["paywallDismiss"].tap()
        XCTAssertFalse(app.alerts["Renamed"].exists)
    }

    func testProRuleIsGatedForFreeUsers() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["selectedSource"].waitForExistence(timeout: 5))

        app.buttons["addRule"].tap()
        app.buttons["ruleKind-template"].tap()

        XCTAssertTrue(app.buttons["paywallDismiss"].waitForExistence(timeout: 5))
        app.buttons["paywallDismiss"].tap()
    }

    func testProUserCanRunTemplateOverTwentyFiles() {
        let app = launch(files: 25, pro: true)
        XCTAssertTrue(app.staticTexts["selectedSource"].waitForExistence(timeout: 5))

        app.buttons["addRule"].tap()
        app.buttons["ruleKind-template"].tap()
        let field = app.textFields["ruleField-primary"]
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText("Trip {counter}")
        app.buttons["ruleDone"].tap()

        XCTAssertTrue(app.staticTexts["Trip 001.jpg"].waitForExistence(timeout: 3))

        app.buttons["previewButton"].tap()
        app.buttons["applyButton"].tap()
        let alert = app.alerts["Renamed"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        XCTAssertTrue(alert.staticTexts["Renamed 25 files. You can undo this batch."].exists)
        alert.buttons["Done"].tap()
    }
}
