export type Field = {
  key: string
  label: string
  type?:
    | "text"
    | "number"
    | "date"
    | "datetime-local"
    | "select"
    | "textarea"
    | "town"
  options?: string[]
  reference?: string
  createOnly?: boolean
  editOnly?: boolean
  optional?: boolean
  min?: number
  max?: number
}
export type EntityConfig = {
  title: string
  singular: string
  description: string
  id: string
  columns: [string, string][]
  fields: Field[]
  create?: boolean
  edit?: boolean
  remove?: boolean
}
export const entities: Record<string, EntityConfig> = {
  vehicles: {
    title: "Fleet",
    singular: "vehicle",
    description: "Vehicle capacity, registrations, and service availability.",
    id: "vehicle_id",
    columns: [
      ["registration_number", "Registration"],
      ["vehicle_type", "Type"],
      ["seat_count", "Seats"],
      ["status", "Status"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      { key: "registration", label: "Registration number" },
      {
        key: "type",
        label: "Vehicle type",
        type: "select",
        options: ["BUS", "VAN", "CAR"],
      },
      {
        key: "seats",
        label: "Seat capacity",
        type: "number",
        min: 1,
        max: 999,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["ACTIVE", "MAINTENANCE"],
        editOnly: true,
      },
    ],
  },
  drivers: {
    title: "Drivers",
    singular: "driver",
    description: "Manage driver profiles and licence details.",
    id: "driver_id",
    columns: [
      ["full_name", "Driver"],
      ["phone", "Phone"],
      ["licence_number", "Licence"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      { key: "name", label: "Full name" },
      { key: "phone", label: "Phone number", optional: true },
      { key: "licence", label: "Licence number" },
    ],
  },
  routes: {
    title: "Routes",
    singular: "route",
    description: "Connect destinations and maintain base fares.",
    id: "route_id",
    columns: [
      ["route_name", "Route"],
      ["origin", "From"],
      ["destination", "To"],
      ["base_fare", "Base fare"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      { key: "origin", label: "Origin", type: "town", createOnly: true },
      { key: "destination", label: "Destination", type: "town", createOnly: true },
      { key: "name", label: "Route name" },
      { key: "fare", label: "Base fare (LKR)", type: "number", min: 0.01 },
    ],
  },
  trips: {
    title: "Trips",
    singular: "trip",
    description:
      "Assign routes, vehicles, and drivers. All times are Sri Lanka time.",
    id: "trip_id",
    columns: [
      ["route_name", "Route"],
      ["registration_number", "Vehicle"],
      ["driver_name", "Driver"],
      ["departure_at", "Departure"],
      ["fare", "Fare"],
      ["status", "Status"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      {
        key: "routeId",
        label: "Route",
        type: "select",
        reference: "routes",
        createOnly: true,
      },
      {
        key: "vehicleId",
        label: "Vehicle",
        type: "select",
        reference: "vehicles",
      },
      {
        key: "driverId",
        label: "Driver",
        type: "select",
        reference: "drivers",
      },
      { key: "departure", label: "Departure", type: "datetime-local" },
      { key: "arrival", label: "Arrival", type: "datetime-local" },
    ],
  },
  passengers: {
    title: "Passengers",
    singular: "passenger",
    description:
      "Passenger registrations and contact information. New passengers register through the passenger portal.",
    id: "passenger_id",
    columns: [
      ["full_name", "Name"],
      ["email", "Email"],
      ["phone", "Phone"],
    ],
    edit: true,
    fields: [
      { key: "name", label: "Full name" },
      { key: "phone", label: "Phone number" },
    ],
  },
  bookings: {
    title: "Bookings",
    singular: "booking",
    description: "Reservations, ticket issue status, and passenger journeys.",
    id: "booking_id",
    columns: [
      ["booking_id", "Reference"],
      ["full_name", "Passenger"],
      ["route_name", "Route"],
      ["departure_at", "Departure"],
      ["seats", "Seats"],
      ["total", "Total"],
      ["status", "Status"],
    ],
    fields: [],
  },
  payments: {
    title: "Payments",
    singular: "payment",
    description:
      "Record received payments and refunds. This application does not charge bank cards.",
    id: "payment_id",
    columns: [
      ["booking_id", "Booking"],
      ["full_name", "Passenger"],
      ["amount", "Paid"],
      ["payment_method", "Method"],
      ["paid_at", "Received"],
      ["refunded", "Refunded"],
    ],
    create: true,
    fields: [
      {
        key: "bookingId",
        label: "Pending booking",
        type: "select",
        reference: "pendingBookings",
      },
      {
        key: "method",
        label: "Payment received by",
        type: "select",
        options: ["CASH", "CARD", "BANK_TRANSFER"],
      },
    ],
  },
  maintenance: {
    title: "Maintenance",
    singular: "service",
    description: "Schedule inspections and keep completed service records.",
    id: "maintenance_id",
    columns: [
      ["registration_number", "Vehicle"],
      ["maintenance_type", "Service"],
      ["scheduled_date", "Scheduled"],
      ["cost", "Cost"],
      ["status", "Status"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      {
        key: "vehicleId",
        label: "Vehicle",
        type: "select",
        reference: "vehicles",
        createOnly: true,
      },
      { key: "type", label: "Service description" },
      { key: "date", label: "Scheduled day", type: "date" },
    ],
  },
  feedback: {
    title: "Feedback",
    singular: "feedback",
    description:
      "Review passenger comments, respond to complaints, and resolve cases.",
    id: "feedback_id",
    columns: [
      ["feedback_id", "Reference"],
      ["full_name", "Passenger"],
      ["route_name", "Route"],
      ["feedback_type", "Type"],
      ["comment", "Comment"],
      ["status", "Status"],
    ],
    fields: [],
  },
}
export const fieldAliases: Record<string, string> = {
  registration: "registration_number",
  name: "full_name",
  type: "vehicle_type",
  seats: "seat_count",
  licence: "licence_number",
  fare: "base_fare",
  routeId: "route_id",
  vehicleId: "vehicle_id",
  driverId: "driver_id",
  departure: "departure_at",
  arrival: "arrival_at",
  date: "scheduled_date",
}
