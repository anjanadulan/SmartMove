"use client"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowRight,
  IconShieldLock,
  IconTicket,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Brand } from "./shell"
import { Notice } from "./common"
import { api } from "@/lib/client"
export function AuthForm({
  admin = false,
  signup = false,
  next = "",
  unavailable = false,
}: {
  admin?: boolean
  signup?: boolean
  next?: string
  unavailable?: boolean
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    router = useRouter()
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const values = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await api(`/api/auth/${signup ? "signup" : "login"}`, {
        method: "POST",
        body: JSON.stringify(
          signup ? values : { ...values, role: admin ? "ADMIN" : "PASSENGER" }
        ),
      })
      const target =
        /^\/trips\/\d+$/.test(next) ||
        /^\/account\/(bookings|profile|notifications)$/.test(next)
          ? next
          : "/account/bookings"
      router.push(admin ? "/admin" : target)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <main
      id="main-content"
      className={`auth-page ${admin ? "admin-auth" : ""}`}
    >
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">
            {admin ? "SMARTMOVE OPERATIONS" : "YOUR JOURNEY STARTS HERE"}
          </p>
          <h1>
            {admin ? (
              <>
                Every journey.
                <br />
                One workspace.
              </>
            ) : (
              <>
                Good journeys.
                <br />
                Great beginnings.
              </>
            )}
          </h1>
          <p>
            {admin
              ? "Plan departures, keep your fleet moving, and look after your passengers."
              : "Your next ride is just a few steps away. Find a departure, choose a seat, and get going."}
          </p>
          <div className="auth-story-icon">
            {admin ? (
              <IconShieldLock size={88} stroke={1} />
            ) : (
              <IconTicket size={88} stroke={1} />
            )}
          </div>
        </div>
        <Link href="/">← Back to SmartMove</Link>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-card">
          <span className="auth-icon">
            {admin ? <IconShieldLock size={28} /> : <IconTicket size={28} />}
          </span>
          <p className="eyebrow">
            {admin ? "ADMIN PORTAL" : "PASSENGER PORTAL"}
          </p>
          <h2>{signup ? "Let’s get you on board." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Create your account to reserve seats and manage journeys."
              : admin
                ? "Sign in with your administrator account."
                : "Sign in to your passenger account."}
          </p>
          {unavailable && (
            <Notice>
              The database service is temporarily unavailable. Try signing in
              again shortly.
            </Notice>
          )}
          <form onSubmit={submit}>
            {signup && (
              <div className="field">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
            )}
            <div className="field">
              <Label htmlFor="email">Email address</Label>
              <Input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={100}
              />
            </div>
            {signup && (
              <div className="field">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  type="tel"
                  id="phone"
                  name="phone"
                  autoComplete="tel"
                  placeholder="07X XXX XXXX"
                  required
                  minLength={7}
                  maxLength={15}
                />
              </div>
            )}
            <div className="field">
              <Label htmlFor="password">Password</Label>
              <div className="password-field">
                <Input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={signup ? 8 : 1}
                  maxLength={128}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <IconEyeOff /> : <IconEye />}
                </Button>
              </div>
              {signup && (
                <p className="field-help">Use at least 8 characters.</p>
              )}
            </div>
            {error && <Notice>{error}</Notice>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
              <IconArrowRight />
            </Button>
          </form>
          {!admin && (
            <p className="auth-switch">
              {signup ? "Already have an account?" : "New to SmartMove?"}{" "}
              <Link
                href={
                  signup
                    ? `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`
                    : `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`
                }
              >
                {signup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          )}
          <div className="portal-switch">
            <span>
              {admin ? "Travelling with us?" : "Managing operations?"}
            </span>
            <Link href={admin ? "/login" : "/admin/login"}>
              {admin ? "Passenger sign in" : "Admin sign in"}{" "}
              <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
