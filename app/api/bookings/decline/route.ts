// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { booking_id, decline_reason } = await req.json();
    if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });
    if (!decline_reason?.trim()) return NextResponse.json({ error: "decline_reason required" }, { status: 400 });

    const supabase = await createSupabaseServiceClient();

    const { data: booking, error } = await supabase
      .from("bookings_workshop" as any)
      .update({ status: "declined", decline_reason, pending_until: null })
      .eq("id", booking_id)
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    const workshop = (booking as any).workshop;

    console.log("[decline] booking", booking_id, "customer_phone:", booking.customer_phone);

    if (booking.customer_phone) {
      const sent = await sendSMS(
        booking.customer_phone,
        SMS_TEMPLATES.customerDeclined(
          workshop?.name ?? "Verkstæðið",
          decline_reason
        )
      );
      console.log("[decline] SMS sent:", sent);
    }

    await (supabase as any).from("booking_events" as any).insert({
      workshop_booking_id: booking_id,
      event_type: "declined",
      actor_type: "workshop",
      metadata: { decline_reason },
    });

    return NextResponse.json({ ok: true, booking });
  } catch (e: any) {
    console.error("[decline]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
