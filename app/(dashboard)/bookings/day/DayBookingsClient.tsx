// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { BookingWorkshop } from "@/types/database";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MONTHS  = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formatEndTime(iso: string, mins: number): string {
  const d = new Date(new Date(iso).getTime() + mins * 60000);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Bíður", confirmed: "Staðfest", completed: "Lokið",
  declined: "Hafnað", cancelled_by_user: "Aflýst", cancelled_by_workshop: "Aflýst",
  auto_cancelled: "Sjálf-aflýst", no_show: "Mætti ekki",
};

interface Props {
  bookings: (BookingWorkshop & { service?: { name_is: string } | null })[];
  workshopId: string;
  dateStr: string;
  dayLabel: string;
  bookingCount: number;
}

export default function DayBookingsClient({ bookings, workshopId, dateStr, dayLabel, bookingCount }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg      = isDark ? "#1a1a1a" : "#FFFDF8";
  const surface = isDark ? "#222222" : "#ffffff";
  const border  = isDark ? "#2e2e2e" : "#f0e8d8";
  const text    = isDark ? "#f4f4f4" : "#1a1109";
  const muted   = isDark ? "#777"    : "#8b7355";
  const subsurf = isDark ? "#2a2a2a" : "#FFF8F0";
  const amber   = isDark ? "#E8A800" : "#F5B301";
  const amberBg = isDark ? "rgba(232,168,0,0.12)" : "#FFF0B8";

  const [selected, setSelected] = useState<BookingWorkshop | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: "confirm" | "decline" | "complete" | "no_show") => {
    if (!selected) return;
    setActionLoading(true);
    try {
      if (action === "confirm") {
        const res = await fetch("/api/bookings/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: selected.id }) });
        if (!res.ok) throw new Error("Staðfesting mistókst");
      } else if (action === "decline") {
        if (!declineReason.trim()) { alert("Skrifaðu ástæðu."); setActionLoading(false); return; }
        const res = await fetch("/api/bookings/decline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: selected.id, decline_reason: declineReason }) });
        if (!res.ok) throw new Error("Höfnun mistókst");
      } else {
        await (supabase as any).from("bookings_workshop").update({ status: action === "complete" ? "completed" : "no_show" }).eq("id", selected.id);
      }
      setSelected(null); setDeclineReason(""); setShowDeclineInput(false);
      router.refresh();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  const getStatusStyle = (status: string) => {
    if (status === "pending")   return { bg: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2", border: isDark ? "rgba(239,68,68,0.4)" : "#fecaca", color: isDark ? "#fca5a5" : "#991b1b" };
    if (status === "confirmed") return { bg: isDark ? "rgba(34,197,94,0.08)" : "#f0fdf4", border: isDark ? "rgba(34,197,94,0.3)" : "#86efac", color: isDark ? "#86efac" : "#166534" };
    if (status === "no_show")   return { bg: isDark ? "rgba(249,115,22,0.1)" : "#fff7ed", border: isDark ? "rgba(249,115,22,0.3)" : "#fed7aa", color: isDark ? "#fdba74" : "#9a3412" };
    return { bg: subsurf, border, color: muted };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: bg, color: text }}>

      {/* Header — themed */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${border}`, background: surface, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Link href="/calendar" style={{ fontSize: 12, fontWeight: 600, color: amber, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            ← Til baka í dagatal
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: text }}>{dayLabel}</h1>
          <p style={{ fontSize: 13, color: muted, margin: "2px 0 0" }}>
            {bookingCount} bókun{bookingCount !== 1 ? "ar" : ""}
          </p>
        </div>

        {/* Prev / Next day nav */}
        <div style={{ display: "flex", gap: 6 }}>
          {(() => {
            const d = new Date(dateStr);
            d.setDate(d.getDate() - 1);
            const prev = d.toISOString().split("T")[0];
            return (
              <Link href={`/bookings/day?date=${prev}`} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${border}`, background: amberBg, color: text, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>‹</Link>
            );
          })()}
          {(() => {
            const d = new Date(dateStr);
            d.setDate(d.getDate() + 1);
            const next = d.toISOString().split("T")[0];
            return (
              <Link href={`/bookings/day?date=${next}`} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${border}`, background: amberBg, color: text, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>›</Link>
            );
          })()}
        </div>
      </div>

      {/* Empty */}
      {bookings.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 10px" }}>📅</p>
            <p style={{ fontWeight: 700, color: text, fontSize: 16, margin: 0 }}>Engar bókanir þennan dag</p>
            <p style={{ fontSize: 13, color: muted, margin: "4px 0 0" }}>Þennan dag eru engar bókanir skráðar</p>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {bookings.map(booking => {
          const ss = getStatusStyle(booking.status);
          return (
            <button key={booking.id} onClick={() => { setSelected(booking); setShowDeclineInput(false); setDeclineReason(""); }}
              style={{ textAlign: "left", background: surface, borderRadius: 16, border: `1.5px solid ${booking.status === "pending" ? (isDark ? "rgba(239,68,68,0.4)" : "#fecaca") : border}`, padding: 0, cursor: "pointer", color: text, width: "100%", overflow: "hidden" }}>

              {/* Time bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: isDark ? "#252525" : "#FFF8F0", borderBottom: `1px solid ${border}` }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: amber, margin: 0 }}>{formatTime(booking.start_time)}</p>
                  <p style={{ fontSize: 11, color: muted, margin: 0 }}>–{formatEndTime(booking.start_time, booking.duration_minutes)}</p>
                </div>
                <div style={{ width: 2, height: 32, background: isDark ? "#333" : "#e8dcc8", borderRadius: 999 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>{booking.customer_name ?? "Óþekktur viðskiptavinur"}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 12, color: muted, marginTop: 2 }}>
                    {booking.customer_plate && <span>🚗 {booking.customer_plate}</span>}
                    {booking.customer_phone && <span>📞 {booking.customer_phone}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}>
                    {STATUS_LABEL[booking.status] ?? booking.status}
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>{booking.duration_minutes} mín</span>
                </div>
              </div>

              {/* Service + notes */}
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                {((booking as any).service?.name_is || booking.service_label) && (
                  <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: amberBg, border: `1px solid ${isDark ? "rgba(232,168,0,0.3)" : "#fde68a"}`, color: isDark ? amber : "#7a4f00" }}>
                    {(booking as any).service?.name_is ?? booking.service_label}
                  </span>
                )}
                {booking.customer_notes && (
                  <p style={{ fontSize: 12, color: muted, fontStyle: "italic", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{booking.customer_notes}"</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}>
          <div style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 440, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                {(() => { const ss = getStatusStyle(selected.status); return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color, marginBottom: 6 }}>{STATUS_LABEL[selected.status]}</span>; })()}
                <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>{selected.customer_name ?? "Óþekktur viðskiptavinur"}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 9, border: `1px solid ${border}`, background: subsurf, color: muted, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Tími", value: `${formatTime(selected.start_time)} – ${formatEndTime(selected.start_time, selected.duration_minutes)}` },
                  { label: "Lengd", value: `${selected.duration_minutes} mín` },
                  selected.customer_phone ? { label: "Sími", value: selected.customer_phone } : null,
                  selected.customer_plate ? { label: "Bílnúmer", value: selected.customer_plate } : null,
                  (selected.customer_car_make || selected.customer_car_model) ? { label: "Bíll", value: [selected.customer_car_make, selected.customer_car_model, selected.customer_car_year].filter(Boolean).join(" ") } : null,
                  { label: "Þjónusta", value: (selected as any).service?.name_is ?? selected.service_label ?? "—" },
                ].filter((x): x is { label: string; value: string } => Boolean(x)).map(({ label, value }) => (
                  <div key={label} style={{ background: amberBg, borderRadius: 10, padding: "8px 10px", border: `1px solid ${isDark ? "rgba(232,168,0,0.2)" : "#fde68a44"}` }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: text, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {selected.customer_notes && (
                <div style={{ background: isDark ? "rgba(59,130,246,0.08)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Athugasemdir viðskiptavinar</p>
                  <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af", fontStyle: "italic", margin: 0 }}>"{selected.customer_notes}"</p>
                </div>
              )}

              {showDeclineInput && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6 }}>Ástæða höfnunar *</label>
                  <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="T.d. fullbókað..." style={{ width: "100%", borderRadius: 10, border: `1px solid ${border}`, background: isDark ? "#1a1a1a" : "white", color: text, padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
                </div>
              )}
            </div>

            <div style={{ padding: "10px 18px 14px", borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.status === "pending" && !showDeclineInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction("confirm")} disabled={actionLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓ Staðfesta</button>
                  <button onClick={() => setShowDeclineInput(true)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Hafna</button>
                </div>
              )}
              {selected.status === "pending" && showDeclineInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction("decline")} disabled={actionLoading || !declineReason.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: "#ef4444", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: declineReason.trim() ? 1 : 0.5 }}>{actionLoading ? "Vista..." : "Senda höfnun"}</button>
                  <button onClick={() => { setShowDeclineInput(false); setDeclineReason(""); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Hætta við</button>
                </div>
              )}
              {selected.status === "confirmed" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction("complete")} disabled={actionLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: isDark ? "#333" : "#111", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓ Merkja sem lokið</button>
                  <button onClick={() => handleAction("no_show")} disabled={actionLoading} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, background: isDark ? "rgba(249,115,22,0.1)" : "#fff7ed", color: isDark ? "#fdba74" : "#9a3412", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Mætti ekki</button>
                </div>
              )}
              <button onClick={() => setSelected(null)} style={{ width: "100%", padding: "8px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Loka</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
