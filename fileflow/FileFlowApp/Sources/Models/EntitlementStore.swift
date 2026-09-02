import Foundation
import Observation
import StoreKit

/// StoreKit 2 wrapper: three SKUs, one `isPro` flag the UI reads.
@MainActor
@Observable
final class EntitlementStore {
    enum ProductID: String, CaseIterable {
        case monthly = "io.starnova.fileflow.pro.monthly"
        case yearly = "io.starnova.fileflow.pro.yearly"
        case lifetime = "io.starnova.fileflow.pro.lifetime"
    }

    private(set) var isPro = false
    private(set) var products: [Product] = []
    private(set) var purchaseError: String?
    /// Set by UITestSupport so UI tests can run without StoreKit.
    var testOverridePro: Bool? {
        didSet { if let value = testOverridePro { isPro = value } }
    }

    private var updatesTask: Task<Void, Never>?

    func start() async {
        if let value = testOverridePro {
            isPro = value
            return
        }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                if case let .verified(transaction) = update {
                    await transaction.finish()
                    await self?.refreshEntitlement()
                }
            }
        }
        await loadProducts()
        await refreshEntitlement()
    }

    func loadProducts() async {
        do {
            let ids = ProductID.allCases.map(\.rawValue)
            products = try await Product.products(for: ids)
                .sorted { $0.price < $1.price }
        } catch {
            purchaseError = "Couldn't load prices. Check your connection and try again."
        }
    }

    func purchase(_ product: Product) async {
        do {
            let result = try await product.purchase()
            switch result {
            case let .success(verification):
                if case let .verified(transaction) = verification {
                    await transaction.finish()
                }
                await refreshEntitlement()
            case .userCancelled, .pending:
                break
            @unknown default:
                break
            }
        } catch {
            purchaseError = "Purchase failed. You were not charged — try again."
        }
    }

    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlement()
    }

    func refreshEntitlement() async {
        if let value = testOverridePro {
            isPro = value
            return
        }
        var owned = false
        for await entitlement in Transaction.currentEntitlements {
            if case let .verified(transaction) = entitlement,
               ProductID(rawValue: transaction.productID) != nil,
               transaction.revocationDate == nil {
                owned = true
            }
        }
        isPro = owned
    }
}
