import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { marked } from "marked";

export async function GET() {
  try {
    const readmePath = path.join(process.cwd(), "README.md");
    if (!existsSync(readmePath)) {
      return NextResponse.json({ error: "README.md not found" }, { status: 404 });
    }
    const markdown = readFileSync(readmePath, "utf8");
    const html = await marked(markdown);
    return NextResponse.json({ html });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return NextResponse.json(
      { error: "Failed to read README.md", details: msg },
      { status: 500 }
    );
  }
}
