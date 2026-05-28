// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Workshop } from "@/types/database";
import { useState } from "react";

interface Props {
  workshop: Workshop;
  defaultDate: Date;
  services: { service?: { id: string; name_is: string; default_duration_minutes: number } | null }[];
  onClose: () => void;
  onSaved: () => void;
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`;
}

export default function AddBookingModal({ workshop, defaultDate, services, onClose, onSaved }: Props) {
  const supabase = createSupabaseBrowserClient();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPlate, setCustomerPlate] = useState("");
  const [customerCarMake, setCustomerCarMake] = useState("");
  const [customerCarModel, setCustomerCarModel] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [startTime, setStartTime] = useState(toLocalDatetimeValue(defaultDate));
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const found = services.find((s) => s.service?.id === serviceId);
    if (found?.service) {
      setDuration(found.service.default_duration_minutes);
      setServiceLabel(found.service.name_is);
    }
  };

  const handleSave = async () => {
    if (!startTime) {
      setError("Tími er nauðsynlegur.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Notandi fannst ekki");

      const { error: insertError } = await supabase
        .from("bookings_workshop")
        .insert({
          workshop_id: workshop.id,
          user_id: null,
          car_id: null,
          service_id: selectedServiceId || null,
          service_label: serviceLabel || null,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          customer_plate: customerPlate.toUpperCase() || null,
          customer_car_make: customerCarMake || null,
          customer_car_model: customerCarModel || null,
          start_time: new Date(startTime).toISOString(),
          duration_minutes: duration,
          status: "confirmed",
          source: "manual",
          customer_notes: notes || null,
        });

      if (insertError) throw insertError;

      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Eitthvað fór úrskeiðis");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-black text-gray-900">Handvirk bókun</h2>
          <button onClick={onClose}
            className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Time — required */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1.5">
              Tími <span className="text-red-500">*</span>
            </label>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1.5">Lengd (mínútur)</label>
            <input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
          </div>

          {/* Service */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1.5">Þjónusta</label>
            <select value={selectedServiceId} onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20">
              <option value="">Veldu þjónustu...</option>
              {services.map((s) => s.service && (
                <option key={s.service.id} value={s.service.id}>{s.service.name_is}</option>
              ))}
            </select>
            {!selectedServiceId && (
              <input type="text" value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)}
                placeholder="Eða skrifaðu þjónustuheiti handvirkt"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
            )}
          </div>

          <div className="border-t border-gray-100 pt-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">Viðskiptavinur (valfrjálst)</p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Nafn", value: customerName, setter: setCustomerName, placeholder: "T.d. Jón Jónsson" },
                { label: "Símanúmer", value: customerPhone, setter: setCustomerPhone, placeholder: "T.d. 555-1234" },
                { label: "Bílnúmer", value: customerPlate, setter: setCustomerPlate, placeholder: "T.d. ABC-12" },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input type="text" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tegund</label>
                  <input type="text" value={customerCarMake} onChange={(e) => setCustomerCarMake(e.target.value)} placeholder="T.d. Toyota"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Módel</label>
                  <input type="text" value={customerCarModel} onChange={(e) => setCustomerCarModel(e.target.value)} placeholder="T.d. Corolla"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1.5">Athugasemdir</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="T.d. Bremsur, 3 klst, mánudagur 9:00"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none" />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 sticky bottom-0 bg-white pt-2 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-black text-gray-700 hover:bg-gray-50 transition">
            Hætta við
          </button>
          <button onClick={handleSave} disabled={saving || !startTime}
            className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-black text-gray-900 hover:bg-amber-500 transition disabled:opacity-50">
            {saving ? "Vista..." : "Vista bókun"}
          </button>
        </div>
      </div>
    </div>
  );
}
