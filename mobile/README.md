# SkyHedge Android

An Android-first React Native app for SkyHedge. It calls the existing SkyHedge API for NOAA index observations, the research catalog, Devnet release status, and finalized portfolio state. Wallet connection uses Solana Mobile Wallet Adapter (MWA) on the device.

This is a native React Native screen set, not a WebView wrapper. It does not generate weather values, sample positions, or substitute an open market when the Devnet release gates fail.

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

## App behavior

- **Weather:** current weekly rainfall observations and completed-week history from the API. Missing NOAA data remains unavailable; it is never filled with a sample.
- **Markets:** catalog entries stay explicitly marked as research until their NOAA settlement evidence is validated.
- **Wallet:** MWA requests a Devnet public address only. The portfolio screen reads indexed/finalized positions; it does not create test positions.
- **Checkout:** remains unavailable while the market, evidence, and collateral release gates are not ready.

## Configuration

Set `EXPO_PUBLIC_API_BASE_URL` at build time. For local device development, use your host's LAN URL; use an HTTPS SkyHedge deployment for a distributable build. No API URL is inferred from or hard-coded to the hackathon site.
