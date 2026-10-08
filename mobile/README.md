# SkyHedge Android

An Android-first React Native app for SkyHedge. It calls the existing SkyHedge API for NOAA index observations, the research catalog, Devnet release status, and finalized portfolio state. Wallet connection uses Solana Mobile Wallet Adapter (MWA) on the device.

This is a native React Native screen set, not a WebView wrapper. It does not generate weather values, sample positions, or substitute an open market when the Devnet release gates fail.

Mobile read-only API requests share one `/api/mobile?resource=...` endpoint. This keeps the client compatible with the current Vercel function allowance; supported resources are `cities`, `city`, `agricultural-markets`, and `portfolio`.

## Requirements

- Node.js 22 and npm
- Android Studio with Android SDK and an Android device or emulator
- An MWA-compatible Android wallet for wallet-connect testing
- The SkyHedge API reachable from the device

## Run on a device

From this directory:

```sh
npm install
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:5000 npm run android
```

Use the host machine's LAN address for a physical phone. Android emulators can use the default `http://10.0.2.2:5000`. The server must be reachable from the device and allow the connection. Do not put NOAA or signing secrets in this client; `EXPO_PUBLIC_*` variables are bundled into the app.

MWA contains native Android code. Expo Go is not a supported runtime; build and install the custom app with `npm run android` or Android Studio.

## Build an installable APK

The `hackathon-apk` EAS profile is configured to emit an internal APK:

```sh
npx eas-cli login
npm run build:apk
```

EAS uploads the app source to Expo's build service. Review that upload and use of an Expo account before running this command. Alternatively, build locally after installing the Android SDK with `npm run android`, then create a release APK in Android Studio.

For the locally verified release build, with Android Studio's JDK and SDK configured:

```sh
npm ci
EXPO_PUBLIC_API_BASE_URL=https://skyhedge.vercel.app ./android/gradlew -p android :app:assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Verify its SHA-256 and API URL again after any source or configuration change.

## App behavior

- **Place-first Explore:** search the researched catalog, choose a reference place, select rainfall/wind/snowfall, then review its actual evidence and availability. Changing the place or risk clears any previous quote. The advisory guide remains optional beside search.
- **Reference map:** MapLibre renders the catalog reference point with MapTiler Dataviz Dark only when `EXPO_PUBLIC_MAPTILER_KEY` is configured at build time. Without a key, missing coordinates, or map tiles, the app shows the precise text location and an external OpenStreetMap link. Toronto and Saskatoon have no pinned map marker until their coordinates are verified. No marker is a coverage boundary or NOAA station.
- **Weather:** current weekly rainfall observations and completed-week history from the API. Missing NOAA data remains unavailable; it is never filled with a sample.
- **Explore and guide:** area search stays available beside an advisory-only natural-language guide. Saskatoon dry-spell and Toronto event-rain examples are research pilots, not available contracts. The guide needs the server-side Anthropic configuration and never creates a quote or transaction. Wind gust and new snowfall remain research-only.
- **Markets:** the rainfall catalog stays explicitly marked as research until NOAA settlement evidence is validated. Snowfall means new accumulation, not snow depth.
- **Wallet:** MWA requests a Devnet public address only. The portfolio screen reads indexed/finalized positions; it does not create test positions.
- **Checkout:** remains unavailable while the market, evidence, and collateral release gates are not ready. Wind and snowfall do not inherit rainfall readiness.

The guide distinguishes a non-binding USD preview from SKYT Devnet test amounts. Its maximum-cost explanation refers to a future committed SKYT quote and separate network fee; it does not convert dollars to SKYT. A customer must separately request a quote and approve any wallet transaction.

## Verified local test build

On October 6, 2026, the release APK was rebuilt with `EXPO_PUBLIC_API_BASE_URL=https://skyhedge.vercel.app`, installed on a physical Seeker, and opened successfully. The Explore and Protect screens read the live NOAA station package and the finalized expired Draft/empty-vault status. Wallet authorization, signing, and a finalized position on the physical phone are **not yet verified**. The output is `android/app/build/outputs/apk/release/app-release.apk`. Do not upload source to EAS unless you intentionally authorize its cloud build/source upload.

Public production-API APK SHA-256: `322cfb18428400c63e9173b8e39e5a0181255069ee53589f4bb370111e1e4987` (built from `382592a`). A clean `3d7f245` candidate, SHA-256 `cf3224de382e0e80eaf96867f3f0df849cddfda1f747fa2f18e330bededd5de4`, is installed on the Seeker but its screen remains unverified; it has not replaced the public release asset.

## Configuration

Set `EXPO_PUBLIC_API_BASE_URL` at build time. For local device development, use your host's LAN URL; use an HTTPS SkyHedge deployment for a distributable build. No API URL is inferred from or hard-coded to the hackathon site.

`EXPO_PUBLIC_MAPTILER_KEY` is optional. It is bundled into the Android app and must be treated as a public, appropriately restricted map key—not a server secret. Add it before a build to enable the native basemap. Native MapLibre requires a rebuilt Android app; an Expo Go session or JavaScript-only refresh cannot add that module. The current map shows linked text attribution, but MapTiler Free also requires its official logo; do not distribute a key-enabled Free-plan build until that logo is added and visually verified. Map rendering and tile-failure retry also remain unverified until a key is available.
