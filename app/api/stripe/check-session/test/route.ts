import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    message: "✅ Check session route is accessible",
    timestamp: new Date().toISOString(),
    route: "/api/stripe/check-session",
  })
}

export async function POST() {
  return NextResponse.json({
    message: "✅ Check session POST endpoint is working",
    timestamp: new Date().toISOString(),
    note: "This is a test - provide sessionId in body for real functionality",
  })
}
