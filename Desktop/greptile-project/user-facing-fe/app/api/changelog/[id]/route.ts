// This API route is no longer needed since we're calling our backend directly.
// The user-facing-fe now connects to the backend public API at /api/public endpoints.

import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ 
    message: "This endpoint is deprecated. Use the backend public API directly.",
    redirect: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/public/changelogs/${params.id}`
  }, { status: 410 }) // Gone
}
