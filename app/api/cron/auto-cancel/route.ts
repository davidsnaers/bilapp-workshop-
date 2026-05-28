// @ts-nocheck
// This route is called by Vercel Cron every 15 minutes
// Add to vercel.json:
// {
//   "crons": [{ "path": "/api/cron/auto-cancel", "schedule": "*/15 * * * *" }]
// }

import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Protect with a secret token
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceClient();
  const now = new Date().toISOString();

  // Find all pending bookings past their deadline
  const { data: overdueBookings, error } = await supabase
    .from("bookings_workshop" as any)
    .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
    .eq("status", "pending")
    .lt("pending_until", now)
    .not("pending_until", "is", null);

  if (error) {
    console.error("[auto-cancel] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!overdueBookings?.length) {
    return NextResponse.json({ cancelled: 0 });
  }

  const results = await Promise.allSettled(
    overdueBookings.map(async (booking: any) => {
      // Cancel the booking
      await supabase
        .from("bookings_workshop" as any)
        .update({ status: "auto_cancelled", pending_until: null })
        .eq("id", booking.id);

      // Log event
      await (supabase as any).from("booking_events" as any).insert({
        workshop_booking_id: booking.id,
        event_type: "auto_cancelled",
        actor_type: "system",
        metadata: { reason: "pending_until exceeded" },
      });

      // SMS to customer
      if (booking.customer_phone) {
        await sendSMS(
          booking.customer_phone,
          SMS_TEMPLATES.customerAutoCancelled(
            booking.workshop?.name ?? "Verkstæðið"
          )
        );
      }

      // Log notification
      await (supabase as any).from("notifications_log" as any).insert({
        booking_id: booking.id,
        recipient_type: "customer",
        channel: "sms",
        message: "Auto-cancel notification",
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      console.log(`[auto-cancel] Cancelled booking ${booking.id}`);
      return booking.id;
    })
  );

  const cancelled = results.filter(r => r.status === "fulfilled").length;
  console.log(`[auto-cancel] Cancelled ${cancelled} bookings`);

  return NextResponse.json({ cancelled, total: overdueBookings.length });
}
