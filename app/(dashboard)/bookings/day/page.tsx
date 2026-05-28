// @ts-nocheck
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DayBookingsClient from "./DayBookingsClient";

const WEEKDAYS = ["Sunnudagur","Mánudagur","Þriðjudagur","Miðvikudagur","Fimmtudagur","Föstudagur","Laugardagur"];
const MONTHS   = ["janúar","febrúar","mars","apríl","maí","júní","júlí","ágúst","september","október","nóvember","desember"];

export default async function DayBookingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await (supabase as any)
    .from("workshops").select("*").eq("owner_id", user.id).single();
  if (!workshop) redirect("/onboarding");

  const dateStr  = params.date ?? new Date().toISOString().split("T")[0];
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd   = new Date(`${dateStr}T23:59:59`);

  const { data: bookings } = await (supabase as any)
    .from("bookings_workshop")
    .select("*, service:service_id(name_is)")
    .eq("workshop_id", (workshop as any).id)
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString())
    .order("start_time", { ascending: true });

  const dayLabel = `${WEEKDAYS[dayStart.getDay()]}, ${dayStart.getDate()}. ${MONTHS[dayStart.getMonth()]} ${dayStart.getFullYear()}`;

  return (
    <DayBookingsClient
      bookings={bookings ?? []}
      workshopId={(workshop as any).id}
      dateStr={dateStr}
      dayLabel={dayLabel}
      bookingCount={(bookings ?? []).length}
    />
  );
}
