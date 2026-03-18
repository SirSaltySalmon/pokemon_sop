import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import { getCharacterResults } from "@/lib/character-api";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const characterId = parseInt(id, 10);
    if (Number.isNaN(characterId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const supabase = getSupabase();
    const result = await getCharacterResults(supabase, characterId);
    if ("error" in result && result.status) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return NextResponse.json(
      { error: "Database error", details: msg },
      { status: 500 }
    );
  }
}
