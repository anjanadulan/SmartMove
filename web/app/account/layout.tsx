import { protectPage } from "@/lib/server/page-access"
import { AccountShell } from "@/components/shell"
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await protectPage("PASSENGER")
  return <AccountShell session={session}>{children}</AccountShell>
}
