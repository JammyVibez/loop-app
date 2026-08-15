# Loop — Native App (Capacitor)

Loop's web app (Next.js at **loopapp.me**) is wrapped with [Capacitor](https://capacitorjs.com)
to produce native Android and iOS shells. The shells are thin: they load the
**live hosted site** (`server.url: https://loopapp.me`), so every deploy to the
web is immediately what users see in the app — no store submission required for
content/UI updates.

- App ID: `app.loopapp.me` (locked in — can't be changed without republishing)
- App name: `Loop`

## Project layout

```
capacitor.config.ts          # appId, server.url, splash/status-bar styling
assets/                      # icon/splash sources (generated from SVG logomark)
scripts/generate-native-assets.mjs  # re-draws logomark -> assets -> all sizes
scripts/native/android-release.sh   # keystore + signed .aab on your machine
android/                     # Android project (committed)
ios/                         # iOS project (committed)
lib/native.ts                # client bridge: push/camera/status-bar/back button
lib/fcm.ts                   # server-side FCM delivery (no-op until configured)
app/api/push/native/route.ts # FCM token registration endpoint
scripts/native-push-schema.sql
```

## Prerequisites (your machine)

- **Android**: JDK 17+, Android Studio / SDK, a device or emulator.
- **iOS**: macOS + Xcode, a device or simulator (iOS 13+).
- Both: `npm install` done, and you can reach `https://loopapp.me` from the device.

## Workflow

```bash
# 1. After any web change:
npm run build          # production build (webDir used by cap sync)
npm run cap:sync       # push config/plugins/assets into android/ + ios/

# 2. Run it
npm run cap:open:android    # opens Android Studio — run on emulator/device
npm run cap:open:ios        # opens Xcode — run on simulator/device
```

Because the shell loads the live site, you don't need to rebuild the app for
most web changes. You only rebuild when you change native config, plugins,
icons, or the app version.

## Push notifications (FCM)

The web app uses browser Web Push (VAPID). Inside the native shell, push goes
through **Firebase Cloud Messaging**:

1. Create a Firebase project (or reuse one) and add an **Android app** with
   package name `app.loopapp.me` and an **iOS app** with bundle ID
   `app.loopapp.me`.
2. Download `google-services.json` → `android/app/google-services.json`
   (Android) and `GoogleService-Info.plist` → `ios/App/App/GoogleService-Info.plist`
   (iOS).
3. Add the backend env vars (API Keys tab / Vercel):
   - `FIREBASE_PROJECT_ID` — from Firebase → Project settings
   - `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` — a service account with
     "Firebase Cloud Messaging API" permission (or simpler: legacy
     `FCM_SERVER_KEY` from Cloud Messaging settings).
4. `npm run cap:sync` so the platform config picks up the new files.
5. The app auto-registers the device token (`components/pwa/native-shell.tsx`)
   and the existing notification pipeline (likes, messages, follows, broadcast,
   trending…) delivers to both Web Push **and** FCM via `lib/fcm.ts`.

Without the Firebase files/keys the app still works — push just silently stays
web-only until they're added.

## Icons & splash

- Regenerate anytime: `npm run native:assets` (redraws the "L" logomark from
  the SVG in `scripts/generate-native-assets.mjs`, then emits every size).
- Branding: dark navy/indigo background, indigo→violet gradient, white "L"
  with a loop accent.

## Status bar / splash

Configured in `capacitor.config.ts` (dark `#0d1230`, no spinner, auto-hide
after ~1.5s). Status bar is styled again at runtime by `lib/native.ts`.

## Native camera / file picker

`lib/native.ts` exports `pickNativeImage()` — inside the shell it opens the
native camera/gallery and returns a `File` that flows through the existing
Cloudinary upload path. Callers keep their web `<input type="file">` outside
the shell.

## Android release build (.aab for Play Store)

```bash
sh scripts/native/android-release.sh   # keystore + key.properties + signed .aab
npm run native:release:android         # rebuild later, once keystore exists
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

- Keep `android/loop-release.keystore` + `android/app/key.properties` safe —
  they sign every update and are gitignored.
- Bump `versionCode`/`versionName` in `android/app/build.gradle` before each
  store upload.
- Do **not** submit to the Play Store until you've tested on a real device and
  confirmed login, feed, Co-Loop, messaging, and push all work inside the shell.

## iOS notes

- Open `ios/App/App.xcworkspace` in Xcode (never the `.xcodeproj`).
- Set your Apple Developer team under Signing & Capabilities, and enable
  **Push Notifications** + **Background Modes → Remote notifications**.
- The first run loads the live site; if you see a blank screen check that the
  device can reach `https://loopapp.me` (and that `ATS` allows it — it does by
  default for HTTPS).
- APNs payloads are handled by FCM, so iOS also uses the same Firebase project.

## Testing checklist (before any store submission)

- [ ] Fresh install on Android + iOS (real devices)
- [ ] Login + Google sign-in round trip
- [ ] Feed, loop detail, branching
- [ ] Co-Loop studio publish
- [ ] DMs: send, edit, delete, forward, reactions
- [ ] Push: background push arrives on Android + iOS; tapping opens the right screen
- [ ] Camera/gallery upload from the create flow
- [ ] Status bar + splash look right in light and dark mode
