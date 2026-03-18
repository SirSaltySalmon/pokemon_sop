import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_interactions")
      .select("*")
      .eq("session_id", sessionId)
      .order("interacted_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return NextResponse.json(
      { error: "Database error", details: msg },
      { status: 500 }
    );
  }
}
