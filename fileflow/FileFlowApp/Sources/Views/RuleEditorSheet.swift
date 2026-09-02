import SwiftUI
import RenameEngine

/// The kinds of rules users can add, in menu order.
enum RuleKind: String, CaseIterable, Identifiable {
    case addPrefix, addSuffix, findReplace, counter, changeCase
    case replaceWhitespace, trimWhitespace, changeExtension
    case regexReplace, template

    var id: String { rawValue }

    var label: String {
        switch self {
        case .addPrefix: "Add Prefix"
        case .addSuffix: "Add Suffix"
        case .findReplace: "Find & Replace"
        case .counter: "Counter (001, 002…)"
        case .changeCase: "Change Case"
        case .replaceWhitespace: "Replace Spaces"
        case .trimWhitespace: "Trim Whitespace"
        case .changeExtension: "Change Extension"
        case .regexReplace: "Regex Replace"
        case .template: "Template ({date}, {counter}…)"
        }
    }

    var icon: String {
        switch self {
        case .addPrefix: "arrow.left.to.line"
        case .addSuffix: "arrow.right.to.line"
        case .findReplace: "magnifyingglass"
        case .counter: "number"
        case .changeCase: "textformat"
        case .replaceWhitespace: "space"
        case .trimWhitespace: "scissors"
        case .changeExtension: "doc.badge.gearshape"
        case .regexReplace: "chevron.left.forwardslash.chevron.right"
        case .template: "curlybraces"
        }
    }

    var requiresPro: Bool { self == .regexReplace || self == .template }
}

enum RuleEditorTarget: Identifiable {
    case new(RuleKind)
    case existing(index: Int, rule: RenameRule)

    var id: String {
        switch self {
        case let .new(kind): "new-\(kind.rawValue)"
        case let .existing(index, _): "edit-\(index)"
        }
    }

    var kind: RuleKind {
        switch self {
        case let .new(kind): return kind
        case let .existing(_, rule):
            switch rule {
            case .findReplace: return .findReplace
            case .regexReplace: return .regexReplace
            case .addPrefix: return .addPrefix
            case .addSuffix: return .addSuffix
            case .changeCase: return .changeCase
            case .counter: return .counter
            case .template: return .template
            case .changeExtension: return .changeExtension
            case .replaceWhitespace: return .replaceWhitespace
            case .trimWhitespace: return .trimWhitespace
            }
        }
    }
}

/// Menu of rule types shown from "Add Rule".
struct AddRuleSheet: View {
    let isPro: Bool
    let onPick: (RuleKind) -> Void

    var body: some View {
        NavigationStack {
            List(RuleKind.allCases) { kind in
                Button {
                    onPick(kind)
                } label: {
                    HStack {
                        Label(kind.label, systemImage: kind.icon)
                        Spacer()
                        if kind.requiresPro && !isPro {
                            Image(systemName: "lock.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .tint(.primary)
                .accessibilityIdentifier("ruleKind-\(kind.rawValue)")
            }
            .navigationTitle("Add Rule")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// One editor for every rule type; fields switch on the kind.
struct RuleEditorSheet: View {
    let target: RuleEditorTarget
    let onSave: (RenameRule) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var secondaryText = ""
    @State private var caseSensitive = true
    @State private var caseTransform: RenameRule.CaseTransform = .lowercase
    @State private var counterStart = 1
    @State private var counterStep = 1
    @State private var counterPadding = 3
    @State private var counterPosition: RenameRule.CounterPosition = .suffix
    @State private var counterSeparator = "_"

    var body: some View {
        NavigationStack {
            Form {
                editorFields
            }
            .navigationTitle(target.kind.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        onSave(builtRule)
                        dismiss()
                    }
                    .accessibilityIdentifier("ruleDone")
                }
            }
            .onAppear(perform: loadExisting)
        }
        .presentationDetents([.medium])
    }

    @ViewBuilder
    private var editorFields: some View {
        switch target.kind {
        case .addPrefix:
            TextField("Prefix, e.g. \"Trip \"", text: $text)
                .accessibilityIdentifier("ruleField-primary")
        case .addSuffix:
            TextField("Suffix, e.g. \"-edit\"", text: $text)
                .accessibilityIdentifier("ruleField-primary")
        case .findReplace:
            TextField("Find", text: $text)
                .accessibilityIdentifier("ruleField-primary")
            TextField("Replace with", text: $secondaryText)
                .accessibilityIdentifier("ruleField-secondary")
            Toggle("Case sensitive", isOn: $caseSensitive)
        case .regexReplace:
            TextField("Pattern, e.g. ^IMG_(\\d+)$", text: $text)
                .autocorrectionDisabled()
                .accessibilityIdentifier("ruleField-primary")
            TextField("Template, e.g. photo-$1", text: $secondaryText)
                .autocorrectionDisabled()
                .accessibilityIdentifier("ruleField-secondary")
        case .changeCase:
            Picker("Transform", selection: $caseTransform) {
                Text("lowercase").tag(RenameRule.CaseTransform.lowercase)
                Text("UPPERCASE").tag(RenameRule.CaseTransform.uppercase)
                Text("Title Case").tag(RenameRule.CaseTransform.titlecase)
            }
            .pickerStyle(.inline)
        case .counter:
            Stepper("Start at \(counterStart)", value: $counterStart, in: 0...9999)
            Stepper("Step \(counterStep)", value: $counterStep, in: 1...100)
            Stepper("Digits: \(counterPadding)", value: $counterPadding, in: 1...8)
            Picker("Position", selection: $counterPosition) {
                Text("After name").tag(RenameRule.CounterPosition.suffix)
                Text("Before name").tag(RenameRule.CounterPosition.prefix)
            }
            TextField("Separator", text: $counterSeparator)
        case .template:
            TextField("e.g. Tokyo Trip {date} {counter}", text: $text)
                .autocorrectionDisabled()
                .accessibilityIdentifier("ruleField-primary")
            Section {
                Text("{name} {counter} {counter:4} {date} {date:yyyyMMdd} {model} {ext}")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            } header: {
                Text("Available tokens")
            }
        case .changeExtension:
            TextField("New extension without dot, e.g. jpeg", text: $text)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .accessibilityIdentifier("ruleField-primary")
        case .replaceWhitespace:
            TextField("Replacement (empty removes spaces)", text: $text)
                .accessibilityIdentifier("ruleField-primary")
        case .trimWhitespace:
            Text("Removes spaces at the start and end of the name.")
                .foregroundStyle(.secondary)
        }
    }

    private var builtRule: RenameRule {
        switch target.kind {
        case .addPrefix: .addPrefix(text)
        case .addSuffix: .addSuffix(text)
        case .findReplace: .findReplace(find: text, replace: secondaryText, caseSensitive: caseSensitive)
        case .regexReplace: .regexReplace(pattern: text, template: secondaryText)
        case .changeCase: .changeCase(caseTransform)
        case .counter: .counter(
            start: counterStart, step: counterStep, padding: counterPadding,
            position: counterPosition, separator: counterSeparator)
        case .template: .template(text)
        case .changeExtension: .changeExtension(text)
        case .replaceWhitespace: .replaceWhitespace(with: text)
        case .trimWhitespace: .trimWhitespace
        }
    }

    private func loadExisting() {
        guard case let .existing(_, rule) = target else { return }
        switch rule {
        case let .findReplace(find, replace, sensitive):
            text = find; secondaryText = replace; caseSensitive = sensitive
        case let .regexReplace(pattern, template):
            text = pattern; secondaryText = template
        case let .addPrefix(value), let .addSuffix(value),
             let .template(value), let .changeExtension(value),
             let .replaceWhitespace(value):
            text = value
        case let .changeCase(transform):
            caseTransform = transform
        case let .counter(start, step, padding, position, separator):
            counterStart = start; counterStep = step; counterPadding = padding
            counterPosition = position; counterSeparator = separator
        case .trimWhitespace:
            break
        }
    }
}
