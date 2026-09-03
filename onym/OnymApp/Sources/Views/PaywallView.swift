import SwiftUI
import StoreKit

/// Shown at the paywall moment: user has already seen the preview of what
/// Pro would give them. Lifetime is the highlighted option.
struct PaywallView: View {
    @Environment(EntitlementStore.self) private var entitlements
    @Environment(\.dismiss) private var dismiss
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.largeTitle)
                            .foregroundStyle(.tint)
                        Text("Onym Pro")
                            .font(.title.bold())
                        Text("Unlimited files, rule chains, EXIF tokens, regex, and saved presets.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 24)

                    featureList

                    if entitlements.products.isEmpty {
                        ProgressView("Loading prices…")
                            .padding(.vertical)
                    } else {
                        productButtons
                    }

                    if let error = entitlements.purchaseError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }

                    Button("Restore Purchases") {
                        Task {
                            isWorking = true
                            await entitlements.restore()
                            isWorking = false
                            if entitlements.isPro { dismiss() }
                        }
                    }
                    .font(.footnote)
                    .disabled(isWorking)
                }
                .padding(.horizontal, 20)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not Now") { dismiss() }
                        .accessibilityIdentifier("paywallDismiss")
                }
            }
        }
        .accessibilityIdentifier("paywall")
        .onChange(of: entitlements.isPro) { _, isPro in
            if isPro { dismiss() }
        }
    }

    private var featureList: some View {
        VStack(alignment: .leading, spacing: 10) {
            feature("infinity", "Unlimited files per run")
            feature("link", "Chain any number of rules")
            feature("camera", "EXIF tokens — {date}, {model}")
            feature("chevron.left.forwardslash.chevron.right", "Regex find & replace")
            feature("square.stack.3d.up", "Save & reuse presets")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 14))
    }

    private func feature(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(.tint)
                .frame(width: 24)
            Text(text)
        }
        .font(.callout)
    }

    private var productButtons: some View {
        VStack(spacing: 10) {
            ForEach(entitlements.products, id: \.id) { product in
                Button {
                    Task {
                        isWorking = true
                        await entitlements.purchase(product)
                        isWorking = false
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(product.displayName)
                                .font(.body.weight(.semibold))
                            if isLifetime(product) {
                                Text("Pay once, keep forever")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Text(product.displayPrice)
                            .font(.body.monospacedDigit().weight(.semibold))
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .background(
                    isLifetime(product) ? AnyShapeStyle(.tint.opacity(0.15))
                                        : AnyShapeStyle(.quaternary.opacity(0.5)),
                    in: RoundedRectangle(cornerRadius: 14)
                )
                .overlay {
                    if isLifetime(product) {
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(.tint, lineWidth: 1.5)
                    }
                }
                .disabled(isWorking)
            }
        }
    }

    private func isLifetime(_ product: Product) -> Bool {
        product.id == EntitlementStore.ProductID.lifetime.rawValue
    }
}
