import { AuthForm } from "@/components/auth-form"
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const p = await searchParams
  return <AuthForm next={p.next} unavailable={p.unavailable === "1"} />
}
