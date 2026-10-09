import { HomeClient } from "@/components/passenger"
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <HomeClient
      initialOrigin={typeof params.origin === "string" ? params.origin : ""}
      initialDestination={
        typeof params.destination === "string" ? params.destination : ""
      }
    />
  )
}
