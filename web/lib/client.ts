"use client"
import { useEffect, useState } from "react"

export async function api<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  })
  const result = await response
    .json()
    .catch(() => ({ error: "Unexpected response from the server." }))
  if (!response.ok) throw new Error(result.error || "The request failed.")
  return result as T
}
export function useData<T>(url: string | null, interval = 0) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: "" }
  )
  const key = `${url}:${version}`
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    const load = () => {
      if (document.visibilityState === "hidden") return
      api<T>(url, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setState({ key, data })
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setState({ key, error: error.message })
        })
    }
    load()
    const timer = interval ? setInterval(load, interval) : undefined
    return () => {
      controller.abort()
      if (timer) clearInterval(timer)
    }
  }, [url, key, interval])
  const current = state.key === key ? state : undefined
  return {
    data: current?.data,
    error: current?.error,
    loading: !!url && !current,
    reload: () => setVersion((v) => v + 1),
  }
}
export function useNow() {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0)
    const timer = setInterval(() => setNow(Date.now()), 10000)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [])
  return now
}
export const money = (value: unknown) =>
  `LKR ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 2 }).format(Number(value || 0))}`
export const clock = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(String(value)))
    : "—"
export const day = (value: unknown) =>
  value && !String(value).startsWith("+")
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(String(value)))
    : "—"
export const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  return ["year", "month", "day"]
    .map((key) => parts.find((x) => x.type === key)?.value)
    .join("-")
}
export function csvDownload(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const columns = Object.keys(rows[0])
  const cell = (value: unknown) => {
    let text = String(value ?? "")
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  const blob = new Blob(
    [
      "\uFEFF" +
        [
          columns.map(cell).join(","),
          ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
        ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" }
  )
  const url = URL.createObjectURL(blob),
    link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
