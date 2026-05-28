// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DAYS = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];

const DEFAULT_HOURS = DAYS.map((_, i) => ({
  day_of_week: i,
  open_time: "09:00",
  close_time: "17:00",
  is_closed: i === 0 || i === 6,
}));

const SERVICES_IS = [
  "Smurning og þjónustuskoðun",
  "Dekkjaskipti",
  "Almenn bifreiðaskoðun",
  "Bremsuskipti",
  "Þrif",
  "Þarf greiningu",
  "Annað",
];

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [bookingMode, setBookingMode] = useState<"day_based" | "time_based">("day_based");
  const [maxCarsPerDay, setMaxCarsPerDay] = useState(5);
  const [parallelSlots, setParallelSlots] = useState(1);

  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [selectedServices, setSelectedServices] = useState<string[]>([
    "Smurning og þjónustuskoðun",
    "Dekkjaskipti",
    "Almenn bifreiðaskoðun",
  ]);

  const toggleService = (name: string) => {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const updateHour = (index: number, field: string, value: string | boolean) => {
    setHours((prev) => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Notandi fannst ekki");

      const { data: workshop, error: workshopError } = await (supabase as any)
        .from("workshops")
        .insert({
          owner_id: user.id,
          name,
          address,
          phone,
          email,
          booking_mode: bookingMode,
          max_cars_per_day: maxCarsPerDay,
          parallel_slots: parallelSlots,
          status: "active",
        })
        .select()
        .single();

      if (workshopError) throw workshopError;

      await (supabase as any).from("workshop_hours").insert(
        hours.map((h) => ({ ...h, workshop_id: workshop.id }))
      );

      const { data: services } = await (supabase as any)
        .from("services")
        .select("id, name_is")
        .in("name_is", selectedServices);

      if (services?.length) {
        await (supabase as any).from("workshop_services").insert(
          services.map((s: any) => ({ workshop_id: workshop.id, service_id: s.id }))
        );
      }

      router.push("/calendar");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Eitthvað fór úrskeiðis");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-xl font-black shadow-lg mb-4">B</div>
          <h1 className="text-2xl font-black text-gray-900">Uppsetning verkstæðis</h1>
          <p className="text-sm text-gray-500 mt-1">Skref {step} af 4</p>
          <div className="mt-4 flex gap-1.5 justify-center">
            {[1,2,3,4].map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-all ${s <= step ? "bg-amber-400" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-black text-gray-900">Grunnupplýsingar</h2>
              {[
                { label: "Nafn verkstæðis", value: name, setter: setName, placeholder: "T.d. Bílsmiðjan ehf." },
                { label: "Heimilisfang", value: address, setter: setAddress, placeholder: "T.d. Ármúli 5, 108 Reykjavík" },
                { label: "Símanúmer", value: phone, setter: setPhone, placeholder: "T.d. 555-1234" },
                { label: "Netfang", value: email, setter: setEmail, placeholder: "verkstaedi@bilapp.is", type: "email" },
              ].map(({ label, value, setter, placeholder, type }) => (
                <div key={label}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                  <input type={type ?? "text"} value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-lg font-black text-gray-900">Bókunarhamur</h2>
              <div className="flex flex-col gap-3">
                {[
                  { value: "day_based", label: "Dagsbókanir", desc: "Þið takið við X bílum á dag án ákveðins tíma" },
                  { value: "time_based", label: "Tímabókanir", desc: "Viðskiptavinir velja nákvæman tíma" },
                ].map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setBookingMode(opt.value as "day_based" | "time_based")}
                    className={`text-left rounded-xl border p-4 transition ${bookingMode === opt.value ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <p className="font-black text-gray-900 text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {bookingMode === "day_based" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hámarksbílar á dag</label>
                  <input type="number" min={1} max={50} value={maxCarsPerDay}
                    onChange={(e) => setMaxCarsPerDay(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
                </div>
              )}
              {bookingMode === "time_based" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Samhliða bókanir (1-4)</label>
                  <input type="number" min={1} max={4} value={parallelSlots}
                    onChange={(e) => setParallelSlots(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-black text-gray-900">Opnunartímar</h2>
              <div className="flex flex-col gap-2">
                {hours.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-28 text-sm font-semibold text-gray-700">{DAYS[i]}</div>
                    <input type="checkbox" checked={!h.is_closed}
                      onChange={(e) => updateHour(i, "is_closed", !e.target.checked)}
                      className="h-4 w-4 rounded accent-amber-400" />
                    {!h.is_closed ? (
                      <>
                        <input type="time" value={h.open_time} onChange={(e) => updateHour(i, "open_time", e.target.value)}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none" />
                        <span className="text-gray-400 text-sm">–</span>
                        <input type="time" value={h.close_time} onChange={(e) => updateHour(i, "close_time", e.target.value)}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none" />
                      </>
                    ) : (
                      <span className="text-sm text-gray-400 font-medium">Lokað</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-black text-gray-900">Þjónustur</h2>
              <p className="text-sm text-gray-500">Veldu þær þjónustur sem verkstæðið þitt býður upp á.</p>
              <div className="flex flex-col gap-2">
                {SERVICES_IS.map((service) => {
                  const selected = selectedServices.includes(service);
                  return (
                    <button key={service} type="button" onClick={() => toggleService(service)}
                      className={`text-left rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        selected ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}>
                      {selected ? "✓ " : ""}{service}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
          )}

          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button type="button" onClick={() => setStep((s) => (s - 1) as Step)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-black text-gray-700 hover:bg-gray-50 transition">
                ← Til baka
              </button>
            )}
            {step < 4 ? (
              <button type="button" onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={step === 1 && (!name || !address || !phone || !email)}
                className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-black text-gray-900 hover:bg-amber-500 transition disabled:opacity-50">
                Áfram →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit}
                disabled={saving || selectedServices.length === 0}
                className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-black text-white hover:bg-gray-800 transition disabled:opacity-50">
                {saving ? "Vista..." : "Ljúka uppsetningu"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
