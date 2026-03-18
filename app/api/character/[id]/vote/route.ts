import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import { postVote } from "@/lib/character-api";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const characterId = parseInt(id, 10);
    if (Number.isNaN(characterId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();
    const { sessionId, voteType } = body;
    if (!sessionId || typeof voteType !== "boolean") {
      return NextResponse.json(
        { error: "sessionId and voteType (boolean) required" },
        { status: 400 }
      );
    }
    const supabase = getSupabase();
    const out = await postVote(supabase, characterId, sessionId, voteType);
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return NextResponse.json(
      { error: "Database error", details: msg },
      { status: 500 }
    );
  }
}
