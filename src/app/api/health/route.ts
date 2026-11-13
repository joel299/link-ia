import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    return NextResponse.json({ ok: true, status: "healthy", db: "ok" });
  } catch {
    return NextResponse.json(
      { ok: false, status: "unhealthy", db: "error" },
      { status: 500 }
    );
  }
}
