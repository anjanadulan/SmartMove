import { TripClient } from "@/components/passenger"
import { notFound } from "next/navigation"
export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d{1,16}$/.test(id)) notFound()
  return <TripClient tripId={id} />
}
