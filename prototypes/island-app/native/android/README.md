# FocusGuard — Android focus shield

Native half of the focus shield: **Do Not Disturb** for the length of a
session, and an **app blocker** that covers distracting apps with a cozy
full-screen shield. The web app already calls this plugin through
`src/native/guard.ts` (it no-ops on the web), so once the plugin is
registered, the toggles on the Focus screen work for real.

These sources are written and reviewed but have not been compiled in this
repo (no Android SDK here) — expect only trivial fixes, if any, when you
first build them in Android Studio.

## Wiring it up

```bash
npm i @capacitor/cli @capacitor/android
npm run build
npx cap add android
npx cap sync android
```

1. Copy `FocusGuardPlugin.java` and `AppBlockService.java` into
   `android/app/src/main/java/io/starnova/hearth/`.

2. Register the plugin in `MainActivity.java`:

   ```java
   public class MainActivity extends BridgeActivity {
     @Override
     public void onCreate(Bundle savedInstanceState) {
       registerPlugin(FocusGuardPlugin.class);
       super.onCreate(savedInstanceState);
     }
   }
   ```

3. Add to `AndroidManifest.xml` (inside `<manifest>`, with
   `xmlns:tools="http://schemas.android.com/tools"` on the root):

   ```xml
   <uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
   <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
   <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"
       tools:ignore="ProtectedPermissions" />
   ```

   and inside `<application>`:

   ```xml
   <service
       android:name=".AppBlockService"
       android:exported="false"
       android:foregroundServiceType="specialUse">
     <property
         android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
         android:value="focus_app_block" />
   </service>
   ```

4. Open in Android Studio (`npx cap open android`) and run.

## Permission flow (by design, all lazy)

- **Silence notifications** → first use opens the system
  "Do Not Disturb access" screen; from the next session on, DND flips on
  at Start and restores the previous filter at the end.
- **Shield distracting apps** → first use opens Usage Access, then
  "Display over other apps"; once both are granted the blocker runs as a
  foreground service for the session only. The blocklist ships with the
  usual suspects (see `DEFAULT_BLOCKLIST` in `src/native/guard.ts`); a
  real build should let the person pick apps.

## iOS (later)

The equivalent on iOS is the Screen Time API (FamilyControls +
ManagedSettings + DeviceActivity): `FamilyActivityPicker` for choosing
apps, `ManagedSettingsStore.shield.applications` during the session.
It requires Apple's Family Controls entitlement (request via their form;
approval takes weeks), which is why Android ships first. iOS cannot
toggle DND programmatically — the fallback is a Shortcuts automation
("when Hearth opens, turn on Focus").
