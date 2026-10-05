"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import {
  IconChevronsRight,
  IconArrowUpRight,
  IconMenu2,
  IconX,
  IconLogout,
  IconLayoutDashboard,
  IconBus,
  IconSteeringWheel,
  IconUsers,
  IconRoute,
  IconCalendar,
  IconTicket,
  IconCreditCard,
  IconTool,
  IconMessage,
  IconPhoto,
  IconChartBar,
  IconBell,
  IconUser,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { api, useData } from "@/lib/client"
import { Notice, LinkButton } from "./common"
import type { Session, Role } from "@/lib/types"

export function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="brand"
      aria-label="SmartMove home"
    >
      <span>
        <IconChevronsRight size={30} stroke={3} />
      </span>
      SmartMove<span className="brand-dot">.</span>
    </Link>
  )
}
function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const active =
    pathname === href ||
    (href !== "/" && href !== "/admin" && pathname.startsWith(href + "/"))
  return (
    <Link
      href={href}
      className={active ? "active" : ""}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  )
}
export function Header() {
  const { data } = useData<{ session: Session | null }>("/api/session")
  return (
    <header className="public-header">
      <div className="header-inner">
        <Brand />
        <nav aria-label="Passenger navigation">
          <NavLink href="/">Find a trip</NavLink>
          <NavLink href="/account/bookings">My bookings</NavLink>
          <NavLink href="/updates">Travel updates</NavLink>
        </nav>
        <Link
          className="header-account"
          href={data?.session ? "/account/profile" : "/login"}
        >
          <IconUser size={20} />
          <span>{data?.session?.name.split(" ")[0] || "Sign in"}</span>
        </Link>
      </div>
    </header>
  )
}
export function Footer() {
  return (
    <footer className="public-footer">
      <Brand />
      <p>Your journey starts with a good plan.</p>
      <div>
        <Link href="/updates">Travel updates</Link>
        <Link href="/admin/login">
          Admin portal <IconArrowUpRight size={16} />
        </Link>
      </div>
      <span>SmartMove Transport Solutions</span>
    </footer>
  )
}
const adminLinks = [
  ["/admin", "Overview", IconLayoutDashboard],
  ["/admin/trips", "Trips", IconCalendar],
  ["/admin/vehicles", "Fleet", IconBus],
  ["/admin/drivers", "Drivers", IconSteeringWheel],
  ["/admin/routes", "Routes", IconRoute],
  ["/admin/passengers", "Passengers", IconUsers],
  ["/admin/bookings", "Bookings", IconTicket],
  ["/admin/payments", "Payments", IconCreditCard],
  ["/admin/maintenance", "Maintenance", IconTool],
  ["/admin/feedback", "Feedback", IconMessage],
  ["/admin/content", "Content", IconPhoto],
  ["/admin/reports", "Reports", IconChartBar],
] as const
export function Logout({ role }: { role: Role }) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  async function logout() {
    setBusy(true)
    try {
      await api("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ role }),
      })
      router.push(role === "ADMIN" ? "/admin/login" : "/login")
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div>
      {error && <Notice>{error}</Notice>}
      <Button variant="ghost" onClick={logout} disabled={busy}>
        <IconLogout />
        Sign out
      </Button>
    </div>
  )
}
export function AdminShell({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="admin-app">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`admin-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand admin />
          <Button
            variant="ghost"
            size="icon"
            className="mobile-only"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <IconX />
          </Button>
        </div>
        <p className="sidebar-caption">OPERATIONS</p>
        <nav aria-label="Admin navigation" onClick={() => setOpen(false)}>
          {adminLinks.map(([href, label, Icon]) => (
            <NavLink key={href} href={href}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">
            Passenger website <IconArrowUpRight size={16} />
          </Link>
          <div className="sidebar-profile">
            <span className="avatar">AD</span>
            <div>
              <strong>Administrator</strong>
              <span>{session.email}</span>
            </div>
          </div>
          <Logout role="ADMIN" />
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-only"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <IconMenu2 />
            </Button>
            <span>Operations workspace</span>
          </div>
          <span className="admin-label">
            Admin access <span className="avatar">AD</span>
          </span>
        </header>
        <main id="main-content" className="admin-content">
          {children}
        </main>
      </div>
    </div>
  )
}
export function AccountShell({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <div className="account-nav wrap">
        <div>
          <span className="eyebrow">PASSENGER ACCOUNT</span>
          <strong>Hello, {session.name.split(" ")[0]}.</strong>
        </div>
        <nav aria-label="Account navigation">
          <NavLink href="/account/bookings">
            <IconTicket size={18} />
            My bookings
          </NavLink>
          <NavLink href="/account/notifications">
            <IconBell size={18} />
            Notifications
          </NavLink>
          <NavLink href="/account/feedback">
            <IconMessage size={18} />
            Feedback
          </NavLink>
          <NavLink href="/account/profile">
            <IconUser size={18} />
            Profile
          </NavLink>
        </nav>
        <Logout role="PASSENGER" />
      </div>
      <main id="main-content" className="wrap account-main">
        {children}
      </main>
      <Footer />
    </>
  )
}
export function BackToTrips() {
  return (
    <LinkButton href="/" variant="outline">
      Find a trip
    </LinkButton>
  )
}
