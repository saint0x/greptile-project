// This API route is no longer needed since we're calling our backend directly.
// The user-facing-fe now connects to the backend public API at /api/public endpoints.
// 
// If you need to proxy requests or add middleware, you can implement that here.

import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ 
    message: "This endpoint is deprecated. Use the backend public API directly.",
    redirect: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/public/changelogs`
  }, { status: 410 }) // Gone
}
