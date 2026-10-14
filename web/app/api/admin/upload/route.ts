import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import {
  requireSession,
  cookieName,
  sameOrigin,
  safeError,
  AppError,
} from "@/lib/server/security"
import { using } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req)
    await using(async (c) => {
      await requireSession(
        "ADMIN",
        c,
        req.cookies.get(cookieName("ADMIN"))?.value || null
      )
    })

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      throw new AppError("No file was uploaded.", 400)
    }

    // Limit size to 50MB
    if (file.size > 50 * 1024 * 1024) {
      throw new AppError("File is too large. Maximum allowed size is 50MB.", 400)
    }

    // Allowed MIME types: images, videos, and pdfs
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "application/pdf",
    ]

    const type = file.type.toLowerCase()
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "ogg", "mov", "pdf"]

    if (!allowedTypes.includes(type) && !allowedExts.includes(ext)) {
      throw new AppError(
        "Invalid file type. Supported formats are JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, and PDF.",
        400
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const cleanExt = ext || (type.startsWith("image/") ? "png" : type.startsWith("video/") ? "mp4" : "pdf")
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${cleanExt}`

    const uploadsDir = join(process.cwd(), "public", "uploads")
    await mkdir(uploadsDir, { recursive: true })
    await writeFile(join(uploadsDir, safeName), buffer)

    const isVideo = type.startsWith("video/") || ["mp4", "webm", "ogg", "mov"].includes(cleanExt)
    const isDoc = type === "application/pdf" || cleanExt === "pdf"

    return NextResponse.json({
      fileUrl: `/uploads/${safeName}`,
      fileName: safeName,
      fileType: isVideo ? "VIDEO" : isDoc ? "DOCUMENT" : "IMAGE",
    })
  } catch (error) {
    const failure = safeError(error)
    return NextResponse.json({ error: failure.message }, { status: failure.status })
  }
}
