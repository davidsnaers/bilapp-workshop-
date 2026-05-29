// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { sendSMS } from "@/lib/sms";
import { sendEmail, emailBookingConfirmed } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

const MONTHS_SHORT   = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
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

    const update: any = { status: "confirmed", pending_until: null };
    if (confirmed_time) update.start_time = new Date(confirmed_time).toISOString();

    const { data: booking, error } = await (supabase as any)
      .from("bookings_workshop")
      .update(update)
      .eq("id", booking_id)
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    // Non-critical notifications — never crash the response
    try {
      const workshop = booking.workshop;
      const service  = booking.service;
      const dateStr  = formatDate(booking.start_time);

      if (workshop?.phone) {
        await sendSMS(
          workshop.phone,
          `Bílapp: Þú staðfestir bókun frá ${booking.customer_name ?? "viðskiptavin"} — ${service?.name_is ?? booking.service_label ?? "þjónusta"} ${dateStr}.`
        );
      }

      if (booking.customer_email) {
        const { subject, html } = emailBookingConfirmed({
          customerName:  booking.customer_name ?? "Viðskiptavinur",
          workshopName:  workshop?.name ?? "Verkstæðið",
          workshopPhone: workshop?.phone ?? "",
          serviceName:   service?.name_is ?? booking.service_label ?? "Þjónusta",
          dateStr,
          plate:         booking.customer_plate ?? "—",
        });
        await sendEmail(booking.customer_email, subject, html);
      }
    } catch (notifError: any) {
      console.warn("[confirm] notification failed:", notifError?.message);
    }

    return NextResponse.json({ ok: true, booking });
  } catch (e: any) {
    console.error("[confirm]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
