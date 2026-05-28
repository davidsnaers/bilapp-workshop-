import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await supabase
    .from("workshops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workshop) redirect("/onboarding");

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  const { data: bookings } = await (supabase as any)
    .from("bookings_workshop")
    .select("*, service:service_id(name_is)")
    .eq("workshop_id", workshop.id)
    .gte("start_time", from.toISOString())
    .lte("start_time", to.toISOString())
    .order("start_time", { ascending: true });

  const { data: services } = await (supabase as any)
    .from("workshop_services")
    .select("*, service:service_id(id, name_is, default_duration_minutes)")
    .eq("workshop_id", workshop.id);

  const { data: workshopHours } = await (supabase as any)
    .from("workshop_hours")
    .select("*")
    .eq("workshop_id", workshop.id);

  return (
    <CalendarClient
      workshop={workshop}
      bookings={bookings ?? []}
      services={services ?? []}
      workshopHours={workshopHours ?? []}
    />
  );
}
