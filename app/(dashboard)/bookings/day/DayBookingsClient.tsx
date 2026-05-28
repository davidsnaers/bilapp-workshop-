"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { BookingWorkshop } from "@/types/database";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_STYLE: Record<string, string> = {
  pending:               "bg-red-100 border-red-200 text-red-700",
  confirmed:             "bg-green-100 border-green-200 text-green-700",
  completed:             "bg-gray-100 border-gray-200 text-gray-500",
  declined:              "bg-gray-100 border-gray-200 text-gray-400",
  cancelled_by_user:     "bg-gray-100 border-gray-200 text-gray-400",
  cancelled_by_workshop: "bg-gray-100 border-gray-200 text-gray-400",
  auto_cancelled:        "bg-gray-100 border-gray-200 text-gray-400",
  no_show:               "bg-orange-100 border-orange-200 text-orange-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending:               "Bíður",
  confirmed:             "Staðfest",
  completed:             "Lokið",
  declined:              "Hafnað",
  cancelled_by_user:     "Aflýst",
  cancelled_by_workshop: "Aflýst",
  auto_cancelled:        "Sjálf-aflýst",
  no_show:               "Mætti ekki",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

interface Props {
  bookings: (BookingWorkshop & { service?: { name_is: string } | null })[];
  workshopId: string;
  dateStr: string;
}

export default function DayBookingsClient({ bookings, workshopId, dateStr }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [selected, setSelected] = useState<BookingWorkshop | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: "confirm" | "decline" | "complete" | "no_show") => {
    if (!selected) return;
    setActionLoading(true);
    try {
      let update: Record<string, string> = {};
      if (action === "confirm") update = { status: "confirmed" };
      else if (action === "complete") update = { status: "completed" };
      else if (action === "no_show") update = { status: "no_show" };
      else if (action === "decline") {
        if (!declineReason.trim()) { alert("Skrifaðu ástæðu fyrir höfnun."); setActionLoading(false); return; }
        update = { status: "declined", decline_reason: declineReason };
      }
      await (supabase as any).from("bookings_workshop").update(update).eq("id", selected.id);
      setSelected(null);
      setDeclineReason("");
      setShowDeclineInput(false);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-black text-gray-900 text-lg">Engar bókanir þennan dag</p>
          <p className="text-sm text-gray-400 mt-1">Þennan dag eru engar bókanir skráðar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      {/* Timeline */}
      <div className="flex flex-col gap-3">
        {bookings.map((booking) => {
          const endTime = new Date(new Date(booking.start_time).getTime() + booking.duration_minutes * 60000);
          return (
            <button key={booking.id} onClick={() => { setSelected(booking); setShowDeclineInput(false); setDeclineReason(""); }}
              className={`w-full text-left rounded-2xl border p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md ${
                booking.status === "pending" ? "border-red-200 bg-red-50/30" : "bg-white border-gray-200"
              }`}>
              <div className="flex items-start gap-4">
                {/* Time column */}
                <div className="text-center shrink-0 w-14">
                  <p className="text-lg font-black text-gray-900">{formatTime(booking.start_time)}</p>
                  <p className="text-xs text-gray-400 font-medium">{formatTime(endTime.toISOString())}</p>
                  <p className="text-xs text-gray-400 mt-1">{booking.duration_minutes}m</p>
                </div>

                {/* Divider */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-3 h-3 rounded-full mt-1 ${
                    booking.status === "pending" ? "bg-red-400" :
                    booking.status === "confirmed" ? "bg-green-400" :
                    booking.status === "completed" ? "bg-gray-300" : "bg-gray-300"
                  }`} />
                  <div className="w-0.5 flex-1 bg-gray-100 mt-1" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-black text-gray-900">{booking.customer_name ?? "Óþekktur"}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[booking.status]}`}>
                      {STATUS_LABEL[booking.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                    {booking.customer_plate && <span>🚗 {booking.customer_plate}</span>}
                    {booking.customer_phone && <span>📞 {booking.customer_phone}</span>}
                  </div>
                  {((booking as any).service?.name_is ?? booking.service_label) && (
                    <p className="mt-1.5 inline-flex text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5">
                      {(booking as any).service?.name_is ?? booking.service_label}
                    </p>
                  )}
                  {booking.customer_notes && (
                    <p className="mt-1.5 text-xs text-gray-400 italic">"{booking.customer_notes}"</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
                <h2 className="text-xl font-black text-gray-900 mt-1">
                  {selected.customer_name ?? "Óþekktur viðskiptavinur"}
                </h2>
              </div>
              <button onClick={() => setSelected(null)}
                className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition">✕</button>
            </div>

            <div className="p-6 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Tími", value: `${formatTime(selected.start_time)} – ${formatTime(new Date(new Date(selected.start_time).getTime() + selected.duration_minutes * 60000).toISOString())}` },
                  { label: "Lengd", value: `${selected.duration_minutes} mínútur` },
                  selected.customer_phone ? { label: "Sími", value: selected.customer_phone } : null,
                  selected.customer_plate ? { label: "Bílnúmer", value: selected.customer_plate } : null,
                  (selected.customer_car_make || selected.customer_car_model) ? { label: "Bíll", value: [selected.customer_car_make, selected.customer_car_model, selected.customer_car_year].filter(Boolean).join(" ") } : null,
                  { label: "Þjónusta", value: (selected as any).service?.name_is ?? selected.service_label ?? "—" },
                ].filter(Boolean).map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="font-semibold text-gray-900 text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {selected.customer_notes && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-wide mb-1">Athugasemdir viðskiptavinar</p>
                  <p className="text-sm text-blue-800 italic">"{selected.customer_notes}"</p>
                </div>
              )}

              {showDeclineInput && (
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-wide mb-1.5">Ástæða höfnunar <span className="text-red-500">*</span></label>
                  <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3} placeholder="T.d. fullbókað..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-amber-400 focus:outline-none resize-none" />
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex flex-col gap-2">
              {selected.status === "pending" && !showDeclineInput && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction("confirm")} disabled={actionLoading}
                    className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-black text-white hover:bg-green-600 transition disabled:opacity-60">✓ Staðfesta</button>
                  <button onClick={() => setShowDeclineInput(true)}
                    className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-black text-red-600 hover:bg-red-50 transition">✕ Hafna</button>
                </div>
              )}
              {selected.status === "pending" && showDeclineInput && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction("decline")} disabled={actionLoading || !declineReason.trim()}
                    className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-black text-white hover:bg-red-600 transition disabled:opacity-60">
                    {actionLoading ? "Vista..." : "Senda höfnun"}</button>
                  <button onClick={() => { setShowDeclineInput(false); setDeclineReason(""); }}
                    className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-black text-gray-600 hover:bg-gray-50 transition">Hætta við</button>
                </div>
              )}
              {selected.status === "confirmed" && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction("complete")} disabled={actionLoading}
                    className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-black text-white hover:bg-gray-800 transition disabled:opacity-60">✓ Merkja sem lokið</button>
                  <button onClick={() => handleAction("no_show")} disabled={actionLoading}
                    className="flex-1 rounded-xl border border-orange-200 py-3 text-sm font-black text-orange-600 hover:bg-orange-50 transition disabled:opacity-60">Mætti ekki</button>
                </div>
              )}
              <button onClick={() => setSelected(null)}
                className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-black text-gray-500 hover:bg-gray-50 transition">Loka</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
