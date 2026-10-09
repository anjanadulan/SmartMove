import Link from "next/link"
export default function NotFound() {
  return (
    <main id="main-content" className="not-found">
      <p>404 · SMARTMOVE</p>
      <h1>This road doesn’t lead anywhere.</h1>
      <p>The page may have moved or the trip may no longer exist.</p>
      <Link href="/">Back to departures →</Link>
    </main>
  )
}
