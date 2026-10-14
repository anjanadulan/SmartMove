import "server-only"
import { z } from "zod"
import type { Connection, BindParameters } from "oracledb"
import { rows, schema, iso, oracledb, mongo } from "./db"
import { AppError, newId } from "./security"
import { id, dateInput, dateTimeInput, phone } from "@/lib/validation"
import { entities } from "@/lib/admin-config"
import { cancel, tripSql } from "./transport"

export async function adminList(c: Connection, entity: string) {
  const s = schema()
  const queries: Record<string, string> = {
    vehicles: `SELECT vehicle_id,registration_number,vehicle_type,seat_count,status FROM ${s}.vehicles ORDER BY vehicle_id DESC`,
    drivers: `SELECT driver_id,full_name,phone,licence_number FROM ${s}.drivers ORDER BY full_name`,
    routes: `SELECT route_id,route_name,origin,destination,base_fare FROM ${s}.routes ORDER BY route_name`,
    trips:
      tripSql().replace("FROM ", ` ,d.full_name driver_name FROM `) +
      ` JOIN ${s}.drivers d ON d.driver_id=t.driver_id ORDER BY t.departure_at DESC`,
    passengers: `SELECT p.passenger_id,p.full_name,p.phone,u.email FROM ${s}.passengers p JOIN ${s}.app_users u ON u.user_id=p.user_id ORDER BY p.full_name`,
    bookings: `SELECT b.booking_id,b.passenger_id,b.trip_id,p.full_name,r.route_name,${iso("t.departure_at")} departure_at,b.status,(SELECT LISTAGG(tk.seat_number,', ') WITHIN GROUP(ORDER BY tk.seat_number) FROM ${s}.tickets tk WHERE tk.booking_id=b.booking_id) seats,NVL((SELECT SUM(tk.fare_amount) FROM ${s}.tickets tk WHERE tk.booking_id=b.booking_id),0) total FROM ${s}.bookings b JOIN ${s}.passengers p ON p.passenger_id=b.passenger_id JOIN ${s}.trips t ON t.trip_id=b.trip_id JOIN ${s}.routes r ON r.route_id=t.route_id ORDER BY b.booked_at DESC`,
    payments: `SELECT py.payment_id,py.booking_id,py.amount,py.payment_method,${iso("py.paid_at")} paid_at,p.full_name,NVL(r.amount,0) refunded,b.status booking_status FROM ${s}.payments py JOIN ${s}.bookings b ON b.booking_id=py.booking_id JOIN ${s}.passengers p ON p.passenger_id=b.passenger_id LEFT JOIN ${s}.refunds r ON r.payment_id=py.payment_id ORDER BY py.paid_at DESC`,
    maintenance: `SELECT m.maintenance_id,m.vehicle_id,m.maintenance_type,${iso("m.scheduled_date")} scheduled_date,${iso("m.completed_date")} completed_date,m.cost,m.status,v.registration_number FROM ${s}.maintenance_records m JOIN ${s}.vehicles v ON v.vehicle_id=m.vehicle_id ORDER BY m.scheduled_date`,
    feedback: `SELECT f.feedback_id,f.booking_id,f.feedback_type,f.status,p.full_name,r.route_name FROM ${s}.feedback_records f JOIN ${s}.bookings b ON b.booking_id=f.booking_id JOIN ${s}.passengers p ON p.passenger_id=b.passenger_id JOIN ${s}.trips t ON t.trip_id=b.trip_id JOIN ${s}.routes r ON r.route_id=t.route_id ORDER BY f.feedback_id DESC`,
  }
  if (!Object.hasOwn(queries, entity))
    throw new AppError("Page not found.", 404)
  const data = await rows(c, queries[entity])
  if (entity === "feedback") {
    const docs = await (
      await mongo()
    )
      .collection("feedback_content")
      .find({ feedbackId: { $in: data.map((x) => String(x.feedback_id)) } })
      .toArray()
    return data.map((row) => ({
      ...row,
      comment: String(
        docs.find((d) => d.feedbackId === String(row.feedback_id))?.comment ||
          "Content not available"
      ),
      reply: String(
        docs.find((d) => d.feedbackId === String(row.feedback_id))?.reply
          ?.message || ""
      ),
    }))
  }
  return data
}
export async function lookups(c: Connection) {
  const s = schema()
  // Use one connection sequentially; an Oracle connection cannot execute concurrently.
  const routes = await rows(
    c,
    `SELECT route_id id,route_name label FROM ${s}.routes ORDER BY route_name`
  )
  const vehicles = await rows(
    c,
    `SELECT vehicle_id id,registration_number || ' · ' || status label FROM ${s}.vehicles ORDER BY registration_number`
  )
  const drivers = await rows(
    c,
    `SELECT driver_id id,full_name label FROM ${s}.drivers ORDER BY full_name`
  )
  const pendingBookings = await rows(
    c,
    `SELECT b.booking_id id, 'Booking ' || b.booking_id || ' · ' || p.full_name label FROM ${s}.bookings b JOIN ${s}.passengers p ON p.passenger_id=b.passenger_id JOIN ${s}.trips t ON t.trip_id=b.trip_id WHERE b.status='PENDING' AND b.booked_at>SYSDATE-30/1440 AND t.status='SCHEDULED' AND t.departure_at>SYSDATE ORDER BY b.booked_at DESC`
  )
  const trips = await rows(
    c,
    `SELECT t.trip_id id, 'Trip ' || t.trip_id || ' · ' || r.route_name || ' (' || TO_CHAR(t.departure_at, 'YYYY-MM-DD HH24:MI') || ')' label FROM ${s}.trips t JOIN ${s}.routes r ON r.route_id=t.route_id ORDER BY t.departure_at DESC`
  )
  return { routes, vehicles, drivers, pendingBookings, trips }
}
function entityInput(entity: string, editing: boolean, body: unknown) {
  const config = Object.hasOwn(entities, entity) ? entities[entity] : undefined
  if (!config) throw new AppError("Unknown collection.", 404)
  const shape: Record<string, z.ZodType> = {}
  for (const field of config.fields.filter((f) =>
    editing ? !f.createOnly : !f.editOnly
  )) {
    let value: z.ZodType = z
      .string()
      .trim()
      .min(1)
      .max(
        field.key === "registration" ? 20 : field.key === "licence" ? 30 : 100
      )
    if (field.key === "origin" || field.key === "destination")
      value = z.string().trim().min(1).max(50)
    if (field.type === "number")
      value = z.coerce
        .number()
        .min(field.min || 0)
        .max(field.max || 99999999)
        .refine((v) =>
          field.key === "seats" ? Number.isInteger(v) : Number.isFinite(v)
        )
    if (field.reference) value = id
    else if (field.options)
      value = z.string().refine((v) => field.options!.includes(v))
    if (field.type === "date") value = dateInput
    if (field.type === "datetime-local") value = dateTimeInput
    if (field.key === "phone")
      value = field.optional ? z.union([phone, z.literal("")]) : phone
    shape[field.key] = value
  }
  return z.object(shape).parse(body) as Record<string, string | number>
}
export async function adminSave(
  c: Connection,
  entity: string,
  recordId: number | null,
  body: unknown
) {
  const config = Object.hasOwn(entities, entity) ? entities[entity] : undefined
  if (!config || (recordId ? !config.edit : !config.create))
    throw new AppError("This operation is unavailable.", 405)
  const input = entityInput(entity, !!recordId, body),
    binds: BindParameters = { ...input, id: recordId || newId() }
  const create: Record<string, string> = {
    vehicles: "add_vehicle(:id,:registration,:type,:seats)",
    drivers: "add_driver(:id,:name,:phone,:licence)",
    routes: "add_route(:id,:name,:origin,:destination,:fare)",
    trips:
      "schedule_trip(:id,:routeId,:vehicleId,:driverId,TO_DATE(:departure,'YYYY-MM-DD\"T\"HH24:MI'),TO_DATE(:arrival,'YYYY-MM-DD\"T\"HH24:MI'))",
    maintenance:
      "schedule_maintenance(:id,:vehicleId,:type,TO_DATE(:date,'YYYY-MM-DD'))",
  }
  const update: Record<string, string> = {
    vehicles: "update_vehicle(:id,:registration,:type,:seats,:status)",
    drivers: "update_driver(:id,:name,:phone,:licence)",
    routes: "update_route(:id,:name,:fare)",
    passengers: "update_passenger(:id,:name,:phone)",
    trips:
      "reschedule_trip(:id,:vehicleId,:driverId,TO_DATE(:departure,'YYYY-MM-DD\"T\"HH24:MI'),TO_DATE(:arrival,'YYYY-MM-DD\"T\"HH24:MI'))",
    maintenance: "update_maintenance(:id,:type,TO_DATE(:date,'YYYY-MM-DD'))",
  }
  if (entity === "payments")
    return recordPayment(c, Number(input.bookingId), String(input.method))
  if (entity === "routes") {
    if (
      input.origin &&
      input.destination &&
      String(input.origin).trim().toLowerCase() ===
        String(input.destination).trim().toLowerCase()
    ) {
      throw new AppError("Origin and destination cannot be the same town.", 400)
    }
  }
  if (entity === "trips") {
    const depStr = String(input.departure)
    const arrStr = String(input.arrival)
    const dep = new Date(depStr)
    const arr = new Date(arrStr)
    if (isNaN(dep.getTime()) || isNaN(arr.getTime())) {
      throw new AppError("Departure and arrival times are required.", 400)
    }
    if (arr <= dep) {
      throw new AppError("Arrival time must be after departure time.", 400)
    }
    if (dep.getTime() <= Date.now()) {
      throw new AppError("Departure time must be set in the future.", 400)
    }

    const s = schema()
    // 1. Check vehicle status
    const vehicleRows = await rows(
      c,
      `SELECT registration_number, status FROM ${s}.vehicles WHERE vehicle_id = :id`,
      { id: input.vehicleId }
    )
    const veh = vehicleRows[0]
    if (veh && veh.status !== "ACTIVE") {
      throw new AppError(
        `Vehicle ${veh.registration_number} is currently ${String(veh.status).toLowerCase()} and cannot be assigned to trips.`,
        409
      )
    }

    // 2. Check if vehicle is already assigned to an overlapping trip
    const vOverlap = await rows(
      c,
      `SELECT t.trip_id, r.route_name,
              TO_CHAR(t.departure_at, 'YYYY-MM-DD HH24:MI') dep_str,
              TO_CHAR(t.arrival_at, 'YYYY-MM-DD HH24:MI') arr_str
       FROM ${s}.trips t
       JOIN ${s}.routes r ON r.route_id = t.route_id
       WHERE t.status = 'SCHEDULED'
         AND t.vehicle_id = :vehicleId
         ${recordId ? "AND t.trip_id <> :recordId" : ""}
         AND t.departure_at < TO_DATE(:arrival, 'YYYY-MM-DD"T"HH24:MI')
         AND t.arrival_at > TO_DATE(:departure, 'YYYY-MM-DD"T"HH24:MI')`,
      recordId
        ? {
            vehicleId: input.vehicleId,
            arrival: arrStr,
            departure: depStr,
            recordId,
          }
        : {
            vehicleId: input.vehicleId,
            arrival: arrStr,
            departure: depStr,
          }
    )
    if (vOverlap.length > 0) {
      const o = vOverlap[0]
      const reg = veh?.registration_number || `ID ${input.vehicleId}`
      throw new AppError(
        `Vehicle ${reg} is already assigned to trip #${o.trip_id} (${o.route_name}) between ${o.dep_str} and ${o.arr_str}.`,
        409
      )
    }

    // 3. Check if driver is already assigned to an overlapping trip
    const dOverlap = await rows(
      c,
      `SELECT t.trip_id, d.full_name, r.route_name,
              TO_CHAR(t.departure_at, 'YYYY-MM-DD HH24:MI') dep_str,
              TO_CHAR(t.arrival_at, 'YYYY-MM-DD HH24:MI') arr_str
       FROM ${s}.trips t
       JOIN ${s}.drivers d ON d.driver_id = t.driver_id
       JOIN ${s}.routes r ON r.route_id = t.route_id
       WHERE t.status = 'SCHEDULED'
         AND t.driver_id = :driverId
         ${recordId ? "AND t.trip_id <> :recordId" : ""}
         AND t.departure_at < TO_DATE(:arrival, 'YYYY-MM-DD"T"HH24:MI')
         AND t.arrival_at > TO_DATE(:departure, 'YYYY-MM-DD"T"HH24:MI')`,
      recordId
        ? {
            driverId: input.driverId,
            arrival: arrStr,
            departure: depStr,
            recordId,
          }
        : {
            driverId: input.driverId,
            arrival: arrStr,
            departure: depStr,
          }
    )
    if (dOverlap.length > 0) {
      const o = dOverlap[0]
      throw new AppError(
        `Driver ${o.full_name} is already assigned to trip #${o.trip_id} (${o.route_name}) between ${o.dep_str} and ${o.arr_str}.`,
        409
      )
    }

    // 4. Check if vehicle has scheduled maintenance
    const mOverlap = await rows(
      c,
      `SELECT maintenance_type, TO_CHAR(scheduled_date, 'YYYY-MM-DD') m_date
       FROM ${s}.maintenance_records
       WHERE vehicle_id = :vehicleId
         AND status = 'SCHEDULED'
         AND TRUNC(scheduled_date) < TO_DATE(:arrival, 'YYYY-MM-DD"T"HH24:MI')
         AND TRUNC(scheduled_date) + 1 > TO_DATE(:departure, 'YYYY-MM-DD"T"HH24:MI')`,
      {
        vehicleId: input.vehicleId,
        arrival: arrStr,
        departure: depStr,
      }
    )
    if (mOverlap.length > 0) {
      const m = mOverlap[0]
      const reg = veh?.registration_number || `ID ${input.vehicleId}`
      throw new AppError(
        `Vehicle ${reg} is scheduled for workshop maintenance on ${m.m_date} (${m.maintenance_type}).`,
        409
      )
    }

    // 5. If rescheduling, check for existing bookings
    if (recordId) {
      const bookingRows = await rows(
        c,
        `SELECT COUNT(*) cnt FROM ${s}.bookings WHERE trip_id = :id`,
        { id: recordId }
      )
      if (bookingRows[0] && Number(bookingRows[0].cnt) > 0) {
        throw new AppError(
          "Cannot reschedule this trip because passengers have already booked seats on it.",
          409
        )
      }
    }
  }
  const call = (recordId ? update : create)[entity]
  if (!call) throw new AppError("Unsupported operation.", 405)
  await c.execute(`BEGIN ${schema()}.${call}; END;`, binds)
  return { id: binds.id }
}
export async function adminDelete(
  c: Connection,
  entity: string,
  recordId: number
) {
  const names: Record<string, string> = {
    vehicles: "delete_vehicle",
    drivers: "delete_driver",
    routes: "delete_route",
    trips: "delete_trip",
    maintenance: "delete_maintenance",
  }
  if (!Object.hasOwn(names, entity))
    throw new AppError("This record cannot be deleted.", 405)
  await c.execute(`BEGIN ${schema()}.${names[entity]}(:id); END;`, {
    id: recordId,
  })
}
export async function recordPayment(
  c: Connection,
  bookingId: number,
  method: string
) {
  z.enum(["CASH", "CARD", "BANK_TRANSFER"]).parse(method)
  const total = (
    await rows(
      c,
      `SELECT SUM(fare_amount) amount FROM ${schema()}.tickets WHERE booking_id=:id AND status='RESERVED'`,
      { id: bookingId }
    )
  )[0]?.amount
  if (!total) throw new AppError("This booking has no payable seats.", 409)
  const paymentId = newId()
  await c.execute(
    `BEGIN ${schema()}.record_payment(:id,:booking,:amount,:method); END;`,
    { id: paymentId, booking: bookingId, amount: Number(total), method }
  )
  return { paymentId }
}
export async function adminAction(
  c: Connection,
  entity: string,
  recordId: number,
  body: unknown
) {
  const input = z
    .object({
      action: z.enum([
        "cancel",
        "complete",
        "refund",
        "resolve",
        "reopen",
        "reply",
      ]),
      cost: z.coerce.number().min(0).max(99999999).optional(),
      reason: z.string().trim().min(3).max(200).optional(),
      message: z.string().trim().min(2).max(2000).optional(),
    })
    .parse(body)
  const s = schema()
  if (entity === "bookings" && input.action === "cancel") {
    const b = (
      await rows(
        c,
        `SELECT passenger_id FROM ${s}.bookings WHERE booking_id=:id`,
        { id: recordId }
      )
    )[0]
    if (!b) throw new AppError("Booking not found.", 404)
    return cancel(c, recordId, Number(b.passenger_id))
  }
  if (entity === "trips" && input.action === "cancel") {
    await c.execute(
      `SELECT trip_id FROM ${s}.trips WHERE trip_id=:id FOR UPDATE`,
      { id: recordId }
    )
    await c.execute(`BEGIN ${s}.cancel_trip(:id); END;`, { id: recordId })
    const paid = await rows(
      c,
      `SELECT p.payment_id FROM ${s}.payments p JOIN ${s}.bookings b ON b.booking_id=p.booking_id LEFT JOIN ${s}.refunds rf ON rf.payment_id=p.payment_id WHERE b.trip_id=:id AND rf.refund_id IS NULL`,
      { id: recordId }
    )
    for (const payment of paid)
      await c.execute(`BEGIN ${s}.process_refund(:id,:payment,:reason); END;`, {
        id: newId(),
        payment: payment.payment_id,
        reason: "Operator cancelled the trip",
      })
    return { refundedBookings: paid.length }
  }
  if (entity === "trips" && input.action === "complete") {
    await c.execute(`BEGIN ${s}.complete_trip(:id); END;`, { id: recordId })
    return {}
  }
  if (entity === "maintenance" && input.action === "complete") {
    if (input.cost === undefined) throw new AppError("Enter the service cost.")
    await c.execute(`BEGIN ${s}.complete_maintenance(:id,:cost); END;`, {
      id: recordId,
      cost: input.cost,
    })
    return {}
  }
  if (entity === "payments" && input.action === "refund") {
    if (!input.reason) throw new AppError("A refund reason is required.")
    await c.execute(`BEGIN ${s}.process_refund(:id,:payment,:reason); END;`, {
      id: newId(),
      payment: recordId,
      reason: input.reason,
    })
    return {}
  }
  if (entity === "feedback" && ["resolve", "reopen"].includes(input.action)) {
    await c.execute(`BEGIN ${s}.update_feedback_status(:id,:status); END;`, {
      id: recordId,
      status: input.action === "resolve" ? "RESOLVED" : "OPEN",
    })
    return {}
  }
  if (entity === "feedback" && input.action === "reply") {
    if (!input.message) throw new AppError("Enter a reply.")
    const found = await rows(
      c,
      `SELECT feedback_id FROM ${s}.feedback_records WHERE feedback_id=:id`,
      { id: recordId }
    )
    if (!found.length) throw new AppError("Feedback not found.", 404)
    const result = await (
      await mongo()
    )
      .collection("feedback_content")
      .updateOne(
        { feedbackId: String(recordId) },
        {
          $set: {
            reply: { staffName: "SmartMove support", message: input.message },
          },
        }
      )
    if (!result.matchedCount)
      throw new AppError("The comment content is missing.", 404)
    return {}
  }
  throw new AppError("Unsupported action.", 405)
}
export async function dashboard(c: Connection) {
  const s = schema()
  const stats = (
    await rows(
      c,
      `SELECT (SELECT COUNT(*) FROM ${s}.trips WHERE status='SCHEDULED' AND departure_at>SYSDATE) trips,(SELECT COUNT(*) FROM ${s}.vehicles WHERE status='ACTIVE') vehicles,(SELECT NVL(SUM(amount),0) FROM ${s}.payments)-(SELECT NVL(SUM(amount),0) FROM ${s}.refunds) revenue,(SELECT COUNT(*) FROM ${s}.feedback_records WHERE status='OPEN') feedback FROM dual`
    )
  )[0]
  const trips = await rows(
    c,
    tripSql() +
      " WHERE t.status='SCHEDULED' AND t.departure_at>SYSDATE ORDER BY t.departure_at FETCH FIRST 7 ROWS ONLY"
  )
  const maintenance = await rows(
    c,
    `SELECT m.maintenance_id,m.maintenance_type,${iso("m.scheduled_date")} scheduled_date,v.registration_number FROM ${s}.maintenance_records m JOIN ${s}.vehicles v ON v.vehicle_id=m.vehicle_id WHERE m.status='SCHEDULED' ORDER BY m.scheduled_date FETCH FIRST 5 ROWS ONLY`
  )
  return { stats, trips, maintenance }
}
export const reportNames = [
  "popular-routes",
  "revenue",
  "passenger-history",
  "maintenance-due",
  "trip-occupancy",
] as const
export async function report(
  c: Connection,
  name: string,
  params: URLSearchParams
) {
  z.enum(reportNames).parse(name)
  const s = schema(),
    binds: BindParameters = {}
  let call = "",
    sql = ""
  if (name === "popular-routes") {
    call = "popular_routes"
    sql = `SELECT r.route_name,COUNT(t.ticket_id) tickets_sold FROM ${s}.routes r JOIN ${s}.trips tr ON tr.route_id=r.route_id JOIN ${s}.bookings b ON b.trip_id=tr.trip_id JOIN ${s}.tickets t ON t.booking_id=b.booking_id WHERE t.status='ISSUED' GROUP BY r.route_name ORDER BY tickets_sold DESC`
  }
  if (name === "revenue") {
    const start = dateInput.parse(params.get("start")),
      end = dateInput.parse(params.get("end"))
    if (start > end)
      throw new AppError("The end date must be on or after the start date.")
    binds.startDate = start
    binds.endDate = end
    call =
      "web_revenue_period(TO_DATE(:startDate,'YYYY-MM-DD'),TO_DATE(:endDate,'YYYY-MM-DD'))"
    sql = `SELECT 'Payments' item,NVL(SUM(amount),0) amount FROM ${s}.payments WHERE paid_at>=TO_DATE(:startDate,'YYYY-MM-DD') AND paid_at<TO_DATE(:endDate,'YYYY-MM-DD')+1 UNION ALL SELECT 'Refunds',NVL(SUM(amount),0) FROM ${s}.refunds WHERE refunded_at>=TO_DATE(:startDate,'YYYY-MM-DD') AND refunded_at<TO_DATE(:endDate,'YYYY-MM-DD')+1`
  }
  if (name === "passenger-history") {
    binds.id = id.parse(params.get("passengerId"))
    call = "passenger_history(:id)"
    sql = `SELECT b.booking_id,r.route_name,t.seat_number,b.status FROM ${s}.bookings b JOIN ${s}.trips tr ON tr.trip_id=b.trip_id JOIN ${s}.routes r ON r.route_id=tr.route_id JOIN ${s}.tickets t ON t.booking_id=b.booking_id WHERE b.passenger_id=:id ORDER BY b.booking_id,t.ticket_id`
  }
  if (name === "maintenance-due") {
    binds.day = dateInput.parse(params.get("asOf"))
    call = "maintenance_due(TO_DATE(:day,'YYYY-MM-DD'))"
    sql = `SELECT m.maintenance_id,v.registration_number,m.maintenance_type,${iso("m.scheduled_date")} scheduled_date FROM ${s}.maintenance_records m JOIN ${s}.vehicles v ON v.vehicle_id=m.vehicle_id WHERE m.status='SCHEDULED' AND m.scheduled_date<TO_DATE(:day,'YYYY-MM-DD')+1 ORDER BY m.scheduled_date`
  }
  if (name === "trip-occupancy") {
    call = "trip_occupancy"
    sql = `SELECT tr.trip_id,r.route_name,v.seat_count,COUNT(CASE WHEN t.status='ISSUED' THEN 1 END) occupied_seats,ROUND(COUNT(CASE WHEN t.status='ISSUED' THEN 1 END)*100/v.seat_count,2) occupancy_percent FROM ${s}.trips tr JOIN ${s}.routes r ON r.route_id=tr.route_id JOIN ${s}.vehicles v ON v.vehicle_id=tr.vehicle_id LEFT JOIN ${s}.bookings b ON b.trip_id=tr.trip_id LEFT JOIN ${s}.tickets t ON t.booking_id=b.booking_id GROUP BY tr.trip_id,r.route_name,v.seat_count ORDER BY tr.trip_id`
  }
  await c.execute("BEGIN DBMS_OUTPUT.ENABLE(100000); END;")
  await c.execute(`BEGIN ${s}.${call}; END;`, binds)
  const output: string[] = []
  for (let i = 0; i < 1000; i++) {
    const result = await c.execute(
      "BEGIN DBMS_OUTPUT.GET_LINE(:line,:status); END;",
      {
        line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
        status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    )
    const out = result.outBinds as { line: string; status: number }
    if (out.status !== 0) break
    output.push(out.line)
  }
  const data = await rows(c, sql, binds)
  if (name === "revenue")
    data.push({
      item: "Net revenue",
      amount: Number(data[0].amount) - Number(data[1].amount),
    })
  return { rows: data, output, procedure: call.split("(")[0] }
}
