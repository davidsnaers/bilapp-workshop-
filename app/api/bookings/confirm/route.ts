// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { NextRequest, NextResponse } from "next/server";

const MONTHS_SHORT  = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS_SHORT = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} kl. ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { booking_id, confirmed_time } = body;

    if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

    const supabase = await createSupabaseServiceClient();

    // Build update — optionally update start_time if workshop set a specific time
    const update: any = { status: "confirmed", pending_until: null };
    if (confirmed_time) {
      update.start_time = new Date(confirmed_time).toISOString();
    }

    const { data: booking, error } = await (supabase as any)
      .from("bookings_workshop")
      .update(update)
      .eq("id", booking_id)
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    const workshop = booking.workshop;
    const dateStr  = formatDate(booking.start_time);

    console.log("[confirm] booking", booking_id, "customer_phone:", booking.customer_phone);

    // SMS to workshop owner only — no SMS to customer on confirm
    // Customer sees status update in the app instead
    if (workshop?.phone) {
      await sendSMS(
        workshop.phone,
        `Bílapp: Þú staðfestir bókun frá ${booking.customer_name ?? "viðskiptavin"} — ${booking.service?.name_is ?? booking.service_label ?? "þjónusta"} ${dateStr}.`
      );
    }

    // Log event
    await (supabase as any).from("booking_events").insert({
      workshop_booking_id: booking_id,
      event_type: "confirmed",
      actor_type: "workshop",
      metadata: confirmed_time ? { confirmed_time } : null,
    });

    return NextResponse.json({ ok: true, booking });
  } catch (e: any) {
    console.error("[confirm]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
