import "server-only"
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import type { Connection } from "oracledb"
import type { NextRequest, NextResponse } from "next/server"
import { rows, schema, using } from "./db"
import type { Role, Session } from "@/lib/types"

const scrypt = promisify(scryptCallback)
export const cookieName = (role: Role) =>
  role === "ADMIN" ? "sm_admin" : "sm_passenger"
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex")
export const newId = () => randomBytes(6).readUIntBE(0, 6) || 1
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const key = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt:${salt}:${key.toString("hex")}`
}
export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt:")) {
    return password === stored
  }
  const [algorithm, salt, hex] = stored.split(":")
  if (
    algorithm !== "scrypt" ||
    !/^[0-9a-f]{32}$/.test(salt || "") ||
    !/^[0-9a-f]{128}$/.test(hex || "")
  )
    return false
  const actual = (await scrypt(password, salt, 64)) as Buffer
  return timingSafeEqual(Buffer.from(hex, "hex"), actual)
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!origin || origin !== req.nextUrl.origin)
    throw new AppError("This request must come from this website.", 403)
}
// Single-process rate limit. Use a shared limiter before deploying multiple instances.
const attempts = new Map<string, { count: number; until: number }>()
export function limitLogin(key: string) {
  const now = Date.now()
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k)
  const current = attempts.get(key) || { count: 0, until: now + 15 * 60000 }
  if (++current.count > 10)
    throw new AppError(
      "Too many sign-in attempts. Try again in 15 minutes.",
      429
    )
  attempts.set(key, current)
}
export async function findSession(
  role: Role,
  c?: Connection,
  requestToken?: string | null
): Promise<Session | null> {
  const token =
    requestToken === undefined
      ? (await cookies()).get(cookieName(role))?.value
      : requestToken
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const fn = async (conn: Connection) => {
    const s = schema()
    const sql =
      role === "ADMIN"
        ? `SELECT u.user_id, NULL passenger_id, u.email, 'Administrator' name, u.role FROM ${s}.web_admin_sessions ws JOIN ${s}.app_users u ON u.user_id=ws.user_id WHERE ws.session_hash=:hash AND ws.expires_at>SYSTIMESTAMP AND u.role='ADMIN'`
        : `SELECT u.user_id, p.passenger_id, u.email, p.full_name name, u.role FROM ${s}.web_sessions ws JOIN ${s}.passengers p ON p.passenger_id=ws.passenger_id JOIN ${s}.app_users u ON u.user_id=p.user_id WHERE ws.session_hash=:hash AND ws.expires_at>SYSTIMESTAMP AND u.role='PASSENGER'`
    const found = (await rows(conn, sql, { hash: tokenHash(token) }))[0]
    return found
      ? {
          userId: Number(found.user_id),
          passengerId: found.passenger_id ? Number(found.passenger_id) : null,
          email: String(found.email),
          name: String(found.name),
          role,
        }
      : null
  }
  return c ? fn(c) : using(fn)
}
export async function requireSession(
  role: Role,
  c?: Connection,
  requestToken?: string | null
) {
  const session = await findSession(role, c, requestToken)
  if (!session) throw new AppError("Please sign in to continue.", 401)
  return session
}
export async function createSession(
  c: Connection,
  session: Session,
  response: NextResponse
) {
  const token = randomBytes(32).toString("base64url")
  const table = session.role === "ADMIN" ? "web_admin_sessions" : "web_sessions"
  const field = session.role === "ADMIN" ? "user_id" : "passenger_id"
  await c.execute(
    `DELETE FROM ${schema()}.${table} WHERE expires_at<SYSTIMESTAMP`
  )
  await c.execute(
    `INSERT INTO ${schema()}.${table} (session_hash, ${field}, expires_at) VALUES (:hash, :id, SYSTIMESTAMP + INTERVAL '1' DAY)`,
    {
      hash: tokenHash(token),
      id: session.role === "ADMIN" ? session.userId : session.passengerId,
    }
  )
  response.cookies.set(cookieName(session.role), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  })
}
export function safeError(error: unknown) {
  if (error instanceof AppError)
    return { message: error.message, status: error.status }
  const e = error as { errorNum?: number; code?: string; message?: string }
  if (e.errorNum === 1)
    return {
      message: "This record already exists. Please check your details.",
      status: 409,
    }
  if (e.errorNum === 2292)
    return {
      message: "This record has linked history and cannot be deleted.",
      status: 409,
    }
  if (e.errorNum === 2291)
    return {
      message: "A linked record no longer exists. Refresh and try again.",
      status: 409,
    }
  if (e.errorNum === 1403) return { message: "Record not found.", status: 404 }
  if (e.errorNum && e.errorNum >= 20000 && e.errorNum <= 20999)
    return {
      message: (e.message || "Operation rejected.")
        .split("\n")[0]
        .replace(/^ORA-\d+:\s*/, ""),
      status: 409,
    }
  if (e.errorNum === 2290) {
    const msg = (e.message || "").toUpperCase()
    if (msg.includes("TRIPS_CHECK_TIMES") || msg.includes("ARRIVAL_AT > DEPARTURE_AT"))
      return { message: "Arrival time must be after departure time.", status: 409 }
    if (msg.includes("SEATS_POSITIVE") || msg.includes("SEAT_COUNT > 0"))
      return { message: "Seat count must be greater than zero.", status: 409 }
    if (msg.includes("FARE") || msg.includes("BASE_FARE"))
      return { message: "Fare amount must be greater than zero.", status: 409 }
    return {
      message: "The entered value violates database check rules. Please review your inputs.",
      status: 409,
    }
  }
  if (e.errorNum === 6510)
    return {
      message:
        "The schedule could not be saved. The vehicle or driver is unavailable or has an overlapping trip.",
      status: 409,
    }
  if (e.errorNum === 6502)
    return {
      message: "Invalid numeric or date value entered. Please check your inputs.",
      status: 409,
    }
  // Never expose SQL, connection details, credentials or stack traces to the browser.
  return {
    message: "The data service is unavailable. Please try again shortly.",
    status: 503,
  }
}
