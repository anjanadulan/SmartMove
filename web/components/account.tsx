"use client"
import { useState } from "react"
import {
  IconArrowRight,
  IconTicket,
  IconPrinter,
  IconCreditCard,
  IconMessage,
  IconBell,
  IconCheck,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SmartSelect } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { api, useData, useNow, money, clock, day } from "@/lib/client"
import {
  Intro,
  Loading,
  ErrorState,
  Empty,
  Status,
  LinkButton,
  Notice,
} from "./common"
import { Brand } from "./shell"
import type { Booking, Session, Row, ContentItem } from "@/lib/types"
type BookingAction = "ticket" | "payment" | "cancel" | "feedback"
export function BookingsClient() {
  const now = useNow()
  const resource = useData<{ rows: Booking[] }>("/api/account/bookings", 30000),
    auth = useData<{ session: Session | null; demoPayments: boolean }>(
      "/api/session"
    )
  const [filter, setFilter] = useState("all"),
    [modal, setModal] = useState<{
      booking: Booking
      action: BookingAction
    } | null>(null),
    [message, setMessage] = useState("")
  const list = (resource.data?.rows || []).filter(
    (b) =>
      filter === "all" ||
      (filter === "upcoming" &&
        b.status !== "CANCELLED" &&
        new Date(b.departure_at).getTime() > now) ||
      (filter === "past" &&
        (b.status === "CANCELLED" || new Date(b.departure_at).getTime() <= now))
  )
  return (
    <>
      <Intro
        eyebrow="YOUR JOURNEYS"
        title="All your plans, in one place."
        description="Reservations, tickets, and travel history."
        action={
          <LinkButton href="/">
            Find a trip <IconArrowRight />
          </LinkButton>
        }
      />
      <div className="tab-row" role="group" aria-label="Filter bookings">
        {["all", "upcoming", "past"].map((value) => (
          <Button
            variant={filter === value ? "secondary" : "ghost"}
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === "all"
              ? "All journeys"
              : value === "upcoming"
                ? "Upcoming"
                : "Past & cancelled"}
          </Button>
        ))}
      </div>
      {message && <Notice success>{message}</Notice>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : list.length ? (
        <div className="bookings-list">
          {list.map((b) => {
            const expired =
                b.status === "PENDING" &&
                now >= new Date(b.booked_at).getTime() + 30 * 60000,
              departed = new Date(b.departure_at).getTime() <= now
            return (
              <article className="booking-card" key={b.booking_id}>
                <div className="booking-card-main">
                  <div className="booking-card-title">
                    <span className="bus-icon">
                      <IconTicket size={26} />
                    </span>
                    <div>
                      <p className="eyebrow">SM-{b.booking_id}</p>
                      <h2>
                        {b.origin} <IconArrowRight size={22} /> {b.destination}
                      </h2>
                    </div>
                    <Status value={expired ? "EXPIRED" : b.status} />
                  </div>
                  <div className="booking-facts">
                    <div>
                      <span>Departure</span>
                      <strong>
                        {day(b.departure_at)} · {clock(b.departure_at)}
                      </strong>
                    </div>
                    <div>
                      <span>Seats</span>
                      <strong>{b.seats || "—"}</strong>
                    </div>
                    <div>
                      <span>Total fare</span>
                      <strong>{money(b.total)}</strong>
                    </div>
                    <div>
                      <span>Vehicle</span>
                      <strong>{b.registration_number}</strong>
                    </div>
                  </div>
                  {b.refunded > 0 && (
                    <p className="refund-note">
                      <IconCheck size={16} />
                      Refund recorded: {money(b.refunded)}
                    </p>
                  )}
                  {b.status === "PENDING" && !expired && (
                    <p className="field-help">
                      Seat hold ends at{" "}
                      {clock(
                        new Date(
                          new Date(b.booked_at).getTime() + 30 * 60000
                        ).toISOString()
                      )}
                      . Arrange payment before it expires.
                    </p>
                  )}
                </div>
                <div className="booking-card-actions">
                  {b.status === "CONFIRMED" && (
                    <Button
                      onClick={() => setModal({ booking: b, action: "ticket" })}
                    >
                      <IconTicket />
                      View ticket
                    </Button>
                  )}
                  {b.status === "PENDING" && !expired && !departed && (
                    <Button
                      onClick={() =>
                        setModal({ booking: b, action: "payment" })
                      }
                    >
                      <IconCreditCard />
                      {auth.data?.demoPayments
                        ? "Demo checkout"
                        : "Payment details"}
                    </Button>
                  )}
                  {b.status !== "CANCELLED" && !departed && !expired && (
                    <Button
                      variant="outline"
                      onClick={() => setModal({ booking: b, action: "cancel" })}
                    >
                      Cancel booking
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setModal({ booking: b, action: "feedback" })}
                  >
                    <IconMessage />
                    Feedback
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <Empty
          title="Your next adventure is waiting"
          description="Bookings matching this filter will appear here."
        >
          <LinkButton href="/">
            Explore departures <IconArrowRight />
          </LinkButton>
        </Empty>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(open: boolean) => {
          if (!open) setModal(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {modal?.action === "ticket"
                ? "Your digital ticket"
                : modal?.action === "payment"
                  ? "Payment details"
                  : modal?.action === "cancel"
                    ? "Cancel this journey?"
                    : "Share your experience"}
            </DialogTitle>
            <DialogDescription>
              {modal
                ? `Booking SM-${modal.booking.booking_id} · ${modal.booking.origin} to ${modal.booking.destination}`
                : "Booking details"}
            </DialogDescription>
          </DialogHeader>
          {modal && (
            <BookingModal
              key={`${modal.booking.booking_id}:${modal.action}`}
              {...modal}
              name={auth.data?.session?.name || "Passenger"}
              demo={!!auth.data?.demoPayments}
              onDone={(text) => {
                setMessage(text)
                setModal(null)
                resource.reload()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
function BookingModal({
  booking: b,
  action,
  name,
  demo,
  onDone,
}: {
  booking: Booking
  action: BookingAction
  name: string
  demo: boolean
  onDone: (text: string) => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [type, setType] = useState("COMPLAINT")
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const values = Object.fromEntries(new FormData(e.currentTarget))
    try {
      if (action === "cancel") {
        await api(`/api/account/bookings/${b.booking_id}/cancel`, {
          method: "POST",
          body: "{}",
        })
        onDone(
          "Booking cancelled. Any paid fare has been recorded as a refund."
        )
      }
      if (action === "payment") {
        await api(`/api/account/bookings/${b.booking_id}/payment`, {
          method: "POST",
          body: JSON.stringify(values),
        })
        onDone(
          "Demo payment recorded. No money was charged. Your ticket is ready."
        )
      }
      if (action === "feedback") {
        await api("/api/account/feedback", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            bookingId: b.booking_id,
            vehicleRating: Number(values.vehicleRating || 3),
            driverRating: Number(values.driverRating || 3),
          }),
        })
        onDone("Thanks. Your feedback has been received.")
      }
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  if (action === "ticket")
    return (
      <>
        <div className="ticket-document">
          <Brand />
          <p className="eyebrow">PASSENGER TICKET · SM-{b.booking_id}</p>
          <h2>
            {b.origin} → {b.destination}
          </h2>
          <div className="ticket-route">
            <div>
              <strong>{clock(b.departure_at)}</strong>
              <span>{b.origin}</span>
            </div>
            <IconArrowRight />
            <div>
              <strong>{clock(b.arrival_at)}</strong>
              <span>{b.destination}</span>
            </div>
          </div>
          <div className="ticket-facts">
            <div>
              <span>Passenger</span>
              <strong>{name}</strong>
            </div>
            <div>
              <span>Travel date</span>
              <strong>{day(b.departure_at)}</strong>
            </div>
            <div>
              <span>Seats</span>
              <strong>{b.seats}</strong>
            </div>
            <div>
              <span>Paid fare</span>
              <strong>{money(b.paid)}</strong>
            </div>
            <div>
              <span>Vehicle</span>
              <strong>{b.registration_number}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>Issued</strong>
            </div>
          </div>
          <p>
            Arrive 15 minutes before departure. Show this ticket when boarding.
          </p>
        </div>
        <Button className="no-print" onClick={() => window.print()}>
          <IconPrinter />
          Print / save PDF
        </Button>
      </>
    )
  if (action === "payment" && !demo)
    return (
      <div className="payment-info">
        <IconCreditCard size={40} />
        <h3>Total due: {money(b.total)}</h3>
        <p>
          Contact SmartMove operations with booking reference{" "}
          <strong>SM-{b.booking_id}</strong>. An administrator will record your
          received payment and issue your ticket.
        </p>
        <Notice>
          This seat hold lasts 30 minutes from reservation. The website does not
          collect card details or charge your account.
        </Notice>
      </div>
    )
  return (
    <form onSubmit={submit} className="modal-form">
      {action === "cancel" && (
        <>
          <p>
            Your seats will be released. If you have paid, the database will
            record a full refund.
          </p>
          <Notice>
            A refund record does not send money through a bank. Contact
            operations for settlement.
          </Notice>
        </>
      )}
      {action === "payment" && (
        <>
          <Notice>
            Demo payment simulation. No money is charged and no bank card
            details are collected.
          </Notice>
          <div className="payment-total">
            <span>Total</span>
            <strong>{money(b.total)}</strong>
          </div>
          <div className="field">
            <Label htmlFor="payment-method">Simulated payment method</Label>
            <SmartSelect
              id="payment-method"
              name="method"
              defaultValue="CARD"
              options={[
                { value: "CARD", label: "Card (simulation)" },
                { value: "CASH", label: "Cash (simulation)" },
                { value: "BANK_TRANSFER", label: "Bank transfer (simulation)" },
              ]}
            />
          </div>
        </>
      )}
      {action === "feedback" && (
        <>
          <div className="field">
            <Label htmlFor="feedback-type">Feedback type</Label>
            <SmartSelect
              id="feedback-type"
              name="type"
              value={type}
              onChange={setType}
              options={[
                { value: "COMPLAINT", label: "Complaint / support request" },
                ...(b.status === "CONFIRMED" && b.trip_status === "COMPLETED"
                  ? [{ value: "REVIEW", label: "Review of a completed journey" }]
                  : []),
              ]}
            />
          </div>
          {type === "REVIEW" && (
            <div className="form-grid">
              {["vehicle", "driver"].map((label) => (
                <div className="field" key={label}>
                  <Label htmlFor={`${label}-rating`}>
                    {label === "vehicle" ? "Vehicle rating" : "Driver rating"}
                  </Label>
                  <SmartSelect
                    id={`${label}-rating`}
                    name={`${label}Rating`}
                    defaultValue="5"
                    options={[5, 4, 3, 2, 1].map((n) => ({
                      value: String(n),
                      label: `${n} / 5`,
                    }))}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="field">
            <Label htmlFor="comment">Your message</Label>
            <Textarea
              id="comment"
              name="comment"
              required
              minLength={5}
              maxLength={2000}
              placeholder="Tell us about your journey…"
              rows={5}
            />
          </div>
        </>
      )}
      {error && <Notice>{error}</Notice>}
      <Button
        type="submit"
        variant={action === "cancel" ? "destructive" : "default"}
        disabled={busy}
      >
        {busy
          ? "Saving…"
          : action === "cancel"
            ? "Confirm cancellation"
            : action === "payment"
              ? "Record demo payment"
              : "Send feedback"}
      </Button>
    </form>
  )
}
export function ProfileClient() {
  const resource = useData<{ profile: Row; session: Session }>(
    "/api/account/profile"
  )
  return (
    <>
      <Intro
        eyebrow="YOUR ACCOUNT"
        title="The details that keep you moving."
        description="Keep your name and contact number up to date."
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        resource.data && (
          <ProfileForm
            profile={resource.data.profile}
            session={resource.data.session}
          />
        )
      )}
    </>
  )
}
function ProfileForm({ profile, session }: { profile: Row; session: Session }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("")
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage("")
    setError("")
    try {
      await api("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      })
      setMessage("Profile updated.")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="field">
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={String(profile.full_name)}
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div className="field">
        <Label htmlFor="profile-phone">Phone number</Label>
        <Input
          id="profile-phone"
          name="phone"
          type="tel"
          defaultValue={String(profile.phone)}
          required
          minLength={7}
          maxLength={15}
        />
      </div>
      <div className="field">
        <Label htmlFor="profile-email">Email address</Label>
        <Input id="profile-email" type="email" value={session.email} readOnly />
        <p className="field-help">
          Your sign-in email is fixed for this account.
        </p>
      </div>
      {message && <Notice success>{message}</Notice>}
      {error && <Notice>{error}</Notice>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
export function NotificationsClient() {
  const resource = useData<{ items: ContentItem[] }>(
      "/api/account/notifications",
      30000
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null)
  async function mark(id: string) {
    setBusy(id)
    setError("")
    try {
      await api(`/api/account/notifications/${id}`, {
        method: "PUT",
        body: "{}",
      })
      resource.reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <Intro
        eyebrow="YOUR INBOX"
        title="Stay in the loop."
        description="Notifications linked to your passenger account."
      />
      {error && <Notice>{error}</Notice>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.items.length ? (
        <div className="notification-list">
          {resource.data.items.map((item) => (
            <article key={item._id}>
              <IconBell />
              <div>
                <p>{item.message}</p>
                {item.createdAt && <span>{day(item.createdAt)}</span>}
              </div>
              {item.isRead ? (
                <span className="muted">Read</span>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy === item._id}
                  onClick={() => mark(item._id)}
                >
                  <IconCheck />
                  Mark read
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="All quiet for now"
          description="Your notifications will appear here."
        />
      )}
    </>
  )
}
