import pg from "pg"
const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL to run this script (a committed fallback connection string was removed).")
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log("Starting Better Auth tables creation & data migration...")

    await client.query("BEGIN")

    // 1. Create Better Auth tables if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        "image" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "stripeCustomerId" TEXT
      );

      CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
        "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
        "scope" TEXT,
        "password" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "subscription" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plan" TEXT NOT NULL,
        "referenceId" TEXT NOT NULL,
        "stripeCustomerId" TEXT,
        "stripeSubscriptionId" TEXT,
        "status" TEXT,
        "periodStart" TIMESTAMP WITH TIME ZONE,
        "periodEnd" TIMESTAMP WITH TIME ZONE,
        "trialStart" TIMESTAMP WITH TIME ZONE,
        "trialEnd" TIMESTAMP WITH TIME ZONE,
        "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
        "cancelAt" TIMESTAMP WITH TIME ZONE,
        "canceledAt" TIMESTAMP WITH TIME ZONE,
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "seats" INTEGER,
        "billingInterval" TEXT,
        "stripeScheduleId" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `)

    console.log("Better Auth tables ensured.")

    // 2. Fetch users from auth.users and profiles from public.profiles
    const usersRes = await client.query("SELECT * FROM auth.users;")
    const profilesRes = await client.query("SELECT * FROM public.profiles;")
    const identitiesRes = await client.query("SELECT * FROM auth.identities;")

    const profilesMap = new Map()
    for (const p of profilesRes.rows) {
      profilesMap.set(p.id, p)
    }

    let migratedUsersCount = 0
    let migratedAccountsCount = 0

    for (const u of usersRes.rows) {
      const p = profilesMap.get(u.id) || {}
      const name = p.display_name || p.username || u.raw_user_meta_data?.display_name || u.raw_user_meta_data?.full_name || u.email?.split("@")[0] || "User"
      const image = p.avatar_url || u.raw_user_meta_data?.avatar_url || null
      const emailVerified = Boolean(u.email_confirmed_at)
      const stripeCustomerId = p.stripe_customer_id || null

      // Insert or update into "user"
      await client.query(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "stripeCustomerId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("id") DO UPDATE SET
           "name" = EXCLUDED."name",
           "email" = EXCLUDED."email",
           "emailVerified" = EXCLUDED."emailVerified",
           "image" = EXCLUDED."image",
           "updatedAt" = EXCLUDED."updatedAt",
           "stripeCustomerId" = COALESCE(EXCLUDED."stripeCustomerId", "user"."stripeCustomerId");`,
        [u.id, name, u.email, emailVerified, image, u.created_at, u.updated_at, stripeCustomerId]
      )
      migratedUsersCount++

      // If user has encrypted_password in auth.users, create credential account
      if (u.encrypted_password && u.encrypted_password.trim() !== "") {
        const accId = `acc_${u.id}`
        await client.query(
          `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
           VALUES ($1, $2, 'credential', $3, $4, $5, $6)
           ON CONFLICT ("id") DO UPDATE SET
             "password" = EXCLUDED."password",
             "updatedAt" = EXCLUDED."updatedAt";`,
          [accId, u.id, u.id, u.encrypted_password, u.created_at, u.updated_at]
        )
        migratedAccountsCount++
      }
    }

    // Migrate OAuth identities
    for (const ident of identitiesRes.rows) {
      if (ident.provider && ident.provider !== "email") {
        const accId = `ident_${ident.id}`
        await client.query(
          `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT ("id") DO NOTHING;`,
          [accId, ident.provider_id || ident.id, ident.provider, ident.user_id, ident.created_at || new Date(), ident.updated_at || new Date()]
        )
        migratedAccountsCount++
      }
    }

    await client.query("COMMIT")
    console.log(`Successfully migrated ${migratedUsersCount} users and ${migratedAccountsCount} accounts to Better Auth!`)
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Migration error:", err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
