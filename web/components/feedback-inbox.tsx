"use client"
import { IconMessage } from "@tabler/icons-react"
import { useData } from "@/lib/client"
import { Intro, Status, Loading, ErrorState, Empty, LinkButton } from "./common"
type Feedback = {
  feedback_id: number
  booking_id: number
  feedback_type: string
  status: string
  comment: string
  reply: { staffName: string; message: string } | null
}
export function FeedbackInbox() {
  const resource = useData<{ items: Feedback[] }>(
    "/api/account/feedback",
    30000
  )
  return (
    <>
      <Intro
        eyebrow="YOUR CONVERSATIONS"
        title="We’re here to help."
        description="Your reviews, support requests, and replies from SmartMove operations."
        action={
          <LinkButton href="/account/bookings">Leave feedback</LinkButton>
        }
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.items.length ? (
        <div className="feedback-inbox">
          {resource.data.items.map((item) => (
            <article className="feedback-case" key={item.feedback_id}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    {item.feedback_type} · BOOKING SM-{item.booking_id}
                  </p>
                  <IconMessage size={22} />
                </div>
                <Status value={item.status} />
              </div>
              <p>{item.comment}</p>
              {item.reply ? (
                <blockquote>
                  <strong>{item.reply.staffName}</strong>
                  <p>{item.reply.message}</p>
                </blockquote>
              ) : (
                <p className="field-help">
                  Awaiting a response from operations.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No conversations yet"
          description="Open a booking to send a review or support request."
        />
      )}
    </>
  )
}
