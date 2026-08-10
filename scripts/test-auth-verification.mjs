import { auth } from "../lib/auth.js"

async function testAuth() {
  console.log("Testing Better Auth initialized endpoints...")
  const session = await auth.api.getSession({
    headers: new Headers(),
  }).catch((e) => {
    console.error("Session test error:", e)
    return null
  })
  console.log("Session output:", session)
}

testAuth().catch(console.log)
