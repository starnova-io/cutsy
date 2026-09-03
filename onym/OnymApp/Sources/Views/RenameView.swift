import SwiftUI
import SwiftData
import RenameEngine

struct RenameView: View {
    @Environment(AppModel.self) private var model
    @Environment(EntitlementStore.self) private var entitlements
    @Environment(\.modelContext) private var modelContext

    @State private var showFolderImporter = false
    @State private var showPhotoPicker = false
    @State private var editingRule: RuleEditorTarget?
    @State private var showAddRule = false
    @State private var showPreview = false
    @State private var showPaywall = false
    @State private var showSavePreset = false
    @State private var presetName = ""
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            List {
                sourceSection
                rulesSection
                if model.selection != nil && !model.rules.isEmpty {
                    livePreviewSection
                }
            }
            .navigationTitle("Onym")
            .toolbar { toolbarContent }
            .safeAreaInset(edge: .bottom) { continueBar }
            .fileImporter(
                isPresented: $showFolderImporter,
                allowedContentTypes: [.folder]
            ) { result in
                handleFolderPick(result)
            }
            #if canImport(UIKit)
            .sheet(isPresented: $showPhotoPicker) {
                PhotoPicker { photos in
                    if !photos.isEmpty { model.selection = .photos(photos) }
                }
                .ignoresSafeArea()
            }
            #endif
            .sheet(item: $editingRule) { target in
                RuleEditorSheet(target: target) { newRule in
                    switch target {
                    case .new:
                        model.rules.append(newRule)
                    case let .existing(index, _):
                        model.rules[index] = newRule
                    }
                }
            }
            .sheet(isPresented: $showAddRule) {
                AddRuleSheet(isPro: entitlements.isPro) { kind in
                    showAddRule = false
                    if kind.requiresPro && !entitlements.isPro {
                        showPaywall = true
                    } else {
                        editingRule = .new(kind)
                    }
                }
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showPreview) {
                PreviewView()
            }
            .sheet(isPresented: $showPaywall) {
                PaywallView()
            }
            .alert("Save Preset", isPresented: $showSavePreset) {
                TextField("Preset name", text: $presetName)
                Button("Save") { savePreset() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Saves the current rule chain so you can run it again later.")
            }
            .alert("Couldn't open folder", isPresented: errorBinding) {
                Button("OK", role: .cancel) { loadError = nil }
            } message: {
                Text(loadError ?? "")
            }
        }
    }

    // MARK: Sections

    private var sourceSection: some View {
        Section("Files") {
            if let selection = model.selection {
                HStack {
                    Image(systemName: sourceIcon)
                        .foregroundStyle(.tint)
                    VStack(alignment: .leading) {
                        Text(selection.displayName)
                            .accessibilityIdentifier("selectedSource")
                        if model.isOverFreeLimit {
                            Text("Over the free limit of \(FreeTier.maxFilesPerRun) files")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }
                    }
                    Spacer()
                    Button("Clear", role: .destructive) { model.reset() }
                        .buttonStyle(.borderless)
                }
            } else {
                Button {
                    showFolderImporter = true
                } label: {
                    Label("Choose Folder…", systemImage: "folder")
                }
                .accessibilityIdentifier("chooseFolder")
                Button {
                    showPhotoPicker = true
                } label: {
                    Label("Import from Photos…", systemImage: "photo.on.rectangle")
                }
                .accessibilityIdentifier("importPhotos")
            }
        }
    }

    private var rulesSection: some View {
        Section {
            ForEach(Array(model.rules.enumerated()), id: \.offset) { index, rule in
                Button {
                    editingRule = .existing(index: index, rule: rule)
                } label: {
                    RuleRow(rule: rule, position: index + 1)
                }
                .tint(.primary)
            }
            .onMove { from, to in model.rules.move(fromOffsets: from, toOffset: to) }
            .onDelete { offsets in model.rules.remove(atOffsets: offsets) }

            Button {
                showAddRule = true
            } label: {
                Label("Add Rule", systemImage: "plus.circle.fill")
            }
            .accessibilityIdentifier("addRule")
        } header: {
            Text("Rules")
        } footer: {
            if model.rules.isEmpty {
                Text("Rules run top to bottom — like a tiny pipeline for your filenames.")
            }
        }
    }

    private var livePreviewSection: some View {
        Section("Preview") {
            ForEach(model.livePreview(), id: \.before) { row in
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.before)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .strikethrough(row.before != row.after)
                    Text(row.after)
                        .font(.callout.weight(.medium))
                }
                .accessibilityIdentifier("livePreviewRow")
            }
        }
    }

    private var continueBar: some View {
        Group {
            if model.selection != nil && !model.rules.isEmpty {
                Button {
                    if let reason = model.paywallReason, reason.contains("Pro rules") {
                        showPaywall = true
                    } else {
                        showPreview = true
                    }
                } label: {
                    Text("Preview \(model.selection?.count ?? 0) Files")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding()
                .background(.bar)
                .accessibilityIdentifier("previewButton")
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Save as Preset…") {
                    if entitlements.isPro {
                        presetName = ""
                        showSavePreset = true
                    } else {
                        showPaywall = true
                    }
                }
                .disabled(model.rules.isEmpty)
                Button("Clear Rules", role: .destructive) { model.rules.removeAll() }
                    .disabled(model.rules.isEmpty)
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityIdentifier("renameMenu")
        }
    }

    // MARK: Actions

    private var sourceIcon: String {
        if case .photos = model.selection { return "photo.on.rectangle" }
        return "folder.fill"
    }

    private func handleFolderPick(_ result: Result<URL, Error>) {
        switch result {
        case let .success(url):
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            do {
                let files = try FolderLoader.loadFiles(in: url)
                guard !files.isEmpty else {
                    loadError = "That folder has no files at its top level."
                    return
                }
                model.selection = .folder(root: url, files: files)
            } catch {
                loadError = "iOS didn't allow reading that folder. Try picking it again."
            }
        case .failure:
            break
        }
    }

    private func savePreset() {
        let name = presetName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        if let preset = try? Preset(name: name, pipeline: model.pipeline) {
            modelContext.insert(preset)
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { loadError != nil }, set: { if !$0 { loadError = nil } })
    }
}

/// A one-line human summary of a rule for the builder list.
struct RuleRow: View {
    let rule: RenameRule
    let position: Int

    var body: some View {
        HStack(spacing: 12) {
            Text("\(position)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 1) {
                Text(rule.title)
                    .font(.body.weight(.medium))
                Text(rule.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if rule.requiresPro {
                Text("PRO")
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.tint.opacity(0.15), in: Capsule())
                    .foregroundStyle(.tint)
            }
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .accessibilityIdentifier("ruleRow")
    }
}

extension RenameRule {
    var title: String {
        switch self {
        case .findReplace: "Find & Replace"
        case .regexReplace: "Regex Replace"
        case .addPrefix: "Add Prefix"
        case .addSuffix: "Add Suffix"
        case .changeCase: "Change Case"
        case .counter: "Counter"
        case .template: "Template"
        case .changeExtension: "Change Extension"
        case .replaceWhitespace: "Replace Spaces"
        case .trimWhitespace: "Trim Whitespace"
        }
    }

    var summary: String {
        switch self {
        case let .findReplace(find, replace, _):
            "\"\(find)\" → \"\(replace)\""
        case let .regexReplace(pattern, template):
            "/\(pattern)/ → \(template)"
        case let .addPrefix(text):
            "\"\(text)\" + name"
        case let .addSuffix(text):
            "name + \"\(text)\""
        case let .changeCase(transform):
            transform.rawValue.capitalized
        case let .counter(start, step, padding, position, _):
            "\(position == .prefix ? "Before" : "After") name, from \(start), step \(step), \(padding) digits"
        case let .template(pattern):
            pattern
        case let .changeExtension(ext):
            ext.isEmpty ? "Remove extension" : "→ .\(ext)"
        case let .replaceWhitespace(replacement):
            replacement.isEmpty ? "Remove all spaces" : "Spaces → \"\(replacement)\""
        case .trimWhitespace:
            "Trim leading/trailing spaces"
        }
    }
}
