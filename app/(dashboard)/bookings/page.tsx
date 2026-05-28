// @ts-nocheck
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import BookingsClient from "./BookingsClient";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await supabase
    .from("workshops")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workshop) redirect("/onboarding");

  let query = (supabase as any)
    .from("bookings_workshop")
    .select("*, service:service_id(name_is)")
    .eq("workshop_id", workshop.id)
    .order("start_time", { ascending: false })
    .limit(100);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data: bookings } = await query;

  return (
    <BookingsClient
      bookings={bookings ?? []}
      workshopId={workshop.id}
      activeStatus={params.status ?? ""}
    />
  );
}
