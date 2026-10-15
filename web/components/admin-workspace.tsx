"use client"
import { useState, useEffect } from "react"
import {
  IconPlus,
  IconSearch,
  IconDownload,
  IconPencil,
  IconTrash,
  IconBus,
  IconCreditCard,
  IconMessage,
  IconTool,
  IconArrowRight,
  IconCheck,
  IconX,
  IconStar,
  IconUpload,
  IconSparkles,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SmartSelect } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { api, useData, money, day, today, csvDownload } from "@/lib/client"
import { entities, fieldAliases } from "@/lib/admin-config"
import { TownAutocomplete } from "./town-autocomplete"
import {
  DataTable,
  Intro,
  Loading,
  ErrorState,
  Empty,
  Notice,
  LinkButton,
} from "./common"
import type { Row, Trip, ContentItem } from "@/lib/types"
import { safeMediaUrl } from "@/lib/validation"
type Lookups = Record<string, Row[]>

export function DashboardClient() {
  const resource = useData<{ stats: Row; trips: Trip[]; maintenance: Row[] }>(
      "/api/admin/dashboard",
      30000
    ),
    news = useData<{ items: ContentItem[] }>(
      "/api/admin/content?collection=announcements"
    )
  const icons = [IconBus, IconBus, IconCreditCard, IconMessage]
  return (
    <>
      <Intro
        eyebrow="THE BIG PICTURE"
        title="Your operations, at a glance."
        description={`${day(today() + "T00:00:00+05:30")} · Sri Lanka time`}
        action={
          <LinkButton href="/admin/trips">
            <IconPlus />
            Schedule a trip
          </LinkButton>
        }
      />
      {resource.loading ? (
        <Loading rows={4} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        resource.data && (
          <>
            <div className="metric-grid">
              {[
                ["trips", "Upcoming trips", "Scheduled departures"],
                ["vehicles", "Active vehicles", "Available fleet"],
                ["revenue", "Net ticket revenue", "Payments less refunds"],
                ["feedback", "Open feedback", "Waiting for a response"],
              ].map(([key, label, note], index) => {
                const Icon = icons[index]
                return (
                  <Card className="metric-card" key={key}>
                    <CardContent>
                      <span className="metric-icon">
                        <Icon size={24} />
                      </span>
                      <p>{label}</p>
                      <strong>
                        {key === "revenue"
                          ? money(resource.data!.stats[key])
                          : resource.data!.stats[key]}
                      </strong>
                      <span>{note}</span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Next departures</h2>
                  <LinkButton variant="ghost" href="/admin/trips">
                    All trips <IconArrowRight />
                  </LinkButton>
                </div>
                {resource.data.trips.length ? (
                  <DataTable
                    rows={resource.data.trips}
                    columns={[
                      ["route_name", "Route"],
                      ["registration_number", "Vehicle"],
                      ["departure_at", "Departure"],
                      ["available_seats", "Seats left"],
                      ["status", "Status"],
                    ]}
                  />
                ) : (
                  <Empty
                    title="No upcoming departures"
                    description="Schedule a trip to start accepting reservations."
                  />
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Maintenance</h2>
                  <LinkButton variant="ghost" href="/admin/maintenance">
                    View all
                  </LinkButton>
                </div>
                {resource.data.maintenance.length ? (
                  resource.data.maintenance.map((m) => (
                    <div
                      className="maintenance-item"
                      key={String(m.maintenance_id)}
                    >
                      <span className="maintenance-icon">
                        <IconTool size={20} />
                      </span>
                      <div>
                        <strong>{m.registration_number}</strong>
                        <p>{m.maintenance_type}</p>
                        <span
                          className={
                            String(m.scheduled_date).slice(0, 10) < today()
                              ? "overdue"
                              : "muted"
                          }
                        >
                          {day(m.scheduled_date)}
                          {String(m.scheduled_date).slice(0, 10) < today()
                            ? " · Overdue"
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No services scheduled"
                    description="Scheduled inspections appear here."
                  />
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Seats reserved on upcoming trips</h2>
                  <LinkButton variant="ghost" href="/admin/reports">
                    Reports
                  </LinkButton>
                </div>
                {resource.data.trips.length ? (
                  <div className="occupancy-chart">
                    {resource.data.trips.slice(0, 5).map((t) => {
                      const percent = Math.round(
                        ((t.seat_count - t.available_seats) / t.seat_count) *
                          100
                      )
                      return (
                        <div key={t.trip_id}>
                          <span>{t.route_name}</span>
                          <div className="bar-track">
                            <i style={{ width: `${percent}%` }} />
                          </div>
                          <strong>{percent}%</strong>
                        </div>
                      )
                    })}
                    <p className="field-help">
                      Includes issued tickets and unexpired seat holds.
                    </p>
                  </div>
                ) : (
                  <p className="panel-empty">
                    Occupancy appears when you schedule departures.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Latest announcements</h2>
                  <LinkButton variant="ghost" href="/admin/content">
                    Manage
                  </LinkButton>
                </div>
                {news.loading ? (
                  <Loading rows={2} />
                ) : news.error ? (
                  <ErrorState message={news.error} retry={news.reload} />
                ) : news.data?.items.length ? (
                  news.data.items.slice(0, 3).map((n) => (
                    <div className="news-item" key={n._id}>
                      <strong>{n.title}</strong>
                      <p>{n.body || n.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="panel-empty">
                    Publish an announcement to keep passengers informed.
                  </p>
                )}
              </section>
            </div>
          </>
        )
      )}
    </>
  )
}
type Modal = {
  mode: "create" | "edit" | "delete" | "action"
  row?: Row
  action?: string
}
export function ManagementClient({ entity }: { entity: string }) {
  const config = entities[entity],
    resource = useData<{ rows: Row[] }>(`/api/admin/data/${entity}`),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [message, setMessage] = useState("")
  const lookup = useData<Lookups>(
    modal &&
      (modal.mode === "create" || modal.mode === "edit") &&
      config.fields.some((f) => f.reference)
      ? "/api/admin/lookups"
      : null
  )
  const rows = (resource.data?.rows || []).filter((row) =>
    Object.values(row).some((value) =>
      String(value).toLowerCase().includes(query.toLowerCase())
    )
  )
  function action(row: Row, action: string) {
    setModal({ mode: "action", row, action })
  }
  function done() {
    setModal(null)
    setMessage("Changes saved.")
    resource.reload()
  }
  return (
    <>
      <Intro
        eyebrow="OPERATIONS"
        title={config.title}
        description={config.description}
        action={
          config.create ? (
            <Button onClick={() => setModal({ mode: "create" })}>
              <IconPlus />
              {entity === "trips"
                ? "Schedule trip"
                : entity === "payments"
                  ? "Record payment"
                  : `Add ${config.singular}`}
            </Button>
          ) : undefined
        }
      />
      <div className="table-toolbar">
        <div className="input-icon">
          <IconSearch />
          <Input
            aria-label={`Search ${config.title.toLowerCase()}`}
            placeholder={`Search ${config.title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="muted">{rows.length} records</span>
        <Button
          variant="outline"
          onClick={() => csvDownload(`smartmove-${entity}.csv`, rows)}
          disabled={!rows.length}
        >
          <IconDownload />
          Export CSV
        </Button>
      </div>
      {message && <Notice success>{message}</Notice>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : rows.length ? (
        <DataTable
          rows={rows}
          columns={config.columns}
          actions={(row) => (
            <>
              {config.edit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${config.singular} ${row[config.id]}`}
                  onClick={() => setModal({ mode: "edit", row })}
                >
                  <IconPencil size={17} />
                </Button>
              )}
              {entity === "trips" && row.status === "SCHEDULED" && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => action(row, "complete")}
                  >
                    <IconCheck />
                    Complete
                  </Button>
                  <Button variant="ghost" onClick={() => action(row, "cancel")}>
                    <IconX />
                    Cancel
                  </Button>
                </>
              )}
              {entity === "bookings" && row.status === "PENDING" && (
                <Button
                  variant="ghost"
                  onClick={() => action(row, "confirm")}
                  style={{
                    color: "var(--primary, #246348)",
                    fontWeight: 600,
                  }}
                >
                  <IconCheck size={16} />
                  Confirm & pay
                </Button>
              )}
              {entity === "bookings" && row.status !== "CANCELLED" && (
                <Button variant="ghost" onClick={() => action(row, "cancel")}>
                  Cancel & refund
                </Button>
              )}
              {entity === "maintenance" && row.status === "SCHEDULED" && (
                <Button variant="ghost" onClick={() => action(row, "complete")}>
                  Complete
                </Button>
              )}
              {entity === "payments" &&
                Number(row.refunded) === 0 &&
                row.booking_status === "CANCELLED" && (
                  <Button variant="ghost" onClick={() => action(row, "refund")}>
                    Record refund
                  </Button>
                )}
              {entity === "feedback" && (
                <>
                  <Button variant="ghost" onClick={() => action(row, "reply")}>
                    Reply
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      action(row, row.status === "OPEN" ? "resolve" : "reopen")
                    }
                  >
                    {row.status === "OPEN" ? "Resolve" : "Reopen"}
                  </Button>
                </>
              )}
              {config.remove && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${config.singular} ${row[config.id]}`}
                  onClick={() => setModal({ mode: "delete", row })}
                >
                  <IconTrash size={17} />
                </Button>
              )}
            </>
          )}
        />
      ) : (
        <Empty
          title={
            query
              ? "No matching records"
              : `No ${config.title.toLowerCase()} yet`
          }
          description={
            query
              ? "Try a different search."
              : `Records will appear here when they are added.`
          }
        />
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
              {modal?.mode === "create"
                ? `Add ${config.singular}`
                : modal?.mode === "edit"
                  ? `Edit ${config.singular}`
                  : modal?.mode === "delete"
                    ? `Delete ${config.singular}?`
                    : `${modal?.action || "Update"} ${config.singular}`}
            </DialogTitle>
            <DialogDescription>
              {modal?.mode === "delete"
                ? "Linked historical records prevent deletion."
                : config.description}
            </DialogDescription>
          </DialogHeader>
          {lookup.loading ? (
            <Loading rows={2} />
          ) : lookup.error ? (
            <ErrorState message={lookup.error} retry={lookup.reload} />
          ) : (
            modal && (
              <ManagementForm
                key={`${modal.mode}:${modal.row?.[config.id] || "new"}:${modal.action}`}
                entity={entity}
                modal={modal}
                lookup={lookup.data || {}}
                extraTowns={
                  entity === "routes"
                    ? Array.from(
                        new Set(
                          (resource.data?.rows || []).flatMap((r) => [
                            String(r.origin || ""),
                            String(r.destination || ""),
                          ]).filter(Boolean)
                        )
                      ).sort()
                    : []
                }
                onDone={done}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
function AdminTownField({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  extraTowns = [],
}: {
  id: string
  name: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
  extraTowns?: string[]
}) {
  return (
    <TownAutocomplete
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      extraTowns={extraTowns}
      required={required}
      ariaLabel={name}
    />
  )
}

function isFieldInvalid(fieldKey: string, errMsg: string): boolean {
  if (!errMsg) return false
  const m = errMsg.toLowerCase()

  // 1. Vehicle conflicts (only if error is about vehicle/maintenance)
  if (fieldKey === "vehicleId") {
    return (
      m.includes("vehicle") ||
      m.includes("workshop") ||
      m.includes("maintenance")
    )
  }

  // 2. Driver conflicts (only if error is about driver)
  if (fieldKey === "driverId") {
    return m.includes("driver")
  }

  // 3. Timing errors (only if error is about invalid departure/arrival times)
  if (fieldKey === "departure") {
    return (
      m.includes("future") ||
      m.includes("departure and arrival") ||
      m.includes("departure time") ||
      m.includes("after departure") ||
      m.includes("later than departure")
    )
  }

  if (fieldKey === "arrival") {
    return (
      m.includes("departure and arrival") ||
      m.includes("after departure") ||
      m.includes("later than departure") ||
      m.includes("arrival time")
    )
  }

  // 4. Routes
  if (fieldKey === "origin" || fieldKey === "destination") {
    return (
      m.includes("origin") ||
      m.includes("destination") ||
      m.includes("same town")
    )
  }
  if (fieldKey === "name") {
    return m.includes("route name") || m.includes("unique")
  }
  if (fieldKey === "fare") {
    return m.includes("fare")
  }

  // 5. Other entities
  if (fieldKey === "seats") return m.includes("seat")
  if (fieldKey === "phone") return m.includes("phone")
  if (fieldKey === "licence") return m.includes("licence")
  if (fieldKey === "registration") return m.includes("registration")

  return false
}

function getFieldHint(fieldKey: string, errMsg: string): string | null {
  if (!errMsg) return null
  const m = errMsg.toLowerCase()

  // Vehicle hints (ONLY if the error is specifically about the vehicle)
  if (fieldKey === "vehicleId") {
    if (m.includes("maintenance") || m.includes("workshop")) {
      return "Vehicle is booked for workshop maintenance"
    }
    if (m.includes("not active") || m.includes("inactive")) {
      return "Selected vehicle is currently inactive"
    }
    if (
      m.includes("vehicle") &&
      (m.includes("already assigned") || m.includes("overlapping"))
    ) {
      return "Vehicle already has another trip during this time"
    }
    return null
  }

  // Driver hints (ONLY if the error is specifically about the driver)
  if (fieldKey === "driverId") {
    if (
      m.includes("driver") &&
      (m.includes("already assigned") || m.includes("overlapping"))
    ) {
      return "Driver already has another trip during this time"
    }
    return null
  }

  // Departure hints
  if (fieldKey === "departure") {
    if (m.includes("future")) return "Departure must be set in the future"
    if (m.includes("after departure") || m.includes("later than departure")) {
      return "Departure must be before arrival"
    }
    return null
  }

  // Arrival hints
  if (fieldKey === "arrival") {
    if (m.includes("after departure") || m.includes("later than departure")) {
      return "Arrival must be after departure time"
    }
    return null
  }

  // Route hints
  if (
    (fieldKey === "origin" || fieldKey === "destination") &&
    m.includes("same town")
  ) {
    return "Origin and destination must be different cities"
  }
  if (fieldKey === "fare" && m.includes("fare")) {
    return "Fare must be greater than zero"
  }

  return null
}

function ManagementForm({
  entity,
  modal,
  lookup,
  extraTowns = [],
  onDone,
}: {
  entity: string
  modal: Modal
  lookup: Lookups
  extraTowns?: string[]
  onDone: () => void
}) {
  const config = entities[entity],
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [origin, setOrigin] = useState(String(modal.row?.origin ?? "")),
    [destination, setDestination] = useState(
      String(modal.row?.destination ?? "")
    ),
    [routeName, setRouteName] = useState(
      String(modal.row?.route_name ?? "")
    ),
    [autoName, setAutoName] = useState(true)

  useEffect(() => {
    if (entity === "routes" && modal.mode === "create" && autoName) {
      if (origin && destination) {
        setRouteName(`${origin} - ${destination}`)
      } else if (origin) {
        setRouteName(origin)
      } else if (destination) {
        setRouteName(destination)
      } else {
        setRouteName("")
      }
    }
  }, [origin, destination, autoName, entity, modal.mode])
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const values = Object.fromEntries(new FormData(e.currentTarget)),
      recordId = modal.row?.[config.id]
    let url = `/api/admin/data/${entity}`,
      method = "POST",
      body: unknown = values
    if (modal.mode === "edit") {
      url += `/${recordId}`
      method = "PUT"
    }
    if (modal.mode === "delete") {
      url += `/${recordId}`
      method = "DELETE"
      body = {}
    }
    if (modal.mode === "action") {
      url += `/${recordId}/action`
      body = { ...values, action: modal.action }
    }
    try {
      await api(url, { method, body: JSON.stringify(body) })
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={submit}
      onChange={() => {
        if (error) setError("")
      }}
      className="modal-form"
    >
      {["create", "edit"].includes(modal.mode) && (
        <div className="form-grid">
          {config.fields
            .filter((f) =>
              modal.mode === "edit" ? !f.createOnly : !f.editOnly
            )
            .map((field) => {
              let alias = fieldAliases[field.key] || field.key
              if (entity === "routes" && field.key === "name")
                alias = "route_name"
              if (entity === "maintenance" && field.key === "type")
                alias = "maintenance_type"
              let value = String(modal.row?.[alias] ?? "")
              if (field.type === "datetime-local") value = value.slice(0, 16)
              if (field.type === "date") value = value.slice(0, 10)
              const hasErr = isFieldInvalid(field.key, error)
              const hint = getFieldHint(field.key, error)
              return (
                <div
                  className={`field ${hasErr ? "has-error" : ""}`}
                  key={field.key}
                >
                  {entity === "routes" && field.key === "name" ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "7px",
                      }}
                    >
                      <Label
                        htmlFor={`admin-${field.key}`}
                        className={hasErr ? "field-label-error" : undefined}
                        style={{ margin: 0 }}
                      >
                        {field.label}
                      </Label>
                      {autoName ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--primary, #246348)",
                            background: "#e9f2ec",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <IconSparkles size={12} /> Auto-generated
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAutoName(true)
                            if (origin && destination)
                              setRouteName(`${origin} - ${destination}`)
                            else if (origin) setRouteName(origin)
                            else if (destination) setRouteName(destination)
                          }}
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#62747c",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: 0,
                          }}
                          title="Reset to auto-generated name"
                        >
                          <IconRefresh size={12} /> Reset to auto
                        </button>
                      )}
                    </div>
                  ) : (
                    <Label
                      htmlFor={`admin-${field.key}`}
                      className={hasErr ? "field-label-error" : undefined}
                    >
                      {field.label}
                    </Label>
                  )}
                  {field.type === "select" ? (
                    <SmartSelect
                      id={`admin-${field.key}`}
                      name={field.key}
                      defaultValue={value}
                      required={!field.optional}
                      placeholder={`Choose ${field.label.toLowerCase()}`}
                      className={hasErr ? "field-input-error" : undefined}
                      options={
                        field.reference
                          ? (lookup[field.reference] || []).map((row) => ({
                              value: String(row.id),
                              label: String(row.label ?? row.id),
                            }))
                          : (field.options || []).map((option) => ({
                              value: option,
                              label: option.toLowerCase().replaceAll("_", " "),
                            }))
                      }
                    />
                  ) : field.type === "town" ||
                    (entity === "routes" &&
                      (field.key === "origin" ||
                        field.key === "destination")) ? (
                    <AdminTownField
                      id={`admin-${field.key}`}
                      name={field.key}
                      value={field.key === "origin" ? origin : destination}
                      onChange={(val) => {
                        if (error) setError("")
                        if (field.key === "origin") setOrigin(val)
                        else setDestination(val)
                      }}
                      required={!field.optional}
                      placeholder={
                        field.key === "origin"
                          ? "Any departure city"
                          : "Where are you going?"
                      }
                      extraTowns={extraTowns}
                    />
                  ) : entity === "routes" && field.key === "name" ? (
                    <Input
                      id={`admin-${field.key}`}
                      name={field.key}
                      type="text"
                      value={routeName}
                      onChange={(e) => {
                        if (error) setError("")
                        setRouteName(e.target.value)
                        setAutoName(false)
                      }}
                      className={hasErr ? "field-input-error" : undefined}
                      placeholder="e.g. Colombo - Kandy"
                      required={!field.optional}
                      maxLength={100}
                    />
                  ) : (
                    <Input
                      id={`admin-${field.key}`}
                      name={field.key}
                      type={field.type || "text"}
                      defaultValue={value}
                      min={field.min}
                      max={field.max}
                      step={
                        field.type === "number" && field.key !== "seats"
                          ? "0.01"
                          : undefined
                      }
                      required={!field.optional}
                      className={hasErr ? "field-input-error" : undefined}
                      maxLength={
                        field.key === "phone"
                          ? 15
                          : field.key === "registration"
                            ? 20
                            : field.key === "licence"
                              ? 30
                              : 100
                      }
                    />
                  )}
                  {hint && (
                    <span className="field-error-hint">
                      <IconAlertCircle size={13} /> {hint}
                    </span>
                  )}
                </div>
              )
            })}
        </div>
      )}
      {modal.mode === "delete" && (
        <p>
          Delete record {modal.row?.[config.id]}? This operation cannot be
          undone.
        </p>
      )}
      {modal.mode === "action" && (
        <>
          {modal.action === "complete" && entity === "maintenance" && (
            <div className="field">
              <Label htmlFor="cost">Service cost (LKR)</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                min={0}
                step="0.01"
                required
              />
            </div>
          )}
          {modal.action === "refund" && (
            <div className="field">
              <Label htmlFor="reason">Refund reason</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                minLength={3}
                maxLength={200}
              />
            </div>
          )}
          {modal.action === "reply" && (
            <>
              <p className="feedback-original">{modal.row?.comment}</p>
              <div className="field">
                <Label htmlFor="reply">Reply to the passenger</Label>
                <Textarea
                  id="reply"
                  name="message"
                  required
                  minLength={2}
                  maxLength={2000}
                  defaultValue={String(modal.row?.reply || "")}
                />
              </div>
            </>
          )}
          {modal.action === "confirm" && entity === "bookings" && (
            <>
              <div style={{ marginBottom: "16px", lineHeight: "1.6" }}>
                <p style={{ margin: "0 0 10px 0" }}>
                  Confirm booking <strong>#{modal.row?.booking_id}</strong> for{" "}
                  <strong>{modal.row?.full_name}</strong>?
                </p>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#334155",
                    background: "#f8fafc",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "6px 14px",
                  }}
                >
                  <div>
                    <strong>Route:</strong> {modal.row?.route_name}
                  </div>
                  <div>
                    <strong>Seats:</strong> {modal.row?.seats}
                  </div>
                  <div>
                    <strong>Departure:</strong> {modal.row?.departure_at}
                  </div>
                  <div>
                    <strong>Total Fare:</strong> {modal.row?.total}
                  </div>
                </div>
              </div>
              <div className="field">
                <Label htmlFor="method">Payment received by</Label>
                <SmartSelect
                  id="method"
                  name="method"
                  defaultValue="CASH"
                  required
                  options={[
                    { value: "CASH", label: "Cash (at counter / bus)" },
                    { value: "CARD", label: "Card (POS terminal)" },
                    { value: "BANK_TRANSFER", label: "Bank transfer slip" },
                  ]}
                />
              </div>
              <Notice>
                Recording payment will issue the tickets in Oracle and update this booking to CONFIRMED.
              </Notice>
            </>
          )}
          {modal.action === "cancel" && (
            <Notice>
              Confirm cancellation. Paid bookings will receive refund records;
              bank settlement must be handled separately.
            </Notice>
          )}
          {modal.action === "complete" && entity === "trips" && (
            <p>
              Mark this trip as completed. Oracle checks that its arrival time
              has passed.
            </p>
          )}
          {["resolve", "reopen"].includes(modal.action || "") && (
            <p>
              Change the case status to{" "}
              {modal.action === "resolve" ? "resolved" : "open"}?
            </p>
          )}
        </>
      )}
      {entity === "payments" && (
        <Notice>
          Record a payment only after it has been received. This form does not
          charge a card.
        </Notice>
      )}
      {error && (
        <div className="form-error-alert" role="alert">
          <IconAlertCircle size={22} className="error-icon" />
          <div>
            <div className="error-title">Cannot Save Record</div>
            <div className="error-body">{error}</div>
          </div>
        </div>
      )}
      <Button
        type="submit"
        variant={
          modal.mode === "delete" || modal.action === "cancel"
            ? "destructive"
            : "default"
        }
        disabled={busy}
      >
        {busy
          ? "Saving…"
          : modal.mode === "delete"
            ? "Delete record"
            : modal.action === "confirm"
              ? "Confirm & Issue Tickets"
              : modal.mode === "action"
                ? "Confirm"
                : "Save changes"}
      </Button>
    </form>
  )
}
const reportLabels: Record<string, string> = {
  "popular-routes": "Popular routes",
  revenue: "Revenue by period",
  "passenger-history": "Passenger travel history",
  "maintenance-due": "Maintenance due",
  "trip-occupancy": "Trip occupancy",
}
export function ReportsClient() {
  const [name, setName] = useState("popular-routes"),
    [query, setQuery] = useState("/api/admin/reports/popular-routes")
  const resource = useData<{
      rows: Row[]
      output: string[]
      procedure: string
    }>(query),
    passengers = useData<{ rows: Row[] }>("/api/admin/data/passengers")
  function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setQuery(
      `/api/admin/reports/${name}?${new URLSearchParams(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>)}`
    )
    if (query.startsWith(`/api/admin/reports/${name}`)) resource.reload()
  }
  return (
    <>
      <Intro
        eyebrow="BUSINESS REPORTS"
        title="See the story behind the journeys."
        description="Five reports backed by Oracle PL/SQL, with tabular output and CSV export."
      />
      <div className="report-tabs" role="group" aria-label="Choose report">
        {Object.entries(reportLabels).map(([key, label]) => (
          <Button
            key={key}
            variant={name === key ? "default" : "outline"}
            aria-pressed={name === key}
            onClick={() => setName(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      <form className="report-form" onSubmit={run}>
        {name === "revenue" && (
          <>
            <div className="field">
              <Label htmlFor="report-start">From</Label>
              <Input
                id="report-start"
                name="start"
                type="date"
                defaultValue={today().slice(0, 7) + "-01"}
                required
              />
            </div>
            <div className="field">
              <Label htmlFor="report-end">To</Label>
              <Input
                id="report-end"
                name="end"
                type="date"
                defaultValue={today()}
                required
              />
            </div>
          </>
        )}
        {name === "maintenance-due" && (
          <div className="field">
            <Label htmlFor="report-asof">Due on or before</Label>
            <Input
              id="report-asof"
              name="asOf"
              type="date"
              defaultValue={today()}
              required
            />
          </div>
        )}
        {name === "passenger-history" && (
          <div className="field">
            <Label htmlFor="report-passenger">Passenger</Label>
            <SmartSelect
              id="report-passenger"
              name="passengerId"
              required
              placeholder="Select a passenger"
              options={
                passengers.data?.rows.map((p) => ({
                  value: String(p.passenger_id),
                  label: String(p.full_name),
                })) || []
              }
            />
          </div>
        )}
        <Button type="submit">
          Generate report <IconArrowRight />
        </Button>
      </form>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        resource.data && (
          <section className="panel">
            <div className="panel-heading">
              <h2>{reportLabels[query.split("/").pop()!.split("?")[0]]}</h2>
              <Button
                variant="outline"
                disabled={!resource.data.rows.length}
                onClick={() =>
                  csvDownload(
                    `smartmove-${resource.data!.procedure}.csv`,
                    resource.data!.rows
                  )
                }
              >
                <IconDownload />
                Export CSV
              </Button>
            </div>
            {resource.data.rows.length ? (
              <DataTable
                rows={resource.data.rows}
                columns={Object.keys(resource.data.rows[0]).map((key) => [
                  key,
                  key.replaceAll("_", " "),
                ])}
              />
            ) : (
              <Empty
                title="No records for this report"
                description="Try another reporting period or passenger."
              />
            )}
            <details className="procedure-output">
              <summary>PL/SQL output · {resource.data.procedure}</summary>
              <pre>
                {resource.data.output.join("\n") ||
                  "Procedure completed with no output rows."}
              </pre>
            </details>
          </section>
        )
      )}
    </>
  )
}
const collectionLabels: Record<string, string> = {
  announcements: "Announcements",
  vehicle_assets: "Vehicle images & documents",
  trip_media: "Trip multimedia",
}
export function ContentClient() {
  const [collection, setCollection] = useState("announcements"),
    [modal, setModal] = useState<{
      mode: "create" | "delete"
      item?: ContentItem
    } | null>(null),
    [message, setMessage] = useState("")
  const resource = useData<{ items: ContentItem[] }>(
      `/api/admin/content?collection=${collection}`
    ),
    analytics = useData<{
      vehicles: { _id: string; averageRating: number; reviews: number }[]
      drivers: { _id: string; averageRating: number; reviews: number }[]
    }>("/api/admin/analytics"),
    lookup = useData<Lookups>("/api/admin/lookups")
  return (
    <>
      <Intro
        eyebrow="COMMUNITY & CONTENT"
        title="Keep everyone in the loop."
        description="Announcements, vehicle records, and journey media stored in MongoDB."
        action={
          <Button onClick={() => setModal({ mode: "create" })}>
            <IconPlus />
            Add content
          </Button>
        }
      />
      <div className="tab-row">
        {Object.entries(collectionLabels).map(([key, label]) => (
          <Button
            key={key}
            variant={collection === key ? "secondary" : "ghost"}
            aria-pressed={collection === key}
            onClick={() => setCollection(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {message && <Notice success>{message}</Notice>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.items.length ? (
        <div className="content-list">
          {resource.data.items.map((item) => (
            <article key={item._id} className="content-card">
              <div>
                <p className="eyebrow">
                  {item.audience ||
                    item.category ||
                    item.assetType ||
                    item.documentType ||
                    item.mediaType}
                </p>
                <h2>
                  {item.title || item.caption || `Vehicle ${item.vehicleId}`}
                </h2>
                {(item.body || item.content) && (
                  <p>{item.body || item.content}</p>
                )}
                {item.fileUrl && safeMediaUrl(item.fileUrl) && (
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open {item.assetType === "DOCUMENT" ? "document" : "media"}{" "}
                    <IconArrowRight size={16} />
                  </a>
                )}
                <span className="field-help">
                  {item.vehicleId
                    ? `Vehicle ${item.vehicleId}`
                    : item.tripId
                      ? `Trip ${item.tripId}`
                      : item.createdAt || item.postedDate
                        ? day(String(item.createdAt || item.postedDate))
                        : ""}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${item.title || "content"}`}
                onClick={() => setModal({ mode: "delete", item })}
              >
                <IconTrash />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No content here yet"
          description="Add an announcement or a media reference to get started."
        />
      )}
      <section className="analytics-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CUSTOMER FEEDBACK</p>
            <h2>Top rated, by your passengers.</h2>
          </div>
          <IconStar />
        </div>
        {analytics.error ? (
          <ErrorState message={analytics.error} retry={analytics.reload} />
        ) : analytics.loading ? (
          <Loading rows={2} />
        ) : (
          <div className="analytics-grid">
            {(["vehicles", "drivers"] as const).map((group) => (
              <div className="panel" key={group}>
                <h3>{group === "vehicles" ? "Vehicles" : "Drivers"}</h3>
                {analytics.data?.[group].length ? (
                  analytics.data[group].map((item) => (
                    <div className="rating-row" key={item._id}>
                      <span>
                        {lookup.data?.[group]?.find(
                          (x) => String(x.id) === item._id
                        )?.label ||
                          `${group === "vehicles" ? "Vehicle" : "Driver"} ${item._id}`}
                      </span>
                      <strong>
                        <IconStar size={16} />
                        {item.averageRating.toFixed(1)}
                      </strong>
                      <small>{item.reviews} reviews</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">No rated journeys yet.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <Dialog
        open={!!modal}
        onOpenChange={(open: boolean) => {
          if (!open) setModal(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {modal?.mode === "delete"
                ? "Delete this content?"
                : `Add ${collectionLabels[collection].toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              {modal?.mode === "delete"
                ? "This removes the MongoDB document. Linked Oracle transport records remain."
                : "Media references must use HTTPS or a file already placed in public/uploads."}
            </DialogDescription>
          </DialogHeader>
          {modal && (
            <ContentForm
              key={collection + modal.mode}
              collection={collection}
              modal={modal}
              lookup={lookup.data || {}}
              onDone={() => {
                setModal(null)
                setMessage("Content updated.")
                resource.reload()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
function ContentForm({
  collection,
  modal,
  lookup,
  onDone,
}: {
  collection: string
  modal: { mode: string; item?: ContentItem }
  lookup: Lookups
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [isDragging, setIsDragging] = useState(false),
    [fileUrl, setFileUrl] = useState(modal.item?.fileUrl || ""),
    [fileName, setFileName] = useState(""),
    [mediaType, setMediaType] = useState(
      modal.item?.mediaType || modal.item?.assetType || "IMAGE"
    ),
    [useUrlInput, setUseUrlInput] = useState(false),
    [error, setError] = useState("")

  async function uploadFile(file: File) {
    setUploading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "File upload failed.")
      setFileUrl(data.fileUrl)
      setFileName(file.name)
      if (collection === "trip_media" && data.fileType) {
        setMediaType(data.fileType === "VIDEO" ? "VIDEO" : "IMAGE")
      } else if (collection === "vehicle_assets" && data.fileType) {
        setMediaType(data.fileType === "DOCUMENT" ? "DOCUMENT" : "IMAGE")
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (modal.mode !== "delete" && collection !== "announcements" && !fileUrl) {
      setError("Please select a file to upload or enter a URL.")
      return
    }
    setBusy(true)
    setError("")
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(e.currentTarget)
    )
    if (fileUrl) values.fileUrl = fileUrl
    if (collection === "vehicle_assets") values.assetType = mediaType
    if (collection === "trip_media") values.mediaType = mediaType
    if (collection === "announcements") {
      values.active = values.active === "on" || values.active === "true"
    }
    try {
      await api(
        `/api/admin/content${modal.mode === "delete" ? `/${modal.item?._id}` : ""}?collection=${collection}`,
        {
          method: modal.mode === "delete" ? "DELETE" : "POST",
          body: JSON.stringify(values),
        }
      )
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="modal-form">
      {modal.mode !== "delete" &&
        (collection === "announcements" ? (
          <>
            <div className="field">
              <Label htmlFor="content-title">Title</Label>
              <Input
                id="content-title"
                name="title"
                placeholder="e.g. Southern Expressway Schedule Update"
                required
                minLength={3}
                maxLength={150}
              />
            </div>
            <div className="field">
              <Label htmlFor="content-body">Announcement content</Label>
              <Textarea
                id="content-body"
                name="body"
                placeholder="Write announcement details for passengers or operations staff..."
                required
                minLength={5}
                maxLength={5000}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <Label htmlFor="content-audience">Audience</Label>
                <SmartSelect
                  id="content-audience"
                  name="audience"
                  defaultValue="PASSENGERS"
                  options={[
                    { value: "PASSENGERS", label: "Passengers" },
                    { value: "ALL", label: "Everyone" },
                    { value: "ADMIN", label: "Administrators" },
                  ]}
                />
              </div>
              <div className="field">
                <Label htmlFor="content-category">Category</Label>
                <SmartSelect
                  id="content-category"
                  name="category"
                  defaultValue="NOTICE"
                  options={[
                    { value: "NOTICE", label: "Notice" },
                    { value: "SCHEDULE", label: "Schedule update" },
                    { value: "UPDATE", label: "Service update" },
                    { value: "ALERT", label: "General alert" },
                  ]}
                />
              </div>
            </div>
            <div className="field">
              <label className="checkbox-card">
                <input type="checkbox" name="active" defaultChecked />
                <div>
                  <strong>Active status</strong>
                  <p className="field-help" style={{ margin: "2px 0 0" }}>
                    Show immediately on passenger updates and travel notices
                  </p>
                </div>
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <Label
                htmlFor={
                  collection === "vehicle_assets"
                    ? "content-vehicle"
                    : "content-trip"
                }
              >
                {collection === "vehicle_assets" ? "Vehicle" : "Trip"}
              </Label>
              {collection === "vehicle_assets" ? (
                <SmartSelect
                  id="content-vehicle"
                  name="vehicleId"
                  required
                  placeholder="Select vehicle"
                  options={
                    lookup.vehicles?.map((v) => ({
                      value: String(v.id),
                      label: String(v.label ?? v.id),
                    })) || []
                  }
                />
              ) : (
                <SmartSelect
                  id="content-trip"
                  name="tripId"
                  required
                  placeholder="Select trip"
                  options={
                    lookup.trips?.map((t) => ({
                      value: String(t.id),
                      label: String(t.label ?? t.id),
                    })) || []
                  }
                />
              )}
            </div>
            <div className="field">
              <Label htmlFor="content-type">Media type</Label>
              <SmartSelect
                id="content-type"
                name={
                  collection === "vehicle_assets" ? "assetType" : "mediaType"
                }
                value={mediaType}
                onChange={setMediaType}
                options={[
                  { value: "IMAGE", label: "Image" },
                  {
                    value:
                      collection === "vehicle_assets" ? "DOCUMENT" : "VIDEO",
                    label:
                      collection === "vehicle_assets" ? "Document" : "Video",
                  },
                ]}
              />
            </div>
            <div className="field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.35rem",
                }}
              >
                <Label htmlFor={useUrlInput ? "content-url" : "content-file"}>
                  {useUrlInput
                    ? "File URL"
                    : collection === "vehicle_assets"
                      ? "Upload vehicle file (Image or Document)"
                      : "Upload trip media (Image or Video)"}
                </Label>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    textDecoration: "underline",
                  }}
                  onClick={() => setUseUrlInput((v) => !v)}
                >
                  {useUrlInput
                    ? "← Upload file directly"
                    : "Paste URL instead →"}
                </button>
              </div>
              {useUrlInput ? (
                <Input
                  id="content-url"
                  name="fileUrl"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  required
                  placeholder="https://… or /uploads/…"
                  maxLength={2000}
                />
              ) : (
                <div>
                  <input type="hidden" name="fileUrl" value={fileUrl} />
                  {fileUrl ? (
                    <div className="upload-file-card">
                      <div className="upload-file-info">
                        <span className="upload-file-badge">{mediaType}</span>
                        <span
                          className="upload-file-name"
                          title={fileName || fileUrl}
                        >
                          {fileName || fileUrl}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="upload-file-remove"
                        title="Remove and choose another file"
                        onClick={() => {
                          setFileUrl("")
                          setFileName("")
                        }}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`upload-dropzone ${isDragging ? "drag-active" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragging(true)
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragging(false)
                        const f = e.dataTransfer.files?.[0]
                        if (f) uploadFile(f)
                      }}
                    >
                      <input
                        id="content-file"
                        type="file"
                        accept={
                          collection === "vehicle_assets"
                            ? "image/*,application/pdf"
                            : "image/*,video/*"
                        }
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadFile(f)
                        }}
                        disabled={uploading}
                      />
                      <div className="upload-dropzone-icon">
                        <IconUpload size={22} />
                      </div>
                      <p className="upload-dropzone-title">
                        {uploading
                          ? "Uploading file…"
                          : "Choose a file or drag & drop here"}
                      </p>
                      <p className="upload-dropzone-hint">
                        {collection === "vehicle_assets"
                          ? "PNG, JPG, WEBP images or PDF documents up to 50MB"
                          : "PNG, JPG, WEBP images or MP4, WEBM videos up to 50MB"}
                      </p>
                    </div>
                  )}
                  {uploading && (
                    <div className="upload-progress">
                      <span>Uploading file…</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {collection === "trip_media" && (
              <div className="field">
                <Label htmlFor="content-caption">Caption</Label>
                <Input
                  id="content-caption"
                  name="caption"
                  placeholder="e.g. Scenic coastal road view"
                  maxLength={300}
                />
              </div>
            )}
          </>
        ))}
      {error && <Notice>{error}</Notice>}
      <Button
        type="submit"
        variant={modal.mode === "delete" ? "destructive" : "default"}
        disabled={busy || uploading}
      >
        {busy
          ? "Saving…"
          : uploading
            ? "Uploading…"
            : modal.mode === "delete"
              ? "Delete content"
              : "Save content"}
      </Button>
    </form>
  )
}
