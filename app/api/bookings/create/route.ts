// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { calculatePendingUntil } from "@/lib/pending-until";
import { sendSMS, SMS_TEMPLATES } from "@/lib/sms";
import { sendEmail, emailBookingReceived } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

const MONTHS_SHORT = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS_SHORT = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} kl. ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      workshop_id, user_id, car_id,
      service_id, service_label,
      customer_name, customer_phone, customer_plate,
      customer_car_make, customer_car_model, customer_car_year,
      start_time, duration_minutes,
      source, customer_notes,
    } = body;

    if (!workshop_id) return NextResponse.json({ error: "workshop_id required" }, { status: 400 });
    if (!start_time)  return NextResponse.json({ error: "start_time required" },  { status: 400 });

    const supabase = await createSupabaseServiceClient();

    // Check for double booking — same workshop, same time slot, not cancelled
    const slotStart = new Date(start_time);
    const slotEnd   = new Date(slotStart.getTime() + (duration_minutes ?? 60) * 60000);

    const { data: existing } = await (supabase as any)
      .from("bookings_workshop")
      .select("id, start_time, duration_minutes")
      .eq("workshop_id", workshop_id)
      .not("status", "in", '("declined","cancelled_by_user","cancelled_by_workshop","auto_cancelled")')
      .gte("start_time", new Date(slotStart.getTime() - (duration_minutes ?? 60) * 60000).toISOString())
      .lte("start_time", slotEnd.toISOString());

    // Check overlap
    const overlap = (existing ?? []).some((b: any) => {
      const bs = new Date(b.start_time).getTime();
      const be = bs + b.duration_minutes * 60000;
      return slotStart.getTime() < be && slotEnd.getTime() > bs;
    });

    if (overlap) {
      return NextResponse.json({ error: "Þessi tími er þegar bókaður" }, { status: 409 });
    }

    // Get workshop hours for pending_until
    const { data: hours } = await (supabase as any)
      .from("workshop_hours")
      .select("*")
      .eq("workshop_id", workshop_id);

    const pendingUntil = calculatePendingUntil(hours ?? []);

    // Create booking — only whitelist safe fields
    const { data: booking, error } = await (supabase as any)
      .from("bookings_workshop")
      .insert({
        workshop_id,
        user_id:            user_id ?? null,
        car_id:             car_id ?? null,
        service_id:         service_id ?? null,
        service_label:      service_label ?? null,
        customer_name:      customer_name ?? null,
        customer_phone:     customer_phone ?? null,
        customer_plate:     customer_plate ?? null,
        customer_car_make:  customer_car_make ?? null,
        customer_car_model: customer_car_model ?? null,
        customer_car_year:  customer_car_year ?? null,
        start_time,
        duration_minutes:   duration_minutes ?? 60,
        status:             "pending",
        source:             source ?? "web",
        customer_email:     body.customer_email ?? null,
        customer_notes:     customer_notes ?? null,
        pending_until:      pendingUntil.toISOString(),
      })
      .select("*, workshop:workshop_id(name, phone), service:service_id(name_is)")
      .single();

    if (error) throw error;

    const workshop = booking.workshop;
    const service  = booking.service;
    const dateStr  = formatDate(booking.start_time);

    // SMS to workshop owner only
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

    // Email to customer if they provided an email (web bookings)
    if (booking.customer_email) {
      const { subject, html } = emailBookingReceived({
        customerName: booking.customer_name ?? "Viðskiptavinur",
        workshopName: workshop?.name ?? "Verkstæðið",
        serviceName:  service?.name_is ?? booking.service_label ?? "Þjónusta",
        dateStr,
        plate:        booking.customer_plate ?? "—",
      });
      await sendEmail(booking.customer_email, subject, html);
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (e: any) {
    console.error("[create booking]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
