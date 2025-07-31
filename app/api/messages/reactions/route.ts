import { type NextRequest, NextResponse } from "next/server"

function getUserFromToken(token: string) {
  return {
    id: "1",
    username: "demo_user",
    display_name: "Demo User",
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { message_id, emoji, action } = await request.json()

    if (!message_id || !emoji) {
      return NextResponse.json(
        {
          error: "Message ID and emoji are required",
        },
        { status: 400 },
      )
    }

    if (action === "add") {
      // Add reaction
      /*
      await db.query(`
        INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      `, [message_id, user.id, emoji])
      */

      return NextResponse.json({
        success: true,
        message: "Reaction added",
      })
    } else if (action === "remove") {
      // Remove reaction
      /*
      await db.query(`
        DELETE FROM message_reactions 
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3
      `, [message_id, user.id, emoji])
      */

      return NextResponse.json({
        success: true,
        message: "Reaction removed",
      })
    }

    return NextResponse.json(
      {
        error: "Invalid action",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Message reaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
