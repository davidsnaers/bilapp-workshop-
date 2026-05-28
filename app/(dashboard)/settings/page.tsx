import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await supabase
    .from("workshops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workshop) redirect("/onboarding");

  const { data: hours } = await (supabase as any)
    .from("workshop_hours")
    .select("*")
    .eq("workshop_id", workshop.id)
    .order("day_of_week");

  const { data: blocks } = await (supabase as any)
    .from("workshop_blocks")
    .select("*")
    .eq("workshop_id", workshop.id)
    .gte("end_datetime", new Date().toISOString())
    .order("start_datetime", { ascending: true });

  const { data: workshopServices } = await (supabase as any)
    .from("workshop_services")
    .select("*, service:service_id(id, name_is, default_duration_minutes)")
    .eq("workshop_id", workshop.id);

  const { data: allServices } = await (supabase as any)
    .from("services")
    .select("id, name_is, default_duration_minutes")
    .eq("is_active", true);

  return (
    <SettingsClient
      workshop={workshop}
      hours={hours ?? []}
      blocks={blocks ?? []}
      workshopServices={workshopServices ?? []}
      allServices={allServices ?? []}
    />
  );
}
