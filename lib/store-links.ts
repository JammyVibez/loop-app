/**
 * Native app store listings and direct-install links for Loop.
 *
 * APP_STORE_URL / PLAY_STORE_URL stay empty until the listings are approved.
 * While empty, the store badges show a disabled "Coming soon" state.
 *
 * APK_DIRECT_URL points to the self-hosted signed APK for direct Android install.
 * APK_CHECKSUM is the SHA-256 of the latest release APK (updated on each build).
 */

export const APP_STORE_URL = ""

export const PLAY_STORE_URL = ""

/** Direct APK download URL — host the signed .apk on your server/CDN. */
export const APK_DIRECT_URL = "/api/download/apk"

/** SHA-256 checksum of the latest release APK (update after each build). */
export const APK_CHECKSUM: string = ""

/** App version shown on the download page. Bump on each release. */
export const APK_VERSION = "1.0.0"
