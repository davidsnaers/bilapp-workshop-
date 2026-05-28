// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { calculatePendingUntil } from "@/lib/pending-until";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createSupabaseServiceClient();

    // Get workshop hours for pending_until calculation
    const { data: hours } = await supabase
      .from("workshop_hours" as any)
      .select("*")
      .eq("workshop_id", body.workshop_id);

    const pendingUntil = calculatePendingUntil(hours ?? []);

    // Create booking
    const { data: booking, error } = await supabase
      .from("bookings_workshop" as any)
      .insert({
        ...body,
        status: "pending",
        pending_until: pendingUntil.toISOString(),
      })
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    const workshop = (booking as any).workshop;
    const service  = (booking as any).service;
    const dateStr  = new Date(booking.start_time).toLocaleDateString("is-IS", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

    // SMS to workshop
    if (workshop?.phone) {
      await sendSMS(
        workshop.phone,
        SMS_TEMPLATES.workshopNewBooking(
          booking.customer_name ?? "Óþekktur",
          service?.name_is ?? booking.service_label ?? "Þjónusta",
          dateStr
        )
      );
    }

    // SMS to customer
    if (booking.customer_phone) {
      await sendSMS(
        booking.customer_phone,
        SMS_TEMPLATES.customerBookingReceived(
          workshop?.name ?? "Verkstæði",
          service?.name_is ?? booking.service_label ?? "Þjónusta",
          dateStr
        )
      );
    }

    // Log notification
    await (supabase as any).from("notifications_log" as any).insert({
      booking_id: booking.id,
      recipient_type: "workshop",
      channel: "sms",
      message: "New booking notification",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (e: any) {
    console.error("[create booking]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
