# Building native apps (Android / iOS)

The web app runs as-is in any Chromium-based browser. With [Capacitor](https://capacitorjs.com/)
you can additionally wrap it into a **native Android or iOS app** — useful
because a native app can access Bluetooth via the OS (Core Bluetooth /
Android BLE) instead of the Web Bluetooth API, which notably lets it run on
**iOS/iPadOS**, where Safari has no Web Bluetooth.

> These instructions are for building the app **for yourself / self-hosting**.
> Publishing to the Google Play Store or Apple App Store is out of scope and
> may raise trademark/licensing questions — that is intentionally not covered.

The native projects (`android/`, `ios/`) are **not checked in** — you generate
them locally so each build uses your own application id and signing. They are
git-ignored.

## Prerequisites

- **Node.js 16.7+** (for the cross-platform build script)
- **Android:** Android Studio + JDK 17
- **iOS:** macOS, Xcode, and CocoaPods (`sudo gem install cocoapods`)

## 1. Install dependencies

```bash
npm install
```

## 2. Set your own application id

Edit `capacitor.config.json` and replace the placeholder `appId` with your own
reverse-domain identifier:

```json
{
  "appId": "com.example.nova",   // <- change to e.g. com.yourname.nova
  "appName": "Nova Drill Control",
  "webDir": "dist"
}
```

## 3. Add the platform(s)

```bash
npx cap add android      # and / or
npx cap add ios
```

## 4. Build the web assets and sync them into the native project

```bash
npm run sync-android     # = npm run build + npx cap sync android
npm run sync-ios         # = npm run build + npx cap sync ios   (macOS only)
```

`npm run build` (`scripts/build.js`) copies `index.html`, `js/` and `css/`
into `dist/`, which Capacitor uses as the web directory.

## 5. Open and run in the native IDE

```bash
npx cap open android     # Android Studio -> Run
npx cap open ios         # Xcode -> set Signing Team, then Run
```

### iOS only: Bluetooth permission

iOS crashes on first BLE access unless a usage description is present. In Xcode
add to `ios/App/App/Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Connects to the Nova S Pro robot over Bluetooth.</string>
```

### Android only: Bluetooth permissions

Android apps (especially on Android 12+) require explicit permissions in the `AndroidManifest.xml` file to scan for and connect to BLE devices.

Open `android/app/src/main/AndroidManifest.xml` and add the following permissions inside the `<manifest>` tag:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />

<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

```

*Note: The `neverForLocation` flag tells Android that the app only scans for devices and does not use Bluetooth to determine the user's physical location, which removes the mandatory requirement for location access permissions.*

## Re-syncing after web changes

Whenever you change the web app (`index.html`, `js/`, `css/`), re-run the
matching `npm run sync-*` command and rebuild from the native IDE.
