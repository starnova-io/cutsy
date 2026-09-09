# Hearth Island — Launch Runbook & Status

**App:** Hearth Island: Focus Timer · **Apple ID** `6809866353` · **Bundle** `io.starnova.hearth`
**Legal site (public):** https://starnova-io.github.io/hearth-island/ (`/privacy.html`, `/terms.html`)

---

## ✅ Done

**App Store Connect — app listing**
- App record (iOS), primary language English (U.S.)
- Name `Hearth Island: Focus Timer` · Subtitle `Grow an island as you study`
- Keywords, promo text, full description (App Store-safe chars), Support & Marketing URLs
- Category: **Productivity** + **Lifestyle** · Age rating **4+** · Content rights set
- Privacy Policy URL + App Privacy labels **published**
- Screenshots: 6 × 6.9" (1290×2796) uploaded
- Pricing: **Free**, all 175 regions

**App Store Connect — in-app purchases** (subscription group **Hearth Premium**, id 22369464)
- `io.starnova.hearth.pro.monthly` — $4.99/mo — priced + localized ✅
- `io.starnova.hearth.pro.yearly` — $29.99/yr — priced + localized ✅
  - **Introductory Offer: 7 days free** (Free trial · 1 week · all regions · no end date) ✅ NEW
- `io.starnova.hearth.pro.lifetime` — **Non-Consumable $59.99** — all regions + localized ✅ NEW

**RevenueCat** (project **Hearth Island**, App Store app `io.starnova.hearth`) ✅ NEW
- Entitlement **`premium`**
- 3 products created + attached to `premium`: monthly / yearly / lifetime
- Offering **`default`**: `$rc_monthly` · `$rc_annual` · `$rc_lifetime`
- **App Store Connect API key linked** (shared key `WN6229BD87` → "Valid credentials"), so RC
  auto-syncs products & validates purchases like your other apps
- Public iOS SDK key (`appl_scKfhhnKfHzPoaOgDYOnuRMvtBo`) is in `.env.production` and **baked into the build**

**Firebase / Google Analytics** (project **Hearth Island** / `hearth-island`) ✅ NEW
- Google Analytics **enabled** on the project (Default Account for Firebase)
- iOS app registered: bundle `io.starnova.hearth`, App Store ID `6809866353`
- **`GoogleService-Info.plist`** downloaded and placed at `ios/App/App/GoogleService-Info.plist`
- `AppDelegate.swift`: `import FirebaseCore` + `FirebaseApp.configure()` added
- `Info.plist`: `FirebaseAnalyticsCollectionEnabled = YES` (forces GA on) +
  `ITSAppUsesNonExemptEncryption = NO` (skips the export-compliance prompt at upload)

**Source (prototypes/island-app)** — `npm run build` succeeds; RevenueCat key present in `dist` and
copied into `ios/App/App/public`. Analytics + purchases wrappers wired (`src/native/*`), paywall does
real StoreKit purchases via RevenueCat + Restore + Apple-compliant disclosure.

**GitHub** — public repo `starnova-io/hearth-island` (privacy + terms, GitHub Pages live).

---

## ▶️ Remaining — all on your Mac (needs Xcode + CocoaPods, can't run from the cloud/Linux VM)

### 1. Sync native plugins & build
The iOS `Podfile` doesn't yet list the two new native pods (RevenueCat + Firebase Analytics) because
`cap sync` needs macOS/CocoaPods. On your Mac:
```
cd prototypes/island-app
npm install
npm run build
npx cap sync ios          # regenerates Podfile (adds RevenueCat + Firebase pods) + copies web assets
cd ios/App && pod install
open App.xcworkspace
```
`cap sync` will also re-copy `dist` into `ios/App/App/public` (the cloud VM's mount blocked that step,
so I copied `index.html` in by hand — harmless, sync overwrites it cleanly).

### 2. In Xcode
- Pick your Team (Signing & Capabilities), confirm bundle `io.starnova.hearth`
- Confirm `GoogleService-Info.plist` is in the **App target** (it's already in the folder; drag into the
  project navigator if Xcode doesn't show it as a target member)
- Set Version `1.0` / Build `1`
- **Product ▸ Archive ▸ Distribute App ▸ App Store Connect ▸ Upload** → TestFlight

### 3. IAP review screenshot (before final submit)
Each IAP needs one review screenshot of the paywall. Easiest once the build is on a device/simulator:
capture the Hearth Premium screen and attach it to each of the 3 IAPs (ASC → the IAP → Review
Information → Screenshot). Not needed for TestFlight, only for App Store submission.

### 4. Submit (your final click)
Version 1.0 → attach the processed build → fill App Review Information → the subscription group + 3 IAPs
are reviewed together with the build → **Submit for Review**.

### 5. Custom Product Pages (ASO, optional)
Build from `STORE-LISTING.md` §2: 5 keyword-targeted pages (Study / Deep-work / Cozy-calm / Japan-ja /
Korea-ko).

---
Made by StarNova · vdnhan97@gmail.com
