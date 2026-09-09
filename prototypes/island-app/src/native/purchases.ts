/* RevenueCat wrapper — the app's single source of truth for Hearth Premium.
 *
 * Only the PUBLIC iOS SDK key (appl_…) ever ships here; it identifies the app
 * to RevenueCat and grants nothing. A RevenueCat *secret* key must never be in
 * a client binary. On the web (and any build without the key) billing is not
 * configured and the Paywall falls back to its preview behaviour.
 */
import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from "@revenuecat/purchases-capacitor";

export const ENTITLEMENT = "premium";
const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;

/** true only on an iOS build that shipped the public key */
export function billingConfigured(): boolean {
  return Capacitor.getPlatform() === "ios" && !!IOS_KEY;
}

let configured = false;

/** Call once at startup. Safe to call on web — it just no-ops. */
export async function configurePurchases(): Promise<void> {
  if (!billingConfigured() || configured) return;
  try {
    if (import.meta.env.DEV) await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    await Purchases.configure({ apiKey: IOS_KEY! });
    configured = true;
  } catch (e) {
    console.warn("[purchases] configure failed", e);
  }
}

function hasPremium(info: CustomerInfo | undefined): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT];
}

/** Current entitlement state, straight from RevenueCat. */
export async function isPremium(): Promise<boolean> {
  if (!billingConfigured()) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return hasPremium(customerInfo);
  } catch (e) {
    console.warn("[purchases] getCustomerInfo failed", e);
    return false;
  }
}

/** Fire cb whenever the entitlement changes (purchase, restore, expiry). */
export async function onEntitlementChange(cb: (premium: boolean) => void): Promise<void> {
  if (!billingConfigured()) return;
  try {
    await Purchases.addCustomerInfoUpdateListener(info => cb(hasPremium(info)));
  } catch (e) {
    console.warn("[purchases] listener failed", e);
  }
}

export type PlanKey = "monthly" | "yearly" | "lifetime";

/** Map our three plans onto the current offering's packages by their type. */
export async function packagesByPlan(): Promise<Partial<Record<PlanKey, PurchasesPackage>>> {
  if (!billingConfigured()) return {};
  try {
    const offering = (await Purchases.getOfferings()).current;
    const out: Partial<Record<PlanKey, PurchasesPackage>> = {};
    for (const p of offering?.availablePackages ?? []) {
      const t = p.packageType;
      if (t === "MONTHLY") out.monthly = p;
      else if (t === "ANNUAL") out.yearly = p;
      else if (t === "LIFETIME") out.lifetime = p;
    }
    return out;
  } catch (e) {
    console.warn("[purchases] getOfferings failed", e);
    return {};
  }
}

/** Buy a plan. Returns true if the premium entitlement is now active. */
export async function purchasePlan(plan: PlanKey): Promise<boolean> {
  if (!billingConfigured()) return false;
  const pkg = (await packagesByPlan())[plan];
  if (!pkg) throw new Error("plan_unavailable");
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return hasPremium(customerInfo);
}

/** Restore prior purchases. Returns true if premium is active afterwards. */
export async function restorePurchases(): Promise<boolean> {
  if (!billingConfigured()) return false;
  const { customerInfo } = await Purchases.restorePurchases();
  return hasPremium(customerInfo);
}
