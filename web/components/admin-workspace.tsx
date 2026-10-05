"use client"
import { useState } from "react"
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
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
                      <p>{n.body}</p>
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
                onDone={done}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
function ManagementForm({
  entity,
  modal,
  lookup,
  onDone,
}: {
  entity: string
  modal: Modal
  lookup: Lookups
  onDone: () => void
}) {
  const config = entities[entity],
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
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
    <form onSubmit={submit} className="modal-form">
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
              return (
                <div className="field" key={field.key}>
                  <Label htmlFor={`admin-${field.key}`}>{field.label}</Label>
                  {field.type === "select" ? (
                    <select
                      id={`admin-${field.key}`}
                      name={field.key}
                      defaultValue={value}
                      required={!field.optional}
                    >
                      <option value="" disabled>
                        Choose {field.label.toLowerCase()}
                      </option>
                      {field.reference
                        ? (lookup[field.reference] || []).map((row) => (
                            <option key={String(row.id)} value={String(row.id)}>
                              {row.label}
                            </option>
                          ))
                        : field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option.toLowerCase().replaceAll("_", " ")}
                            </option>
                          ))}
                    </select>
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
      {error && <Notice>{error}</Notice>}
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
            <select id="report-passenger" name="passengerId" required>
              <option value="">Select a passenger</option>
              {passengers.data?.rows.map((p) => (
                <option
                  key={String(p.passenger_id)}
                  value={String(p.passenger_id)}
                >
                  {p.full_name}
                </option>
              ))}
            </select>
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
                  {item.audience || item.assetType || item.mediaType}
                </p>
                <h2>
                  {item.title || item.caption || `Vehicle ${item.vehicleId}`}
                </h2>
                {item.body && <p>{item.body}</p>}
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
                      : item.createdAt
                        ? day(item.createdAt)
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
    [error, setError] = useState("")
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const values = Object.fromEntries(new FormData(e.currentTarget))
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
                required
                minLength={3}
                maxLength={150}
              />
            </div>
            <div className="field">
              <Label htmlFor="content-body">Announcement</Label>
              <Textarea
                id="content-body"
                name="body"
                required
                minLength={5}
                maxLength={5000}
              />
            </div>
            <div className="field">
              <Label htmlFor="content-audience">Audience</Label>
              <select id="content-audience" name="audience">
                <option value="PASSENGERS">Passengers</option>
                <option value="ALL">Everyone</option>
                <option value="ADMIN">Administrators</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <Label htmlFor="content-link">
                {collection === "vehicle_assets" ? "Vehicle" : "Trip"}
              </Label>
              {collection === "vehicle_assets" ? (
                <select id="content-link" name="vehicleId" required>
                  <option value="">Select vehicle</option>
                  {lookup.vehicles?.map((v) => (
                    <option key={String(v.id)} value={String(v.id)}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="content-link"
                  name="tripId"
                  type="number"
                  min={1}
                  required
                  placeholder="Trip ID from the Trips page"
                />
              )}
            </div>
            <div className="field">
              <Label htmlFor="content-type">Media type</Label>
              <select
                id="content-type"
                name={
                  collection === "vehicle_assets" ? "assetType" : "mediaType"
                }
              >
                <option value="IMAGE">Image</option>
                <option
                  value={collection === "vehicle_assets" ? "DOCUMENT" : "VIDEO"}
                >
                  {collection === "vehicle_assets" ? "Document" : "Video"}
                </option>
              </select>
            </div>
            <div className="field">
              <Label htmlFor="content-url">File URL</Label>
              <Input
                id="content-url"
                name="fileUrl"
                required
                placeholder="https://… or /uploads/…"
                maxLength={2000}
              />
            </div>
            {collection === "trip_media" && (
              <div className="field">
                <Label htmlFor="content-caption">Caption</Label>
                <Input id="content-caption" name="caption" maxLength={300} />
              </div>
            )}
          </>
        ))}
      {error && <Notice>{error}</Notice>}
      <Button
        type="submit"
        variant={modal.mode === "delete" ? "destructive" : "default"}
        disabled={busy}
      >
        {busy
          ? "Saving…"
          : modal.mode === "delete"
            ? "Delete content"
            : "Save content"}
      </Button>
    </form>
  )
}
