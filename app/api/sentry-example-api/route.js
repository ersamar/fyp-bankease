import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    throw new Error("Sentry Example API Route Error");
    return NextResponse.json({ data: "Testing Sentry Error..." });
  } catch (error) {
    // No need to manually capture with Sentry – it's automatic!
    console.error(error); // Optional: Log to server console
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}