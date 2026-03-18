import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tags")
      .select("name")
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data?.map((row) => row.name) ?? []);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return NextResponse.json(
      { error: "Database error", details: msg },
      { status: 500 }
    );
  }
}
