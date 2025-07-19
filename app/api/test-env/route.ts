// app/api/test-env/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    env: {
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_PRO_PRICE_ID: !!process.env.STRIPE_PRO_PRICE_ID,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
    keys: Object.keys(process.env).filter(key => key.includes('STRIPE')),
  })
}