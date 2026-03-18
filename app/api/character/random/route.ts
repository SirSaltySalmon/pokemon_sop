import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import { getRandomCharacter } from "@/lib/character-api";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const result = await getRandomCharacter(supabase, {
      tags: searchParams.get("tags") ?? undefined,
      exclude: searchParams.get("exclude") ?? undefined,
      excludeIds: searchParams.get("excludeIds") ?? undefined,
    });
    if ("error" in result && result.status) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    if ("character" in result) {
      return NextResponse.json(result.character);
    }
    return NextResponse.json({ error: "No character found" }, { status: 404 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("Missing SUPABASE")) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 503 }
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Database error", details: msg },
      { status: 500 }
    );
  }
}
