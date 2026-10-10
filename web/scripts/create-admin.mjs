// Local operator utility. Password is read without echo and never printed.
import oracledb from "oracledb"
import { randomBytes, scrypt as scryptCallback } from "node:crypto"
import { promisify } from "node:util"
import readline from "node:readline"
import { createInterface } from "node:readline/promises"
process.loadEnvFile(".env.local")
if (!process.stdin.isTTY)
  throw new Error("Run this command in an interactive terminal")
const owner = process.env.ORACLE_SCHEMA || "SMARTMOVE_DATABASE"
if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(owner))
  throw new Error("Invalid schema name")
const rl = createInterface({ input: process.stdin, output: process.stdout })
const email = (await rl.question("New administrator email: "))
  .trim()
  .toLowerCase()
rl.close()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100)
  throw new Error("Enter a valid email address")
readline.emitKeypressEvents(process.stdin)
const password = await new Promise((resolve, reject) => {
  let input = ""
  process.stdout.write("Password (at least 8 characters, input hidden): ")
  process.stdin.setRawMode(true)
  process.stdin.resume()
  const done = (error) => {
    process.stdin.setRawMode(false)
    process.stdin.removeListener("keypress", onKey)
    process.stdin.pause()
    process.stdout.write("\n")
    if (error) reject(error)
    else resolve(input)
  }
  const onKey = (text, key) => {
    if (key?.ctrl && key.name === "c") return done(new Error("Cancelled"))
    if (key?.name === "return") return done()
    if (key?.name === "backspace") input = input.slice(0, -1)
    else if (!key?.ctrl && !key?.meta && text) input += text
  }
  process.stdin.on("keypress", onKey)
})
if (password.length < 8 || password.length > 128)
  throw new Error("Password must contain 8 to 128 characters")
const salt = randomBytes(16).toString("hex"),
  derived = await promisify(scryptCallback)(password, salt, 64)
const hash = `scrypt:${salt}:${derived.toString("hex")}`
const c = await oracledb.getConnection({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
})
try {
  await c.execute(
    `BEGIN ${owner}.add_app_user(:id,:email,:hash,'ADMIN'); END;`,
    { id: randomBytes(6).readUIntBE(0, 6), email, hash }
  )
  await c.commit()
  console.log("Administrator account created. Sign in at /admin/login.")
} catch (error) {
  await c.rollback()
  console.error(
    error.errorNum === 1
      ? "That email already exists."
      : "Account creation failed. Check database access."
  )
  process.exitCode = 1
} finally {
  await c.close()
}
