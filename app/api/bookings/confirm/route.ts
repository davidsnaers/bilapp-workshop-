import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { NextRequest, NextResponse } from "next/server";

const MONTHS_SHORT = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS_SHORT = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} kl. ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export async function POST(req: NextRequest) {
  console.log("[confirm] *** ROUTE HIT ***");
  try {
    const { booking_id } = await req.json();
    console.log("[confirm] booking_id:", booking_id);
    if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

    const supabase = await createSupabaseServiceClient();

    // Update status
    const { data: booking, error } = await supabase
      .from("bookings_workshop" as any)
      .update({ status: "confirmed", pending_until: null })
      .eq("id", booking_id)
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    const workshop = (booking as any).workshop;
    const service  = (booking as any).service;
    const dateStr  = formatDate(booking.start_time);

    console.log("[confirm] booking", booking_id, "customer_phone:", booking.customer_phone);

    // SMS to customer
    if (booking.customer_phone) {
      const sent = await sendSMS(
        booking.customer_phone,
        SMS_TEMPLATES.customerConfirmed(
          workshop?.name ?? "Verkstæðið",
          service?.name_is ?? booking.service_label ?? "Þjónusta",
          dateStr,
          workshop?.phone ?? ""
        )
      );
      console.log("[confirm] SMS sent:", sent);
    } else {
      console.log("[confirm] No customer_phone on booking — skipping SMS");
    }

    // Log event
    await supabase.from("booking_events" as any).insert({
      workshop_booking_id: booking_id,
      event_type: "confirmed",
      actor_type: "workshop",
    });

    return NextResponse.json({ ok: true, booking });
  } catch (e: any) {
    console.error("[confirm]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
