"use client"
import Link from "next/link"
import {
  IconArrowRight,
  IconAlertCircle,
  IconRefresh,
  IconSearch,
  IconRoute,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { day, clock, money } from "@/lib/client"
import type { Row } from "@/lib/types"

export function LinkButton({
  href,
  children,
  variant = "default",
  className = "",
}: {
  href: string
  children: React.ReactNode
  variant?: "default" | "outline" | "ghost" | "secondary"
  className?: string
}) {
  return (
    <Button
      nativeButton={false}
      render={<Link href={href} />}
      variant={variant}
      className={className}
    >
      {children}
    </Button>
  )
}
export function Intro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
export function Status({ value }: { value: unknown }) {
  const label = String(value || "Unknown")
  const color = [
    "CONFIRMED",
    "ISSUED",
    "ACTIVE",
    "COMPLETED",
    "RESOLVED",
  ].includes(label)
    ? "good"
    : ["PENDING", "RESERVED", "SCHEDULED", "OPEN"].includes(label)
      ? "pending"
      : "neutral"
  return (
    <Badge variant="secondary" className={`status ${color}`}>
      {label.toLowerCase().replaceAll("_", " ")}
    </Badge>
  )
}
export function ErrorState({
  message,
  retry,
}: {
  message?: string
  retry?: () => void
}) {
  return (
    <div className="error-state" role="alert">
      <IconAlertCircle size={24} />
      <div>
        <strong>We couldn’t load this information.</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <IconRefresh />
          Retry
        </Button>
      )}
    </div>
  )
}
export function Notice({
  children,
  success = false,
}: {
  children: React.ReactNode
  success?: boolean
}) {
  return (
    <div
      role={success ? "status" : "alert"}
      className={`notice ${success ? "success" : ""}`}
    >
      {children}
    </div>
  )
}
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="loading" role="status" aria-label="Loading information">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
export function Empty({
  title = "Nothing here yet",
  description = "New records will appear here.",
  children,
}: {
  title?: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <IconRoute />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}
export function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (
    [
      "fare",
      "base_fare",
      "amount",
      "total",
      "paid",
      "refunded",
      "cost",
      "revenue",
    ].includes(key)
  )
    return money(value)
  if (key.endsWith("_at")) return `${day(value)} · ${clock(value)}`
  if (key.endsWith("_date")) return day(value)
  return String(value)
}
export function DataTable({
  rows,
  columns,
  actions,
}: {
  rows: Row[]
  columns: [string, string][]
  actions?: (row: Row) => React.ReactNode
}) {
  return (
    <div className="table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(([key, label]) => (
              <TableHead key={key}>{label}</TableHead>
            ))}
            {actions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map(([key]) => (
                <TableCell key={key}>
                  {key.includes("status") ? (
                    <Status value={row[key]} />
                  ) : (
                    formatValue(key, row[key])
                  )}
                </TableCell>
              ))}
              {actions && (
                <TableCell>
                  <div className="row-actions">{actions(row)}</div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
export function SearchIcon() {
  return <IconSearch size={18} />
}
export function Arrow() {
  return <IconArrowRight size={18} />
}
