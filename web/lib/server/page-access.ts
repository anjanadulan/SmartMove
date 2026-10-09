import "server-only"
import { redirect } from "next/navigation"
import { findSession } from "./security"
import type { Role, Session } from "@/lib/types"
export async function protectPage(role: Role) {
  let session: Session | null = null
  try {
    session = await findSession(role)
  } catch {
    redirect(
      role === "ADMIN" ? "/admin/login?unavailable=1" : "/login?unavailable=1"
    )
  }
  if (!session) redirect(role === "ADMIN" ? "/admin/login" : "/login")
  return session
}
