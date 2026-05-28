import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DayBookingsClient from "./DayBookingsClient";

const WEEKDAYS = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];
const MONTHS   = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export default async function DayBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await supabase
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
    .eq("workshop_id", workshop.id)
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString())
    .order("start_time", { ascending: true });

  const dayLabel = `${WEEKDAYS[dayStart.getDay()]}, ${dayStart.getDate()}. ${MONTHS[dayStart.getMonth()]} ${dayStart.getFullYear()}`;

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <Link href="/calendar" className="text-xs font-bold text-gray-400 hover:text-gray-600 transition mb-1 block">
            ← Til baka í dagatal
          </Link>
          <h1 className="text-2xl font-black text-gray-900">{dayLabel}</h1>
          <p className="text-sm text-gray-500 font-medium mt-0.5">
            {(bookings ?? []).length} bókun{(bookings ?? []).length !== 1 ? "ar" : ""}
          </p>
        </div>
      </div>

      <DayBookingsClient
        bookings={bookings ?? []}
        workshopId={workshop.id}
        dateStr={dateStr}
      />
    </div>
  );
}
