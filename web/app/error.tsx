"use client"
import { Button } from "@/components/ui/button"
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="not-found">
      <h1>We hit a bump in the road.</h1>
      <p>
        Please try again. Your existing bookings are stored in the database.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  )
}
