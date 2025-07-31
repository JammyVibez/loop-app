import { type NextRequest, NextResponse } from "next/server"

function getUserFromToken(token: string) {
  return {
    id: "1",
    username: "admin",
    is_admin: true,
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

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { action, amount } = await request.json()

    if (action === "weekly_reward") {
      // Weekly reward system - give 500 coins to all active users

      /*
      In a real app:
      
      const result = await db.query(`
        UPDATE users 
        SET loop_coins = loop_coins + 500,
            last_weekly_reward = NOW()
        WHERE last_weekly_reward IS NULL 
           OR last_weekly_reward < NOW() - INTERVAL '7 days'
        RETURNING id, username, loop_coins
      `)
      
      // Create transaction records
      for (const user of result.rows) {
        await db.query(`
          INSERT INTO transactions (user_id, type, amount, description, created_at)
          VALUES ($1, 'weekly_reward', 500, 'Weekly reward', NOW())
        `, [user.id])
      }
      */

      return NextResponse.json({
        success: true,
        message: "Weekly rewards distributed successfully",
        users_rewarded: 150, // Mock number
        total_coins_distributed: 75000,
      })
    }

    if (action === "bulk_reward" && amount) {
      // Bulk reward to all users

      /*
      await db.query(`
        UPDATE users 
        SET loop_coins = loop_coins + $1
      `, [amount])
      
      await db.query(`
        INSERT INTO transactions (user_id, type, amount, description, created_at)
        SELECT id, 'admin_reward', $1, 'Admin bulk reward', NOW()
        FROM users
      `, [amount])
      */

      return NextResponse.json({
        success: true,
        message: `Bulk reward of ${amount} coins distributed to all users`,
        users_rewarded: 150,
        total_coins_distributed: amount * 150,
      })
    }

    return NextResponse.json(
      {
        error: "Invalid action",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Error managing user coins:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
