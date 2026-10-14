import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { z, ZodError } from "zod"
import { using, rows, schema, mongo } from "@/lib/server/db"
import {
  AppError,
  newId,
  verifyPassword,
  hashPassword,
  createSession,
  requireSession,
  findSession,
  cookieName,
  tokenHash,
  sameOrigin,
  safeError,
  limitLogin,
} from "@/lib/server/security"
import {
  searchTrips,
  tripDetail,
  passengerBookings,
  book,
  cancel,
  submitFeedback,
  listContent,
} from "@/lib/server/transport"
import {
  adminList,
  adminSave,
  adminDelete,
  adminAction,
  dashboard,
  lookups,
  report,
} from "@/lib/server/admin"
import {
  loginInput,
  signupInput,
  bookingInput,
  profileInput,
  feedbackInput,
  id,
  dateInput,
  safeMediaUrl,
} from "@/lib/validation"
import type { Session } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
type Context = { params: Promise<{ path: string[] }> }
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })
const contentCollections = [
  "announcements",
  "vehicle_assets",
  "trip_media",
] as const
async function handle(req: NextRequest, context: Context) {
  let createdFeedback: number | undefined
  let notice: { userId: string; message: string; bookingId: string } | undefined
  try {
    const path = (await context.params).path
    const route = path.join("/"),
      url = req.nextUrl,
      method = req.method
    const mutating = method !== "GET"
    let body: unknown = {}
    if (mutating) {
      sameOrigin(req)
      const text = await req.text()
      if (text.length > 65536)
        throw new AppError("The request is too large.", 413)
      try {
        body = text ? JSON.parse(text) : {}
      } catch {
        throw new AppError("Invalid request data.")
      }
    }
    if (route === "session" && method === "GET")
      return json({
        session: await findSession(
          "PASSENGER",
          undefined,
          req.cookies.get(cookieName("PASSENGER"))?.value || null
        ),
        demoPayments: process.env.ALLOW_DEMO_PAYMENTS === "true",
      })
    if (route === "admin/session" && method === "GET")
      return json({
        session: await requireSession(
          "ADMIN",
          undefined,
          req.cookies.get(cookieName("ADMIN"))?.value || null
        ),
      })
    if (route === "auth/login" && method === "POST") {
      const input = loginInput.parse(body)
      limitLogin(`${input.role}:${input.email}`)
      return await using(async (c) => {
        const view =
          input.role === "ADMIN" ? "web_admin_login" : "web_passenger_login"
        const found = (
          await rows(
            c,
            `SELECT * FROM ${schema()}.${view} WHERE LOWER(email)=:email`,
            { email: input.email }
          )
        )[0]
        const valid = await verifyPassword(
          input.password,
          String(
            found?.password_hash ||
              `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`
          )
        )
        if (!found || !valid)
          throw new AppError(
            "Email or password is incorrect for this portal.",
            401
          )
        const session: Session = {
          userId: Number(found.user_id),
          passengerId:
            input.role === "PASSENGER" ? Number(found.passenger_id) : null,
          email: String(found.email),
          name: String(found.full_name || "Administrator"),
          role: input.role,
        }
        const response = json({ session })
        await createSession(c, session, response)
        return response
      }, true)
    }
    if (route === "auth/signup" && method === "POST") {
      const input = signupInput.parse(body)
      limitLogin(`signup:${input.email}`)
      const hash = await hashPassword(input.password)
      return await using(async (c) => {
        const userId = newId(),
          passengerId = newId()
        await c.execute(
          `BEGIN ${schema()}.web_register_passenger(:email,:hash,:name,:phone,:userId,:passengerId); END;`,
          {
            email: input.email,
            hash,
            name: input.name,
            phone: input.phone,
            userId,
            passengerId,
          }
        )
        const session: Session = {
          userId,
          passengerId,
          email: input.email,
          name: input.name,
          role: "PASSENGER",
        }
        const response = json({ session }, 201)
        await createSession(c, session, response)
        return response
      }, true)
    }
    if (route === "auth/logout" && method === "POST") {
      const { role } = z
        .object({ role: z.enum(["PASSENGER", "ADMIN"]) })
        .parse(body)
      const token = req.cookies.get(cookieName(role))?.value
      if (token)
        await using(
          (c) =>
            c.execute(
              `DELETE FROM ${schema()}.${role === "ADMIN" ? "web_admin_sessions" : "web_sessions"} WHERE session_hash=:hash`,
              { hash: tokenHash(token) }
            ),
          true
        )
      const response = json({ ok: true })
      response.cookies.set(cookieName(role), "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
      })
      return response
    }
    if (route === "public/announcements" && method === "GET") {
      const docs = await listContent("announcements", {
        $or: [
          { audience: { $in: ["PASSENGERS", "ALL"] } },
          { audience: { $exists: false } },
        ],
      })
      return json({
        items: docs.map((doc) => ({
          ...doc,
          body: (doc.body as string) || (doc.content as string) || "",
          audience: (doc.audience as string) || (doc.category as string) || "ALL",
          createdAt: (doc.createdAt as string) || (doc.postedDate as string),
        })),
      })
    }
    if (route === "public/routes" && method === "GET")
      return json({
        rows: await using((c) =>
          rows(
            c,
            `SELECT route_id,route_name,origin,destination,base_fare FROM ${schema()}.routes ORDER BY route_name`
          )
        ),
      })
    if (route === "public/trips" && method === "GET") {
      const date = url.searchParams.get("date") || undefined
      if (date) dateInput.parse(date)
      const origin = z
          .string()
          .max(50)
          .parse(url.searchParams.get("origin") || ""),
        destination = z
          .string()
          .max(50)
          .parse(url.searchParams.get("destination") || "")
      return json({
        rows: await using((c) => searchTrips(c, origin, destination, date)),
      })
    }
    if (
      path[0] === "public" &&
      path[1] === "trips" &&
      path.length === 3 &&
      method === "GET"
    )
      return json(await using((c) => tripDetail(c, id.parse(path[2]))))
    if (path[0] === "account") {
      const response = await using(async (c) => {
        const session = await requireSession(
          "PASSENGER",
          c,
          req.cookies.get(cookieName("PASSENGER"))?.value || null
        )
        if (route === "account/bookings" && method === "GET")
          return json({ rows: await passengerBookings(c, session) })
        if (route === "account/bookings" && method === "POST") {
          const input = bookingInput.parse(body)
          const result = await book(c, session, input.tripId, input.seats)
          notice = {
            userId: String(session.userId),
            bookingId: String(result.bookingId),
            message: `Your booking SM-${result.bookingId} is reserved. Complete payment within 30 minutes.`,
          }
          return json(result, 201)
        }
        if (path[1] === "bookings" && path.length === 4) {
          const bookingId = id.parse(path[2])
          if (path[3] === "cancel" && method === "POST") {
            const result = await cancel(c, bookingId, session.passengerId!)
            if ((result as { changed: number })?.changed)
              notice = {
                userId: String(session.userId),
                bookingId: String(bookingId),
                message: `Booking SM-${bookingId} has been cancelled. Check My bookings for refund details.`,
              }
            return json(result)
          }
          if (path[3] === "payment" && method === "POST") {
            if (process.env.ALLOW_DEMO_PAYMENTS !== "true")
              throw new AppError(
                "Please arrange payment with SmartMove operations.",
                403
              )
            const owned = await rows(
              c,
              `SELECT booking_id FROM ${schema()}.bookings WHERE booking_id=:id AND passenger_id=:passenger`,
              { id: bookingId, passenger: session.passengerId }
            )
            if (!owned.length) throw new AppError("Booking not found.", 404)
            const { method: paymentMethod } = z
              .object({ method: z.enum(["CASH", "CARD", "BANK_TRANSFER"]) })
              .parse(body)
            const { recordPayment } = await import("@/lib/server/admin")
            return json(await recordPayment(c, bookingId, paymentMethod))
          }
        }
        if (route === "account/profile" && method === "PUT") {
          const input = profileInput.parse(body)
          await c.execute(
            `BEGIN ${schema()}.web_update_profile(:id,:name,:phone); END;`,
            { id: session.passengerId, name: input.name, phone: input.phone }
          )
          return json({ ok: true })
        }
        if (route === "account/profile" && method === "GET")
          return json({
            profile: (
              await rows(
                c,
                `SELECT full_name,phone FROM ${schema()}.passengers WHERE passenger_id=:id`,
                { id: session.passengerId }
              )
            )[0],
            session,
          })
        if (route === "account/feedback" && method === "POST") {
          const result = await submitFeedback(
            c,
            session,
            feedbackInput.parse(body)
          )
          createdFeedback = result.feedbackId
          return json(result, 201)
        }
        if (route === "account/feedback" && method === "GET") {
          const records = await rows(
            c,
            `SELECT f.feedback_id,f.booking_id,f.feedback_type,f.status FROM ${schema()}.feedback_records f JOIN ${schema()}.bookings b ON b.booking_id=f.booking_id WHERE b.passenger_id=:id ORDER BY f.feedback_id DESC`,
            { id: session.passengerId }
          )
          const docs = await (
            await mongo()
          )
            .collection("feedback_content")
            .find({
              feedbackId: { $in: records.map((r) => String(r.feedback_id)) },
            })
            .toArray()
          return json({
            items: records.map((record) => ({
              ...record,
              comment:
                docs.find((d) => d.feedbackId === String(record.feedback_id))
                  ?.comment || "Content not available",
              reply:
                docs.find((d) => d.feedbackId === String(record.feedback_id))
                  ?.reply || null,
            })),
          })
        }
        if (route === "account/notifications" && method === "GET")
          return json({
            items: await listContent("notifications", {
              userId: String(session.userId),
            }),
          })
        if (
          path[1] === "notifications" &&
          path.length === 3 &&
          method === "PUT"
        ) {
          const objectId = z
            .string()
            .regex(/^[a-f0-9]{24}$/i)
            .parse(path[2])
          const result = await (
            await mongo()
          )
            .collection("notifications")
            .updateOne(
              { _id: new ObjectId(objectId), userId: String(session.userId) },
              { $set: { isRead: true } }
            )
          if (!result.matchedCount)
            throw new AppError("Notification not found.", 404)
          return json({ ok: true })
        }
        throw new AppError("Endpoint not found.", 404)
      }, mutating)
      if (notice) {
        // A content outage must not turn a committed reservation into a failure.
        try {
          await (
            await mongo()
          )
            .collection("notifications")
            .insertOne({ ...notice, isRead: false, createdAt: new Date() })
        } catch {
          console.error("Booking notification could not be delivered.")
        }
      }
      return response
    }
    if (path[0] === "admin") {
      return await using(async (c) => {
        await requireSession(
          "ADMIN",
          c,
          req.cookies.get(cookieName("ADMIN"))?.value || null
        )
        if (route === "admin/dashboard" && method === "GET")
          return json(await dashboard(c))
        if (route === "admin/lookups" && method === "GET")
          return json(await lookups(c))
        if (path[1] === "reports" && path.length === 3 && method === "GET")
          return json(await report(c, path[2], url.searchParams))
        if (route === "admin/analytics" && method === "GET") {
          const db = await mongo()
          const pipeline = (field: string, rating: string) => [
            { $match: { [rating]: { $type: "number" } } },
            {
              $group: {
                _id: `$${field}`,
                averageRating: { $avg: `$${rating}` },
                reviews: { $sum: 1 },
              },
            },
            { $sort: { averageRating: -1 } },
            { $limit: 20 },
          ]
          return json({
            vehicles: await db
              .collection("feedback_content")
              .aggregate(pipeline("vehicleId", "vehicleRating"))
              .toArray(),
            drivers: await db
              .collection("feedback_content")
              .aggregate(pipeline("driverId", "driverRating"))
              .toArray(),
          })
        }
        if (path[1] === "content" && path.length <= 3) {
          const collection = z
            .enum(contentCollections)
            .parse(url.searchParams.get("collection"))
          const db = await mongo()
          if (method === "GET") {
            const docs = await listContent(collection)
            return json({
              items: docs.map((doc) => ({
                ...doc,
                body: doc.body || doc.content,
                audience: doc.audience || doc.category,
                fileUrl:
                  doc.fileUrl ||
                  doc.url ||
                  (doc.fileName ? `/uploads/${doc.fileName}` : undefined),
                assetType:
                  doc.assetType ||
                  (doc.documentType === "PHOTO"
                    ? "IMAGE"
                    : doc.documentType
                      ? "DOCUMENT"
                      : undefined),
                createdAt: doc.createdAt || doc.postedDate || doc.sentAt,
              })),
            })
          }
          if (method === "DELETE" && path[2]) {
            const objectId = z
              .string()
              .regex(/^[a-f0-9]{24}$/i)
              .parse(path[2])
            await db
              .collection(collection)
              .deleteOne({ _id: new ObjectId(objectId) })
            return json({ ok: true })
          }
          if (method === "POST") {
            const announcement = z.object({
              title: z.string().trim().min(3).max(150),
              body: z.string().trim().min(5).max(5000),
              audience: z.enum(["PASSENGERS", "ALL", "ADMIN"]),
              category: z.string().optional(),
              active: z.union([z.boolean(), z.string()]).optional(),
            })
            const asset = z.object({
              vehicleId: id.transform(String),
              assetType: z.enum(["IMAGE", "DOCUMENT"]),
              fileUrl: z
                .string()
                .max(2000)
                .refine(
                  safeMediaUrl,
                  "Use an HTTPS URL or a file in /uploads/"
                ),
            })
            const media = z.object({
              tripId: id.transform(String),
              mediaType: z.enum(["IMAGE", "VIDEO"]),
              fileUrl: z
                .string()
                .max(2000)
                .refine(
                  safeMediaUrl,
                  "Use an HTTPS URL or a file in /uploads/"
                ),
              caption: z.string().trim().max(300),
            })
            const parsed =
              collection === "announcements"
                ? announcement.parse(body)
                : collection === "vehicle_assets"
                  ? asset.parse(body)
                  : media.parse(body)
            if ("vehicleId" in parsed || "tripId" in parsed) {
              const vehicle = "vehicleId" in parsed
              const found = await rows(
                c,
                `SELECT ${vehicle ? "vehicle_id" : "trip_id"} FROM ${schema()}.${vehicle ? "vehicles" : "trips"} WHERE ${vehicle ? "vehicle_id" : "trip_id"}=:id`,
                {
                  id: Number(
                    vehicle
                      ? (parsed as { vehicleId: string }).vehicleId
                      : (parsed as { tripId: string }).tripId
                  ),
                }
              )
              if (!found.length)
                throw new AppError("The linked record does not exist.", 404)
            }
            const now = new Date()
            let docToInsert: Record<string, unknown> = { ...parsed, createdAt: now }
            if (collection === "announcements") {
              const ann = parsed as {
                title: string
                body: string
                audience: string
                category?: string
                active?: boolean | string
              }
              const isActive =
                ann.active === undefined
                  ? true
                  : ann.active === true ||
                    ann.active === "true" ||
                    ann.active === "on"
              docToInsert = {
                title: ann.title,
                body: ann.body,
                content: ann.body,
                audience: ann.audience,
                category:
                  ann.category ||
                  (ann.audience === "ALL" ? "SCHEDULE" : "NOTICE"),
                active: isActive,
                createdAt: now,
                postedDate: now,
              }
            } else if (collection === "vehicle_assets") {
              const asset = parsed as {
                vehicleId: string
                assetType: string
                fileUrl: string
              }
              docToInsert = {
                ...asset,
                documentType:
                  asset.assetType === "IMAGE" ? "PHOTO" : "DOCUMENT",
                createdAt: now,
              }
            } else if (collection === "trip_media") {
              const med = parsed as {
                tripId: string
                mediaType: string
                fileUrl: string
                caption: string
              }
              docToInsert = {
                ...med,
                url: med.fileUrl,
                createdAt: now,
              }
            }
            const result = await db.collection(collection).insertOne(docToInsert)
            return json({ id: result.insertedId.toString() }, 201)
          }
        }
        if (path[1] === "data" && path[2]) {
          const entity = path[2],
            recordId = path[3] ? id.parse(path[3]) : null
          if (method === "GET" && path.length === 3) {
            const data = await adminList(c, entity)
            const q = (url.searchParams.get("q") || "")
              .toLowerCase()
              .slice(0, 200)
            return json({
              rows: q
                ? data.filter((row) =>
                    Object.values(row).some((v) =>
                      String(v).toLowerCase().includes(q)
                    )
                  )
                : data,
            })
          }
          if (method === "POST" && path.length === 3)
            return json(await adminSave(c, entity, null, body), 201)
          if (method === "PUT" && recordId && path.length === 4)
            return json(await adminSave(c, entity, recordId, body))
          if (method === "DELETE" && recordId && path.length === 4) {
            await adminDelete(c, entity, recordId)
            return json({ ok: true })
          }
          if (
            method === "POST" &&
            recordId &&
            path[4] === "action" &&
            path.length === 5
          )
            return json(await adminAction(c, entity, recordId, body))
        }
        throw new AppError("Endpoint not found.", 404)
      }, mutating)
    }
    throw new AppError("Endpoint not found.", 404)
  } catch (error) {
    if (createdFeedback) {
      try {
        await (
          await mongo()
        )
          .collection("feedback_content")
          .deleteOne({ feedbackId: String(createdFeedback) })
      } catch {
        console.error("Feedback compensation requires reconciliation.")
      }
    }
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues
            .map((x) => `${x.path.join(".") || "Input"}: ${x.message}`)
            .join(" · "),
        },
        400
      )
    const failure = safeError(error)
    return json({ error: failure.message }, failure.status)
  }
}
export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
