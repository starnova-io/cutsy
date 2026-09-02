import SwiftUI
import SwiftData

@main
struct FileFlowApp: App {
    @State private var model: AppModel
    @State private var entitlements: EntitlementStore
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false

    private let container: ModelContainer

    init() {
        let entitlements = EntitlementStore()
        _entitlements = State(initialValue: entitlements)
        _model = State(initialValue: AppModel(entitlements: entitlements))
        do {
            container = try ModelContainer(for: Preset.self)
        } catch {
            fatalError("Could not create model container: \(error)")
        }
        UITestSupport.prepareIfNeeded(entitlements: entitlements)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(entitlements)
                .task {
                    await entitlements.start()
                    UITestSupport.seedSelectionIfNeeded(into: model)
                }
                .sheet(isPresented: onboardingBinding) {
                    OnboardingView()
                        .interactiveDismissDisabled()
                }
        }
        .modelContainer(container)
    }

    private var onboardingBinding: Binding<Bool> {
        Binding(
            get: { !hasSeenOnboarding && !UITestSupport.isActive },
            set: { hasSeenOnboarding = !$0 }
        )
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            RenameView()
                .tabItem { Label("Rename", systemImage: "character.cursor.ibeam") }
            PresetsView()
                .tabItem { Label("Presets", systemImage: "square.stack.3d.up") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
