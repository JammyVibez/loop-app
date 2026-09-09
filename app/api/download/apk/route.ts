import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import { join } from "path"

/**
 * Serves the signed Android APK for direct-install distribution.
 *
 * Place the built APK at: public/apk/loop.apk
 * (or update the path below to match your hosting setup)
 */
export async function GET(_request: NextRequest) {
  const apkPath = join(process.cwd(), "public", "apk", "loop.apk")

  try {
    const fileStat = await stat(apkPath)

    const fileBuffer = await readFile(apkPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `attachment; filename="loop.apk"`,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: "APK not available yet. Build the Android app and place it at public/apk/loop.apk.",
      },
      { status: 404 }
    )
  }
}
