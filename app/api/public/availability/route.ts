// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const workshopId = req.nextUrl.searchParams.get("workshop_id");
  if (!workshopId) return NextResponse.json({ error: "workshop_id required" }, { status: 400 });

  const supabase = await createSupabaseServiceClient();
  const now = new Date();
  const from = now.toISOString();
  const to   = new Date(now.getTime() + 30*24*60*60*1000).toISOString();

  const { data: bookings } = await (supabase as any)
    .from("bookings_workshop")
    .select("start_time, duration_minutes, status")
    .eq("workshop_id", workshopId)
    .gte("start_time", from)
    .lte("start_time", to)
    .not("status", "in", '("declined","cancelled_by_user","cancelled_by_workshop","auto_cancelled")');

  const { data: blocks } = await (supabase as any)
    .from("workshop_blocks")
    .select("start_datetime, end_datetime")
    .eq("workshop_id", workshopId)
    .gte("end_datetime", from);

  return NextResponse.json({ bookings: bookings ?? [], blocks: blocks ?? [] });
}
