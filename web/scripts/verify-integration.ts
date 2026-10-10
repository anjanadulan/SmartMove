// Exercises the real API handlers and Oracle procedures without starting Next.
// Commits/connection close are suppressed; every Oracle fixture is rolled back.
// MongoDB test documents are explicitly removed in finally.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import oracledb, { type Pool } from "oracledb"
import { NextRequest } from "next/server"
import { GET, POST, PUT, DELETE } from "../app/api/[...path]/route"
import { hashPassword, newId, verifyPassword } from "../lib/server/security"
import { mongo } from "../lib/server/db"
if (existsSync(".env.local")) process.loadEnvFile(".env.local")
const s = process.env.ORACLE_SCHEMA || "SMARTMOVE_DATABASE"
if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(s)) throw new Error("Invalid schema name")
const c = await oracledb.getConnection({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
})
c.callTimeout = 15000
const realRollback = c.rollback.bind(c),
  realClose = c.close.bind(c)
c.commit = async () => {}
c.close = async () => {}
c.rollback = async () => {
  await c.execute("ROLLBACK TO request_test")
}
;(
  globalThis as typeof globalThis & { smartmoveOracle: Promise<Pool> }
).smartmoveOracle = Promise.resolve({
  getConnection: async () => c,
} as unknown as Pool)
const suffix = randomUUID().slice(0, 8),
  password = randomUUID(),
  mongoIds: string[] = []
const temporaryUserIds: string[] = []
let groups = 0
async function request(
  route: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  expected = 200,
  origin = "http://localhost:3000"
) {
  await c.execute("SAVEPOINT request_test")
  const req = new NextRequest(`http://localhost:3000/api/${route}`, {
    method,
    headers: { origin, cookie, "content-type": "application/json" },
    ...(method !== "GET" ? { body: JSON.stringify(body || {}) } : {}),
  })
  const context = {
    params: Promise.resolve({ path: route.split("?")[0].split("/") }),
  }
  const handler = ({ GET, POST, PUT, DELETE } as Record<string, typeof GET>)[
    method
  ]
  const response = await handler(req, context)
  const result = await response.json()
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: ${JSON.stringify(result)}`
  )
  return {
    result,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie,
  }
}
function passed(label: string) {
  groups++
  console.log(`PASS ${label}`)
}
try {
  const hash = await hashPassword(password)
  assert(await verifyPassword(password, hash))
  assert(!(await verifyPassword(password + "wrong", hash)))
  assert(!(await verifyPassword(password, "DISABLED_DEMO_HASH")))
  passed("password hashing and disabled accounts")
  await request("admin/dashboard", "GET", undefined, "", 401)
  await request("account/bookings", "GET", undefined, "", 401)
  await request(
    "auth/login",
    "POST",
    { email: `admin-${suffix}@example.test`, password, role: "ADMIN" },
    "",
    403,
    "https://another-site.example"
  )
  passed("unauthenticated access and same-origin enforcement")
  const adminId = newId()
  await c.execute(`BEGIN ${s}.add_app_user(:id,:email,:hash,'ADMIN'); END;`, {
    id: adminId,
    email: `admin-${suffix}@example.test`,
    hash,
  })
  const admin = (
    await request("auth/login", "POST", {
      email: `admin-${suffix}@example.test`,
      password,
      role: "ADMIN",
    })
  ).cookie
  await request(
    "auth/login",
    "POST",
    { email: `admin-${suffix}@example.test`, password, role: "PASSENGER" },
    "",
    401
  )
  const p1 = await request(
    "auth/signup",
    "POST",
    {
      email: `p1-${suffix}@example.test`,
      password,
      name: "Integration Passenger One",
      phone: "0700000000",
      role: "ADMIN",
    },
    "",
    201
  )
  assert.equal(p1.result.session.role, "PASSENGER")
  temporaryUserIds.push(String(p1.result.session.userId))
  const p2 = await request(
    "auth/signup",
    "POST",
    {
      email: `p2-${suffix}@example.test`,
      password,
      name: "Integration Passenger Two",
      phone: "0700000001",
    },
    "",
    201
  )
  temporaryUserIds.push(String(p2.result.session.userId))
  await request("admin/dashboard", "GET", undefined, p1.cookie, 401)
  passed("separate portals and privilege escalation prevention")
  const route = (
    await request(
      "admin/data/routes",
      "POST",
      {
        name: `Integration ${suffix}`,
        origin: `Test ${suffix}`,
        destination: "Fixture Town",
        fare: 250,
      },
      admin,
      201
    )
  ).result.id
  const vehicle = (
    await request(
      "admin/data/vehicles",
      "POST",
      { registration: `TEST-${suffix}`, type: "VAN", seats: 8 },
      admin,
      201
    )
  ).result.id
  const driver = (
    await request(
      "admin/data/drivers",
      "POST",
      {
        name: `Integration ${suffix}`,
        phone: "0710000000",
        licence: `TEST-${suffix}`,
      },
      admin,
      201
    )
  ).result.id
  const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
  const trip = (
    await request(
      "admin/data/trips",
      "POST",
      {
        routeId: route,
        vehicleId: vehicle,
        driverId: driver,
        departure: `${future}T10:00`,
        arrival: `${future}T12:00`,
      },
      admin,
      201
    )
  ).result.id
  for (const entity of [
    "vehicles",
    "drivers",
    "routes",
    "trips",
    "passengers",
    "bookings",
    "payments",
    "maintenance",
    "feedback",
  ])
    await request(`admin/data/${entity}`, "GET", undefined, admin)
  await request("admin/lookups", "GET", undefined, admin)
  passed("admin management queries and PL/SQL creation")
  const search = await request(
    `public/trips?origin=${encodeURIComponent(`Test ${suffix}`)}&date=${future}`
  )
  assert(
    search.result.rows.some((t: { trip_id: number }) => t.trip_id === trip)
  )
  await request(`public/trips/${trip}`)
  passed("trip search, dates, and hybrid trip details")
  await request(
    "account/bookings",
    "POST",
    { tripId: trip, seats: [1, 1] },
    p1.cookie,
    400
  )
  const booking = (
    await request(
      "account/bookings",
      "POST",
      { tripId: trip, seats: [1, 2] },
      p1.cookie,
      201
    )
  ).result.bookingId
  const before = (
    await c.execute(`SELECT COUNT(*) FROM ${s}.bookings WHERE trip_id=:id`, {
      id: trip,
    })
  ).rows![0]
  await request(
    "account/bookings",
    "POST",
    { tripId: trip, seats: [1] },
    p2.cookie,
    409
  )
  const after = (
    await c.execute(`SELECT COUNT(*) FROM ${s}.bookings WHERE trip_id=:id`, {
      id: trip,
    })
  ).rows![0]
  assert.deepEqual(after, before)
  assert.equal(
    (await request(`public/trips/${trip}`)).result.occupied.length,
    2
  )
  passed("seat conflict rejection and failed-workflow rollback")
  await request(
    `account/bookings/${booking}/cancel`,
    "POST",
    {},
    p2.cookie,
    404
  )
  assert(
    !(
      await request("account/bookings", "GET", undefined, p2.cookie)
    ).result.rows.some((b: { booking_id: number }) => b.booking_id === booking)
  )
  passed("passenger booking ownership")
  await request(
    "admin/data/payments",
    "POST",
    { bookingId: booking, method: "CASH" },
    admin,
    201
  )
  const owned = (
    await request("account/bookings", "GET", undefined, p1.cookie)
  ).result.rows.find((b: { booking_id: number }) => b.booking_id === booking)
  assert.equal(owned.status, "CONFIRMED")
  assert.equal(owned.paid, 500)
  await request(
    "admin/data/payments",
    "POST",
    { bookingId: booking, method: "CARD" },
    admin,
    409
  )
  passed("authoritative payment total and ticket issue")
  const complaint = await request(
    "account/feedback",
    "POST",
    {
      bookingId: booking,
      type: "COMPLAINT",
      comment: `Integration test ${suffix}`,
      vehicleRating: 3,
      driverRating: 3,
    },
    p1.cookie,
    201
  )
  mongoIds.push(String(complaint.result.feedbackId))
  await request(
    `admin/data/feedback/${complaint.result.feedbackId}/action`,
    "POST",
    { action: "reply", message: "Integration reply" },
    admin
  )
  await request(
    `admin/data/feedback/${complaint.result.feedbackId}/action`,
    "POST",
    { action: "resolve" },
    admin
  )
  const inbox = await request("account/feedback", "GET", undefined, p1.cookie)
  assert(
    inbox.result.items.some(
      (f: { feedback_id: number; reply?: { message: string } }) =>
        f.feedback_id === complaint.result.feedbackId &&
        f.reply?.message === "Integration reply"
    )
  )
  assert(
    !(
      await request("account/feedback", "GET", undefined, p2.cookie)
    ).result.items.some(
      (f: { feedback_id: number }) =>
        f.feedback_id === complaint.result.feedbackId
    )
  )
  const doc = await (
    await mongo()
  )
    .collection("feedback_content")
    .findOne({ feedbackId: String(complaint.result.feedbackId) })
  assert.equal(doc?.reply.message, "Integration reply")
  passed("Oracle feedback references and MongoDB replies")
  await request(`account/bookings/${booking}/cancel`, "POST", {}, p1.cookie)
  await request(`account/bookings/${booking}/cancel`, "POST", {}, p1.cookie)
  const cancelled = (
    await request("account/bookings", "GET", undefined, p1.cookie)
  ).result.rows.find((b: { booking_id: number }) => b.booking_id === booking)
  assert.equal(cancelled.status, "CANCELLED")
  assert.equal(cancelled.refunded, 500)
  assert.equal(
    (await request(`public/trips/${trip}`)).result.occupied.length,
    0
  )
  passed("idempotent cancellation, full refund, and released seats")
  for (const report of [
    "popular-routes",
    `revenue?start=${future}&end=${future}`,
    `passenger-history?passengerId=${p1.result.session.passengerId}`,
    `maintenance-due?asOf=${future}`,
    "trip-occupancy",
  ])
    await request(`admin/reports/${report}`, "GET", undefined, admin)
  passed("all five PL/SQL business reports")
  for (const collection of ["announcements", "vehicle_assets", "trip_media"])
    await request(
      `admin/content?collection=${collection}`,
      "GET",
      undefined,
      admin
    )
  await request("admin/analytics", "GET", undefined, admin)
  const notifications = await request(
    "account/notifications",
    "GET",
    undefined,
    p1.cookie
  )
  assert(
    notifications.result.items.some(
      (n: { bookingId?: string }) => n.bookingId === String(booking)
    )
  )
  assert(
    !(
      await request("account/notifications", "GET", undefined, p2.cookie)
    ).result.items.some(
      (n: { bookingId?: string }) => n.bookingId === String(booking)
    )
  )
  await request("public/announcements")
  passed("MongoDB content, analytics, and account notifications")
  await request("auth/logout", "POST", { role: "PASSENGER" }, p1.cookie)
  await request("account/bookings", "GET", undefined, p1.cookie, 401)
  passed("session revocation")
  console.log(
    `${groups} integration groups passed. All Oracle test writes rolled back; MongoDB test content removed.`
  )
} finally {
  await realRollback()
  if (temporaryUserIds.length)
    await (
      await mongo()
    )
      .collection("notifications")
      .deleteMany({ userId: { $in: temporaryUserIds } })
  if (mongoIds.length)
    await (
      await mongo()
    )
      .collection("feedback_content")
      .deleteMany({ feedbackId: { $in: mongoIds } })
  await realClose()
  const state = globalThis as typeof globalThis & {
    smartmoveMongo?: Promise<{ close: () => Promise<void> }>
  }
  await (await state.smartmoveMongo)?.close()
}
