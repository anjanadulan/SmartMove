import { AuthForm } from "@/components/auth-form"
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const p = await searchParams
  return <AuthForm signup next={p.next} />
}
