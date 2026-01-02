import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      {
        headers: {
          "User-Agent": "Dashmint/1.0",
        },
      }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch location suggestions")
    }

    const data = await response.json()

    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    })
  } catch (error: any) {
    console.error("Error fetching location suggestions:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch location suggestions" },
      { status: 500 }
    )
  }
}



