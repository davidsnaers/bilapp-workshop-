// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { sendEmail, emailBookingDeclined } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { booking_id, decline_reason } = await req.json();
    if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });
    if (!decline_reason?.trim()) return NextResponse.json({ error: "decline_reason required" }, { status: 400 });

    const supabase = await createSupabaseServiceClient();

    const { data: booking, error } = await (supabase as any)
      .from("bookings_workshop")
      .update({ status: "declined", decline_reason, pending_until: null })
      .eq("id", booking_id)
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    // Non-critical notifications — never crash the response
    try {
      const workshop = booking.workshop;
      const service  = booking.service;

      if (booking.customer_phone) {
        await sendSMS(
          booking.customer_phone,
          SMS_TEMPLATES.customerDeclined(workshop?.name ?? "Verkstæðið", decline_reason)
        );
      }

      if (booking.customer_email) {
        const { subject, html } = emailBookingDeclined({
          customerName: booking.customer_name ?? "Viðskiptavinur",
          workshopName: workshop?.name ?? "Verkstæðið",
          serviceName:  service?.name_is ?? booking.service_label ?? "Þjónusta",
          reason:       decline_reason,
        });
        await sendEmail(booking.customer_email, subject, html);
      }
    } catch (notifError: any) {
      console.warn("[decline] notification failed:", notifError?.message);
    }

    return NextResponse.json({ ok: true, booking });
  } catch (e: any) {
    console.error("[decline]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
