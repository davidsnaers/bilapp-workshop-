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
    .from("workshops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workshop) redirect("/onboarding");

  const dateStr = params.date ?? new Date().toISOString().split("T")[0];
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Link href="/calendar" style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textDecoration: "none", display: "block", marginBottom: 4 }}>
            ← Til baka í dagatal
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{dayLabel}</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
            {(bookings ?? []).length} bókun{(bookings ?? []).length !== 1 ? "ar" : ""}
          </p>
        </div>
      </div>
      <DayBookingsClient bookings={bookings ?? []} workshopId={(workshop as any).id} dateStr={dateStr} />
    </div>
  );
}