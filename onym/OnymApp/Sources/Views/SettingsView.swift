import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(EntitlementStore.self) private var entitlements
    @State private var showPaywall = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if entitlements.isPro {
                        Label("Onym Pro is active", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.tint)
                            .accessibilityIdentifier("proActive")
                    } else {
                        Button {
                            showPaywall = true
                        } label: {
                            Label("Upgrade to Pro", systemImage: "sparkles")
                        }
                        Button("Restore Purchases") {
                            Task { await entitlements.restore() }
                        }
                    }
                }

                Section("Last batch") {
                    if let journal = model.undoJournal, !journal.isEmpty {
                        Button {
                            model.undoLastBatch()
                        } label: {
                            Label("Undo \(journal.entries.count) renames", systemImage: "arrow.uturn.backward")
                        }
                        .accessibilityIdentifier("undoLastBatch")
                        Text("Applied \(journal.appliedAt.formatted(date: .abbreviated, time: .shortened))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Nothing to undo")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Privacy") {
                    Text("Onym renames files entirely on your device. Nothing is uploaded and there is no account.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Link("Privacy Policy",
                         destination: URL(string: "https://starnova-io.github.io/cutsy/privacy.html")!)
                }

                Section {
                    LabeledContent("Version") {
                        Text(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—")
                    }
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showPaywall) { PaywallView() }
        }
    }
}
