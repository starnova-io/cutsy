import SwiftUI
import SwiftData
import RenameEngine

struct PresetsView: View {
    @Environment(AppModel.self) private var model
    @Environment(EntitlementStore.self) private var entitlements
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Preset.createdAt, order: .reverse) private var presets: [Preset]
    @State private var showPaywall = false

    private static let starterTemplates: [(name: String, rules: [RenameRule])] = [
        ("Trip photos — date + counter",
         [.template("Trip {date} {counter}")]),
        ("WhatsApp cleanup — date_counter",
         [.template("{date:yyyy-MM-dd}_{counter}")]),
        ("Strip IMG_ and lowercase",
         [.findReplace(find: "IMG_", replace: "", caseSensitive: true),
          .changeCase(.lowercase)]),
    ]

    var body: some View {
        NavigationStack {
            List {
                if presets.isEmpty {
                    Section {
                        ContentUnavailableView(
                            "No presets yet",
                            systemImage: "square.stack.3d.up",
                            description: Text("Build a rule chain on the Rename tab, then save it here. Or start from a template below.")
                        )
                    }
                }
                Section(presets.isEmpty ? "Templates" : "My Presets") {
                    if presets.isEmpty {
                        ForEach(Self.starterTemplates, id: \.name) { template in
                            Button {
                                model.rules = template.rules
                            } label: {
                                presetLabel(name: template.name, ruleCount: template.rules.count)
                            }
                            .tint(.primary)
                        }
                    } else {
                        ForEach(presets) { preset in
                            Button {
                                usePreset(preset)
                            } label: {
                                presetLabel(
                                    name: preset.name,
                                    ruleCount: preset.pipeline?.rules.count ?? 0
                                )
                            }
                            .tint(.primary)
                        }
                        .onDelete { offsets in
                            for offset in offsets { modelContext.delete(presets[offset]) }
                        }
                    }
                }
            }
            .navigationTitle("Presets")
            .sheet(isPresented: $showPaywall) { PaywallView() }
        }
    }

    private func presetLabel(name: String, ruleCount: Int) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(name)
                Text("\(ruleCount) rule\(ruleCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("Use")
                .font(.callout.weight(.medium))
                .foregroundStyle(.tint)
        }
    }

    private func usePreset(_ preset: Preset) {
        guard let pipeline = preset.pipeline else { return }
        if pipeline.requiresPro && !entitlements.isPro {
            showPaywall = true
            return
        }
        model.rules = pipeline.rules
    }
}
