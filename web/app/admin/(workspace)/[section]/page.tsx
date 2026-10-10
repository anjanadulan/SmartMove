import { notFound } from "next/navigation"
import { entities } from "@/lib/admin-config"
import {
  ManagementClient,
  ReportsClient,
  ContentClient,
} from "@/components/admin-workspace"
export default async function Management({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (section === "reports") return <ReportsClient />
  if (section === "content") return <ContentClient />
  if (!Object.hasOwn(entities, section)) notFound()
  return <ManagementClient entity={section} />
}
