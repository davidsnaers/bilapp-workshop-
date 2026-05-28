// @ts-nocheck
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PendingClient from "./PendingClient";

export default async function PendingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await (supabase as any)
    .from("workshops").select("*").eq("owner_id", user.id).single();
  if (!workshop) redirect("/onboarding");

  const { data: bookings } = await (supabase as any)
    .from("bookings_workshop")
    .select("*, service:service_id(name_is)")
    .eq("workshop_id", workshop.id)
    .eq("status", "pending")
    .order("start_time", { ascending: true });

  return <PendingClient bookings={bookings ?? []} workshopId={workshop.id} />;
}
