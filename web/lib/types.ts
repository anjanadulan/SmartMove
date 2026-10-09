export type Row = Record<string, string | number | null>
export type Role = "PASSENGER" | "ADMIN"
export type Session = {
  userId: number
  passengerId: number | null
  email: string
  name: string
  role: Role
}
export type Trip = Row & {
  trip_id: number
  route_id: number
  vehicle_id: number
  driver_id: number
  origin: string
  destination: string
  route_name: string
  departure_at: string
  arrival_at: string
  fare: number
  seat_count: number
  available_seats: number
  vehicle_type: string
  registration_number: string
  status: string
}
export type Booking = Row & {
  booking_id: number
  origin: string
  destination: string
  departure_at: string
  arrival_at: string
  booked_at: string
  status: string
  trip_status: string
  total: number
  paid: number
  refunded: number
  seats: string
  trip_id: number
}
export type ContentItem = {
  _id: string
  title?: string
  body?: string
  comment?: string
  audience?: string
  routeId?: string
  vehicleId?: string
  driverId?: string
  tripId?: string
  userId?: string
  feedbackId?: string
  vehicleRating?: number
  driverRating?: number
  fileUrl?: string
  assetType?: string
  mediaType?: string
  caption?: string
  message?: string
  isRead?: boolean
  createdAt?: string
  reply?: { staffName: string; message: string }
}
