"use client"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowRight,
  IconArrowsExchange,
  IconMapPin,
  IconBus,
  IconTicket,
  IconShieldCheck,
  IconClock,
  IconCheck,
  IconArmchair,
  IconStar,
  IconPhoto,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { api, useData, useNow, money, clock, day, today } from "@/lib/client"
import {
  Empty,
  ErrorState,
  Loading,
  Intro,
  Notice,
  LinkButton,
  Status,
} from "./common"
import { Header, Footer } from "./shell"
import { TownAutocomplete } from "./town-autocomplete"
import { SmartSelect } from "@/components/ui/select"
import type { Trip, Row, Session, ContentItem } from "@/lib/types"
import { safeMediaUrl } from "@/lib/validation"

export function HomeClient({
  initialOrigin = "",
  initialDestination = "",
}: {
  initialOrigin?: string
  initialDestination?: string
}) {
  const [origin, setOrigin] = useState(initialOrigin),
    [destination, setDestination] = useState(initialDestination),
    [date, setDate] = useState("")
  const [search, setSearch] = useState({
      origin: initialOrigin,
      destination: initialDestination,
      date: "",
    }),
    [availableOnly, setAvailableOnly] = useState(false),
    [sort, setSort] = useState("departure"),
    [formError, setFormError] = useState("")
  const routes = useData<{ rows: Row[] }>("/api/public/routes")
  const trips = useData<{ rows: Trip[] }>(
    `/api/public/trips?${new URLSearchParams(search)}`,
    30000
  )
  const cities = Array.from(
    new Set(
      (routes.data?.rows || []).flatMap((r) => [
        String(r.origin),
        String(r.destination),
      ])
    )
  ).sort()
  const departures = (trips.data?.rows || [])
    .filter((t) => !availableOnly || t.available_seats > 0)
    .slice()
    .sort((a, b) =>
      sort === "fare"
        ? a.fare - b.fare
        : new Date(a.departure_at).getTime() -
          new Date(b.departure_at).getTime()
    )
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (
      origin &&
      destination &&
      origin.toLowerCase() === destination.toLowerCase()
    ) {
      setFormError("Choose a different destination.")
      return
    }
    setFormError("")
    setSearch({ origin, destination, date })
  }
  return (
    <>
      <Header />
      <main id="main-content">
        <section className="hero">
          <div className="wrap hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">SRI LANKA, ONE JOURNEY AT A TIME</p>
              <h1>
                A better way
                <br />
                to get there<span>.</span>
              </h1>
              <p>
                Find your next ride. Reserve your seat.
                <br />
                Travel with confidence.
              </p>
            </div>
            <div className="hero-image">
              <Image
                src="/images/journey.png"
                alt="A SmartMove coach winding through the green hills of Sri Lanka"
                width={1536}
                height={1024}
                priority
              />
            </div>
          </div>
        </section>
        <div className="wrap">
          <form className="trip-search" onSubmit={submit}>
            <div>
              <Label htmlFor="origin">From</Label>
              <TownAutocomplete
                id="origin"
                value={origin}
                onChange={setOrigin}
                placeholder="Any departure city"
                extraTowns={cities}
                ariaLabel="Departure city"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="swap-button"
              aria-label="Swap departure and destination"
              onClick={() => {
                setOrigin(destination)
                setDestination(origin)
              }}
            >
              <IconArrowsExchange />
            </Button>
            <div>
              <Label htmlFor="destination">To</Label>
              <TownAutocomplete
                id="destination"
                value={destination}
                onChange={setDestination}
                placeholder="Where are you going?"
                extraTowns={cities}
                ariaLabel="Destination city"
              />
            </div>
            <div>
              <Label htmlFor="departure">Departure</Label>
              <Input
                id="departure"
                type="date"
                min={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button type="submit" className="search-button">
              Search trips <IconArrowRight />
            </Button>
          </form>
          {formError && <Notice>{formError}</Notice>}
          <section className="departures">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AVAILABLE DEPARTURES</p>
                <h2>
                  {search.origin && search.destination ? (
                    <>
                      {search.origin} <span className="muted">→</span>{" "}
                      {search.destination}
                    </>
                  ) : (
                    "Where will you go next?"
                  )}
                </h2>
                <p className="muted">
                  {search.date
                    ? day(search.date + "T00:00:00+05:30")
                    : "Upcoming journeys"}{" "}
                  · Availability refreshes every 30 seconds
                </p>
              </div>
              <div className="filter-controls">
                <Button
                  variant={availableOnly ? "secondary" : "outline"}
                  onClick={() => setAvailableOnly((v) => !v)}
                  aria-pressed={availableOnly}
                >
                  Seats available
                </Button>
                <SmartSelect
                  size="sm"
                  ariaLabel="Sort departures"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "departure", label: "Earliest first" },
                    { value: "fare", label: "Lowest fare" },
                  ]}
                />
              </div>
            </div>
            {trips.loading ? (
              <Loading />
            ) : trips.error ? (
              <ErrorState message={trips.error} retry={trips.reload} />
            ) : departures.length ? (
              <div className="departures-list">
                <div className="departure-labels">
                  <span>Journey</span>
                  <span>Departure</span>
                  <span>Arrival</span>
                  <span>Availability</span>
                  <span>Per seat</span>
                  <span />
                </div>
                {departures.map((trip) => (
                  <div className="departure-row" key={trip.trip_id}>
                    <div className="journey-cell">
                      <span className="bus-icon">
                        <IconBus size={24} />
                      </span>
                      <div>
                        <strong>
                          {trip.origin} → {trip.destination}
                        </strong>
                        <span>
                          {trip.vehicle_type?.toLowerCase()} ·{" "}
                          {trip.registration_number}
                        </span>
                      </div>
                    </div>
                    <div>
                      <strong>{clock(trip.departure_at)}</strong>
                      <span>{day(trip.departure_at)}</span>
                    </div>
                    <div>
                      <strong>{clock(trip.arrival_at)}</strong>
                      <span>
                        {Math.round(
                          (new Date(trip.arrival_at).getTime() -
                            new Date(trip.departure_at).getTime()) /
                            60000
                        )}{" "}
                        min journey
                      </span>
                    </div>
                    <div>
                      <Badge
                        variant="secondary"
                        className={
                          trip.available_seats > 0
                            ? "status good"
                            : "status neutral"
                        }
                      >
                        {trip.available_seats > 0
                          ? `${trip.available_seats} seats left`
                          : "Fully booked"}
                      </Badge>
                    </div>
                    <strong>{money(trip.fare)}</strong>
                    <LinkButton
                      href={`/trips/${trip.trip_id}`}
                      variant={trip.available_seats > 0 ? "default" : "outline"}
                    >
                      View trip <IconArrowRight />
                    </LinkButton>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No departures match this search"
                description="Try another day or destination, or clear the search to see all upcoming trips."
              >
                <Button
                  variant="outline"
                  onClick={() => {
                    setOrigin("")
                    setDestination("")
                    setDate("")
                    setSearch({ origin: "", destination: "", date: "" })
                    setAvailableOnly(false)
                  }}
                >
                  Show all upcoming trips
                </Button>
              </Empty>
            )}
          </section>
          <section className="travel-promises" aria-label="How booking works">
            <div>
              <IconMapPin />
              <h3>Find your route</h3>
              <p>Choose a departure that fits your day.</p>
            </div>
            <div>
              <IconArmchair />
              <h3>Choose your seat</h3>
              <p>See available seats before you reserve.</p>
            </div>
            <div>
              <IconTicket />
              <h3>Keep your ticket close</h3>
              <p>Your bookings, all in one place.</p>
            </div>
          </section>
          <div className="travel-note">
            <IconClock />
            <div>
              <strong>A little early goes a long way.</strong>
              <p>
                Plan to arrive at your pickup point 15 minutes before departure.
              </p>
            </div>
            <Link href="/updates">
              Travel updates <IconArrowRight size={18} />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
type Detail = {
  trip: Trip
  occupied: number[]
  reviews: ContentItem[]
  assets: ContentItem[]
  media: ContentItem[]
  contentAvailable: boolean
}
export function TripClient({ tripId }: { tripId: string }) {
  const now = useNow()
  const resource = useData<Detail>(`/api/public/trips/${tripId}`, 30000),
    auth = useData<{ session: Session | null }>("/api/session"),
    router = useRouter()
  const [seats, setSeats] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const t = resource.data?.trip
  const available =
    !!t && t.status === "SCHEDULED" && new Date(t.departure_at).getTime() > now
  const validSeats = seats.filter((s) => !resource.data?.occupied.includes(s))
  async function reserve() {
    if (!t) return
    setBusy(true)
    setError("")
    try {
      const result = await api<{ bookingId: number }>("/api/account/bookings", {
        method: "POST",
        body: JSON.stringify({ tripId: t.trip_id, seats: validSeats }),
      })
      router.push(`/account/bookings?booking=${result.bookingId}`)
    } catch (e) {
      setError((e as Error).message)
      resource.reload()
      setBusy(false)
    }
  }
  return (
    <>
      <Header />
      <main id="main-content" className="wrap trip-detail">
        <Link className="back-link" href="/">
          ← Back to departures
        </Link>
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : (
          t && (
            <>
              <Intro
                eyebrow="YOUR NEXT JOURNEY"
                title={`${t.origin} to ${t.destination}`}
                description={`${day(t.departure_at)} · ${t.vehicle_type?.toLowerCase()} · ${t.registration_number}`}
                action={<Status value={t.status} />}
              />
              <div className="booking-grid">
                <section className="seat-section">
                  <div className="trip-timeline">
                    <div>
                      <span>Departure</span>
                      <strong>{clock(t.departure_at)}</strong>
                      <p>{t.origin}</p>
                    </div>
                    <div className="timeline-line">
                      <IconBus />
                    </div>
                    <div>
                      <span>Arrival</span>
                      <strong>{clock(t.arrival_at)}</strong>
                      <p>{t.destination}</p>
                    </div>
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>Make yourself comfortable.</h2>
                      <p className="muted">
                        Choose up to 6 seats for this journey.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {t.available_seats} available
                    </Badge>
                  </div>
                  <div className="seat-map">
                    <div className="seat-front">
                      FRONT OF VEHICLE <IconBus size={20} />
                    </div>
                    <div
                      className="seat-grid"
                      role="group"
                      aria-label="Select seats"
                    >
                      {Array.from(
                        { length: Math.min(t.seat_count, 999) },
                        (_, i) => i + 1
                      ).map((seat) => {
                        const taken = resource.data!.occupied.includes(seat),
                          selected = validSeats.includes(seat)
                        return (
                          <button
                            type="button"
                            key={seat}
                            className={`seat ${taken ? "taken" : ""} ${selected ? "selected" : ""}`}
                            disabled={
                              taken ||
                              !available ||
                              (!selected && validSeats.length >= 6)
                            }
                            aria-label={`Seat ${seat}${taken ? ", reserved" : ""}`}
                            aria-pressed={selected}
                            onClick={() =>
                              setSeats((current) =>
                                selected
                                  ? current.filter((s) => s !== seat)
                                  : [...current, seat]
                              )
                            }
                          >
                            <IconArmchair size={23} />
                            <span>{seat}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="seat-legend">
                      <span>
                        <i />
                        Available
                      </span>
                      <span>
                        <i className="selected" />
                        Selected
                      </span>
                      <span>
                        <i className="taken" />
                        Reserved
                      </span>
                    </div>
                  </div>
                </section>
                <aside className="booking-summary">
                  <p className="eyebrow">YOUR RESERVATION</p>
                  <h2>
                    {t.origin} <IconArrowRight size={20} /> {t.destination}
                  </h2>
                  <p className="muted">
                    {day(t.departure_at)} · {clock(t.departure_at)}
                  </p>
                  <dl>
                    <div>
                      <dt>Fare per seat</dt>
                      <dd>{money(t.fare)}</dd>
                    </div>
                    <div>
                      <dt>Selected seats</dt>
                      <dd>
                        {validSeats.length
                          ? validSeats
                              .slice()
                              .sort((a, b) => a - b)
                              .join(", ")
                          : "Choose your seats"}
                      </dd>
                    </div>
                    <div className="summary-total">
                      <dt>Total</dt>
                      <dd>{money(validSeats.length * t.fare)}</dd>
                    </div>
                  </dl>
                  {error && <Notice>{error}</Notice>}
                  {!available ? (
                    <Notice>
                      This trip is no longer available for booking.
                    </Notice>
                  ) : auth.data?.session ? (
                    <Button
                      className="w-full"
                      onClick={reserve}
                      disabled={!validSeats.length || busy}
                    >
                      {busy ? "Reserving…" : "Reserve seats"}
                      <IconArrowRight />
                    </Button>
                  ) : (
                    <LinkButton
                      href={`/login?next=/trips/${tripId}`}
                      className="w-full"
                    >
                      Sign in to reserve <IconArrowRight />
                    </LinkButton>
                  )}
                  <p className="hold-note">
                    <IconShieldCheck size={18} />
                    Seats are held for 30 minutes. Complete payment with
                    operations before the hold expires.
                  </p>
                  <div className="summary-note">
                    <IconCheck size={18} />
                    Cancel before departure from My bookings.
                  </div>
                </aside>
              </div>
              <section className="route-reviews">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">FROM THE COMMUNITY</p>
                    <h2>Notes from fellow travellers.</h2>
                  </div>
                  <IconStar size={25} className="muted" />
                </div>
                {!resource.data!.contentAvailable ? (
                  <Notice>Travel reviews are temporarily unavailable.</Notice>
                ) : resource.data!.reviews.length ? (
                  <div className="reviews-grid">
                    {resource.data!.reviews.map((review) => (
                      <article className="review" key={review._id}>
                        <div className="review-rating">
                          <IconStar size={18} /> {review.vehicleRating || "—"}/5
                          vehicle · {review.driverRating || "—"}/5 driver
                        </div>
                        <p>{review.comment}</p>
                        {review.reply && (
                          <blockquote>
                            <strong>{review.reply.staffName}</strong>
                            <p>{review.reply.message}</p>
                          </blockquote>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    No reviews for this route yet. Share your experience after a
                    completed journey.
                  </p>
                )}
              </section>
              {[...resource.data!.assets, ...resource.data!.media].some(
                (x) => x.fileUrl && safeMediaUrl(x.fileUrl)
              ) && (
                <section className="route-reviews">
                  <h2>From the road.</h2>
                  <div className="media-grid">
                    {[...resource.data!.assets, ...resource.data!.media]
                      .filter((x) => x.fileUrl && safeMediaUrl(x.fileUrl))
                      .map((item) => (
                        <figure className="media-figure" key={item._id}>
                          {item.mediaType === "VIDEO" ? (
                            <video
                              controls
                              preload="metadata"
                              aria-label={item.caption || "Trip video"}
                              src={item.fileUrl}
                            />
                          ) : (
                            <Image
                              className="media-preview"
                              src={item.fileUrl!}
                              alt={item.caption || "SmartMove vehicle image"}
                              width={600}
                              height={400}
                              unoptimized
                            />
                          )}
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="media-link"
                          >
                            <IconPhoto size={18} />
                            {item.caption || "Vehicle image"}
                            <IconArrowRight size={16} />
                          </a>
                        </figure>
                      ))}
                  </div>
                </section>
              )}
            </>
          )
        )}
      </main>
      <Footer />
    </>
  )
}
export function UpdatesClient() {
  const resource = useData<{ items: ContentItem[] }>(
    "/api/public/announcements",
    30000
  )
  return (
    <>
      <Header />
      <main id="main-content" className="wrap updates-main">
        <Intro
          eyebrow="BEFORE YOU SET OFF"
          title="A little heads-up."
          description="The latest travel announcements from SmartMove operations."
        />
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : resource.data?.items.length ? (
          <div className="announcements-list">
            {resource.data.items.map((item, i) => (
              <article key={item._id} className="announcement">
                <span className="announcement-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  {(item.createdAt || item.postedDate) && (
                    <p className="eyebrow">
                      {day(String(item.createdAt || item.postedDate))}
                    </p>
                  )}
                  <h2>{item.title}</h2>
                  <p>{item.body || item.content}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="You’re up to date"
            description="New travel announcements will appear here."
          />
        )}
      </main>
      <Footer />
    </>
  )
}
