import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params
  return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}
