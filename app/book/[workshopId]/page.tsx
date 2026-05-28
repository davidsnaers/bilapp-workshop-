// @ts-nocheck
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import BookingPageClient from "./BookingPageClient";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ workshopId: string }>;
}) {
  const { workshopId } = await params;
  const supabase = await createSupabaseServiceClient();

  const { data: workshop } = await (supabase as any)
    .from("workshops")
    .select("id, name, address, phone, email, booking_mode, max_cars_per_day, parallel_slots, status")
    .eq("id", workshopId)
    .eq("status", "active")
    .single();

  if (!workshop) notFound();

  const { data: services } = await (supabase as any)
    .from("workshop_services")
    .select("*, service:service_id(id, name_is, name_en, default_duration_minutes)")
    .eq("workshop_id", workshopId)
    .eq("is_active", true);

  const { data: hours } = await (supabase as any)
    .from("workshop_hours")
    .select("*")
    .eq("workshop_id", workshopId)
    .order("day_of_week");

  return (
    <BookingPageClient
      workshop={workshop}
      services={(services ?? []).filter((s: any) => s.service)}
      hours={hours ?? []}
    />
  );
}
