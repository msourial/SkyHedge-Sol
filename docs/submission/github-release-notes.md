# Draft GitHub release notes — Encode Seeker demo

**Do not publish.** `gh` is not installed on this machine, and Homebrew is not installed either. The draft below has not been created.

**Tag (suggested):** `encode-seeker-revamp-cb03599`
**Branch:** `seeker-revamp`
**HEAD:** `cb03599389922ea4234ddc9df927585e24dd86ce`
**App code last changed:** `2a75b7f` (17 Oct 2026, 11:48). Later commits on this branch are the chain screenshots and the Vercel upload ignore. No APK rebuild was started.
**Target:** Solana Seeker / Android Devnet demo (not Play Store)

## Assets

| File | Notes |
| --- | --- |
| `app-release.apk` | On disk at `mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Built | 17 Oct 2026, 11:48 local. Version name 0.2.0, versionCode 5, same as the app on the Seeker. |

**SHA-256:** `937bd1081bd779063bc67f0b9f083d9fc1c93554fe952b56e0f5529b52c7bb50`
**Size:** 128670938 bytes

The Seeker already has this version installed (package `com.skyhedge.mobile`, updated 17 Oct 2026, 23:54). This note does not install anything.

## What's included

- Landing headline: Rain on your plans? Get paid. Open web app links to `/app`.
- Seeker Markets leads with New York. On 18 Oct 2026 the row was Open.
- Protect is an expiry chain. The buy in this demo is Nov 1 · W, the one priced trigger row, 100 SKYT, one Phantom `open_position`.
- Other trigger rows on that expiry say Coming soon. Chicago, Miami, Dallas–Fort Worth, and Los Angeles showed Soon on the first Markets screen. Toronto stays closed.
- Devnet test SKYT only. No real-world value.
- Wallet positions are not indexed on this deployment. The coverage ticket is the on-screen position.

## Devnet

- Program: `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`
- SKYT mint: `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`

## Install `gh`, then create the draft

Do not drop `--draft`. Do not add `--latest`.

```bash
cd /tmp
curl -fsSL -o gh.zip -L https://github.com/cli/cli/releases/download/v2.102.0/gh_2.102.0_macOS_arm64.zip
unzip -o gh.zip
mkdir -p "$HOME/.local/bin"
cp gh_2.102.0_macOS_arm64/bin/gh "$HOME/.local/bin/gh"
export PATH="$HOME/.local/bin:$PATH"
gh auth login -h github.com -p https -w

cd /Users/m/Documents/Codex/2026-08-12/i-would-stop-positioning-v1-as/work/SkyHedge-clock-in-redesign
gh release create encode-seeker-revamp-cb03599 \
  mobile/android/app/build/outputs/apk/release/app-release.apk \
  --repo msourial/SkyHedge-Sol \
  --target seeker-revamp \
  --draft \
  --title "Encode Seeker demo (draft)" \
  --notes-file docs/submission/github-release-notes.md
```

`gh auth login` needs you in a browser. Until that finishes, no release exists.

`ffmpeg` for the demo edit, once Homebrew exists:

```bash
brew install ffmpeg
```

Homebrew itself is not on this Mac. Installing it is separate from the `gh` zip above.
