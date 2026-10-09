import "server-only"
import type { Connection } from "oracledb"
import { rows, schema, iso, oracledb, mongo } from "./db"
import { AppError, newId } from "./security"
import type { Trip, Booking, Session, ContentItem } from "@/lib/types"

export function tripSql() {
  const s = schema()
  return `SELECT t.trip_id, t.route_id, t.vehicle_id, t.driver_id, r.route_name, r.origin, r.destination, ${iso("t.departure_at")} departure_at, ${iso("t.arrival_at")} arrival_at, t.fare, t.status, v.vehicle_type, v.registration_number, v.seat_count, ${s}.available_seats(t.trip_id) available_seats FROM ${s}.trips t JOIN ${s}.routes r ON r.route_id=t.route_id JOIN ${s}.vehicles v ON v.vehicle_id=t.vehicle_id`
}
export async function searchTrips(
  c: Connection,
  origin: string,
  destination: string,
  date?: string
) {
  return rows<Trip>(
    c,
    tripSql() +
      ` WHERE t.status='SCHEDULED' AND t.departure_at>SYSDATE AND (:origin IS NULL OR LOWER(r.origin)=LOWER(:origin)) AND (:destination IS NULL OR LOWER(r.destination)=LOWER(:destination)) ${date ? "AND t.departure_at >= TO_DATE(:day,'YYYY-MM-DD') AND t.departure_at<TO_DATE(:day,'YYYY-MM-DD')+1" : ""} ORDER BY t.departure_at FETCH FIRST 100 ROWS ONLY`,
    {
      origin: origin || null,
      destination: destination || null,
      ...(date ? { day: date } : {}),
    }
  )
}
export async function tripDetail(c: Connection, tripId: number) {
  const trip = (
    await rows<Trip>(c, tripSql() + " WHERE t.trip_id=:id", { id: tripId })
  )[0]
  if (!trip) throw new AppError("Trip not found.", 404)
  const occupied = await rows(
    c,
    `SELECT tk.seat_number FROM ${schema()}.tickets tk JOIN ${schema()}.bookings b ON b.booking_id=tk.booking_id WHERE b.trip_id=:id AND (tk.status='ISSUED' OR (tk.status='RESERVED' AND b.status='PENDING' AND b.booked_at>SYSDATE-30/1440))`,
    { id: tripId }
  )
  const contentDb = await mongo().catch(() => null)
  const reviews = contentDb
    ? await contentDb
        .collection("feedback_content")
        .find({
          routeId: String(trip.route_id),
          $or: [
            { published: true },
            { published: { $exists: false }, type: { $ne: "COMPLAINT" } },
          ],
        })
        .sort({ _id: -1 })
        .limit(10)
        .toArray()
    : []
  const assets = contentDb
    ? await contentDb
        .collection("vehicle_assets")
        .find({ vehicleId: String(trip.vehicle_id), assetType: "IMAGE" })
        .limit(12)
        .toArray()
    : []
  const media = contentDb
    ? await contentDb
        .collection("trip_media")
        .find({ tripId: String(tripId) })
        .limit(12)
        .toArray()
    : []
  return {
    trip,
    occupied: occupied.map((x) => Number(x.seat_number)),
    reviews,
    assets,
    media,
    contentAvailable: !!contentDb,
  }
}
export async function passengerBookings(c: Connection, session: Session) {
  const s = schema()
  return rows<Booking>(
    c,
    `SELECT b.booking_id, b.trip_id, r.origin, r.destination, r.route_name, ${iso("tr.departure_at")} departure_at, ${iso("tr.arrival_at")} arrival_at, ${iso("b.booked_at")} booked_at, b.status, tr.status trip_status, v.registration_number, NVL((SELECT SUM(t.fare_amount) FROM ${s}.tickets t WHERE t.booking_id=b.booking_id),0) total, (SELECT LISTAGG(t.seat_number,', ') WITHIN GROUP(ORDER BY t.seat_number) FROM ${s}.tickets t WHERE t.booking_id=b.booking_id) seats, NVL(p.amount,0) paid, NVL(rf.amount,0) refunded FROM ${s}.bookings b JOIN ${s}.trips tr ON tr.trip_id=b.trip_id JOIN ${s}.routes r ON r.route_id=tr.route_id JOIN ${s}.vehicles v ON v.vehicle_id=tr.vehicle_id LEFT JOIN ${s}.payments p ON p.booking_id=b.booking_id LEFT JOIN ${s}.refunds rf ON rf.payment_id=p.payment_id WHERE b.passenger_id=:id ORDER BY b.booked_at DESC`,
    { id: session.passengerId }
  )
}
export async function book(
  c: Connection,
  session: Session,
  tripId: number,
  seats: number[]
) {
  const bookingId = newId()
  await c.execute(
    `BEGIN ${schema()}.create_booking(:id,:passenger,:trip); END;`,
    { id: bookingId, passenger: session.passengerId, trip: tripId }
  )
  for (const seat of seats)
    await c.execute(
      `BEGIN ${schema()}.reserve_seat(:id,:booking,:seat); END;`,
      { id: newId(), booking: bookingId, seat }
    )
  return { bookingId }
}
export async function cancel(
  c: Connection,
  bookingId: number,
  passengerId: number
) {
  const result = await c.execute(
    `BEGIN ${schema()}.web_cancel_booking(:booking,:passenger,:refund,:changed,:amount); END;`,
    {
      booking: bookingId,
      passenger: passengerId,
      refund: newId(),
      changed: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      amount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    }
  )
  return result.outBinds
}
export async function submitFeedback(
  c: Connection,
  session: Session,
  input: {
    bookingId: number
    type: string
    comment: string
    vehicleRating: number
    driverRating: number
  }
) {
  const s = schema(),
    feedbackId = newId()
  const linked = (
    await rows(
      c,
      `SELECT t.route_id,t.vehicle_id,t.driver_id FROM ${s}.bookings b JOIN ${s}.trips t ON t.trip_id=b.trip_id WHERE b.booking_id=:id AND b.passenger_id=:passenger`,
      { id: input.bookingId, passenger: session.passengerId }
    )
  )[0]
  if (!linked) throw new AppError("Booking not found.", 404)
  await c.execute(
    `BEGIN ${s}.web_submit_feedback(:id,:booking,:passenger,:type); END;`,
    {
      id: feedbackId,
      booking: input.bookingId,
      passenger: session.passengerId,
      type: input.type,
    }
  )
  const db = await mongo()
  await db
    .collection("feedback_content")
    .insertOne({
      feedbackId: String(feedbackId),
      routeId: String(linked.route_id),
      vehicleId: String(linked.vehicle_id),
      driverId: String(linked.driver_id),
      userId: String(session.userId),
      type: input.type,
      comment: input.comment,
      vehicleRating: input.type === "REVIEW" ? input.vehicleRating : null,
      driverRating: input.type === "REVIEW" ? input.driverRating : null,
      published: input.type === "REVIEW",
      keywords: input.comment.toLowerCase().match(/\b[a-z]{3,}\b/g) || [],
      createdAt: new Date(),
    })
  // The caller commits Oracle. An Oracle commit failure is compensated in the API.
  return { feedbackId }
}
export async function listContent(collection: string, filter = {}) {
  return (await mongo())
    .collection(collection)
    .find(filter)
    .sort({ _id: -1 })
    .limit(100)
    .toArray() as unknown as ContentItem[]
}
