import SwiftUI
import RenameEngine
import FileOps

/// Full before → after list with the Apply action. This is the only place
/// a batch can be committed from.
struct PreviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var plan: RenamePlan?
    @State private var planError: String?
    @State private var showPaywall = false
    @State private var showDestinationPicker = false
    @State private var showDone = false

    var body: some View {
        NavigationStack {
            Group {
                if let plan {
                    planList(plan)
                } else if let planError {
                    ContentUnavailableView(
                        "Can't build a preview",
                        systemImage: "exclamationmark.triangle",
                        description: Text(planError)
                    )
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) { applyBar }
            .task { buildPlan() }
            .sheet(isPresented: $showPaywall) { PaywallView() }
            .fileImporter(
                isPresented: $showDestinationPicker,
                allowedContentTypes: [.folder]
            ) { result in
                if case let .success(destination) = result {
                    Task {
                        await model.exportPhotos(to: destination)
                        showDone = model.lastError == nil
                    }
                }
            }
            .alert(doneTitle, isPresented: $showDone) {
                if case .renamed = model.lastOutcome {
                    Button("Undo") {
                        model.undoLastBatch()
                        dismiss()
                    }
                }
                Button("Done") { dismiss() }
            } message: {
                Text(doneMessage)
            }
            .alert("Something went wrong", isPresented: errorBinding) {
                Button("OK", role: .cancel) { model.lastError = nil }
            } message: {
                Text(model.lastError ?? "")
            }
        }
    }

    private func planList(_ plan: RenamePlan) -> some View {
        List {
            if plan.conflictCount > 0 {
                Section {
                    Label(
                        "\(plan.conflictCount) name collisions resolved by numbering",
                        systemImage: "exclamationmark.triangle.fill"
                    )
                    .foregroundStyle(.orange)
                    .font(.footnote)
                }
            }
            Section("\(plan.changedCount) of \(plan.items.count) files will change") {
                ForEach(Array(plan.items.enumerated()), id: \.offset) { _, item in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.originalName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .strikethrough(item.status != .unchanged)
                        HStack(spacing: 6) {
                            Text(item.newName)
                                .font(.callout.weight(.medium))
                            if item.status == .conflictResolved {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.orange)
                            }
                            if item.status == .unchanged {
                                Text("unchanged")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                    .accessibilityIdentifier("previewRow")
                }
            }
        }
    }

    private var applyBar: some View {
        VStack(spacing: 8) {
            if model.isApplying {
                ProgressView(value: model.applyProgress)
                    .padding(.horizontal)
            }
            Button {
                applyTapped()
            } label: {
                Text(applyLabel)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(model.isApplying || (plan?.changedCount ?? 0) == 0)
            .accessibilityIdentifier("applyButton")
        }
        .padding()
        .background(.bar)
    }

    private var applyLabel: String {
        switch model.selection {
        case .photos: "Export \(plan?.items.count ?? 0) Renamed Copies"
        default: "Rename \(plan?.changedCount ?? 0) Files"
        }
    }

    private var doneTitle: String {
        if case .exported = model.lastOutcome { return "Exported" }
        return "Renamed"
    }

    private var doneMessage: String {
        switch model.lastOutcome {
        case let .renamed(count, _):
            return "Renamed \(count) files. You can undo this batch."
        case let .exported(count, destination):
            return "Saved \(count) renamed copies to \"\(destination.lastPathComponent)\"."
        case .none:
            return ""
        }
    }

    private func buildPlan() {
        do {
            plan = try model.makePlan()
        } catch {
            planError = error.localizedDescription
        }
    }

    private func applyTapped() {
        if model.paywallReason != nil {
            showPaywall = true
            return
        }
        switch model.selection {
        case .folder:
            Task {
                await model.applyToFolder()
                showDone = model.lastError == nil
            }
        case .photos:
            showDestinationPicker = true
        case .none:
            break
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { model.lastError != nil },
            set: { if !$0 { model.lastError = nil } }
        )
    }
}
