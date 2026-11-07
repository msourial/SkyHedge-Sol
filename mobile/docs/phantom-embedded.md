# Enabling Phantom Embedded Wallet

The feature defaults off. MWA remains available and is the signing fallback whenever no embedded Solana account is connected. The SDK module and provider load only when both configuration gates pass. Buy cover and collect/refund use the selected signer; there is currently no vault deposit UI or signing flow in this mobile app. Future vault transactions must use the same WalletAdapter.signAndSendTransaction interface.

1. Obtain an existing Portal App ID from [Phantom Portal](https://phantom.com/portal). Portal is currently paused for new apps; existing App IDs still work. The React Native SDK always requires an App ID.
2. Allowlist `<scheme>://phantom-auth-callback` in Portal (default: `skyhedge://phantom-auth-callback`).
3. Configure Sign in with Apple with an Apple Developer account.
4. Copy mobile/.env.example to mobile/.env.local. Set EXPO_PUBLIC_PHANTOM_EMBEDDED=true and EXPO_PUBLIC_PHANTOM_APP_ID to your App ID. Optionally set EXPO_PUBLIC_PHANTOM_SCHEME; it defaults to app.json's scheme. The native build registers the same scheme when enabled. Rebuild after changing native configuration. These public variables contain no secrets.
5. Build a development client or APK and test on a physical Seeker with Devnet funds. Expo Go is insufficient for custom callback schemes. Check Google and Apple sign-in, cancel/retry, session restoration, disconnect, MWA fallback, buy cover, and collect/refund. Verify signatures and finalized balances on Solana Devnet. Also test with the flag absent, false, and true with a missing App ID: only the existing MWA experience should appear.

Embedded signing accepts only unsigned transactions. Additional signers must use Phantom's per-call presignTransaction callback; never submit a pre-signed transaction. This scaffold rejects those transactions rather than stripping signatures. No signTransaction operation is exposed because embedded wallets do not support it and current mobile flows do not need it.

Validation: npm run test:mobile; npm run check; npx expo export --platform android --output-dir .expo/phantom-android; npm run build:web -- --output-dir .expo/phantom-web. Repeat the Android export with both enablement variables set to validate the enabled bundle. Live OAuth requires a provisioned Portal App ID and device testing.

API reference: https://docs.phantom.com/sdks/react-native-sdk
