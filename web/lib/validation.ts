import { z } from "zod"
export const id = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
export const email = z.string().trim().toLowerCase().email().max(100)
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,15}$/, "Enter a valid phone number")
export const password = z.string().min(8, "Use at least 8 characters").max(128)
export const loginInput = z.object({
  email,
  password: z.string().min(1).max(128),
  role: z.enum(["PASSENGER", "ADMIN"]),
})
export const signupInput = z.object({
  email,
  password,
  name: z.string().trim().min(2).max(100),
  phone,
})
export const bookingInput = z.object({
  tripId: id,
  seats: z
    .array(z.number().int().min(1).max(999))
    .min(1)
    .max(6)
    .refine((v) => new Set(v).size === v.length, "Choose unique seats"),
})
export const profileInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone,
})
export const feedbackInput = z.object({
  bookingId: id,
  type: z.enum(["REVIEW", "COMPLAINT"]),
  comment: z.string().trim().min(5).max(2000),
  vehicleRating: z.number().int().min(1).max(5),
  driverRating: z.number().int().min(1).max(5),
})
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }, "Choose a valid date")
export const dateTimeInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time")
  .refine((v) => !isNaN(new Date(`${v}:00+05:30`).getTime()))
export function safeMediaUrl(value: string) {
  if (
    value.startsWith("/uploads/") &&
    !value.includes("..") &&
    !value.includes("\\")
  )
    return true
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}
