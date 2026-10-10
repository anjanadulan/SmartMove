import { protectPage } from "@/lib/server/page-access"
import { AdminShell } from "@/components/shell"
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await protectPage("ADMIN")
  return <AdminShell session={session}>{children}</AdminShell>
}
