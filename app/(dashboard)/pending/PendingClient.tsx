// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MONTHS = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];

function formatDateTime(iso: string, durationMins: number): string {
  const d   = new Date(iso);
  const end = new Date(d.getTime() + durationMins * 60000);
  const time    = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  const endTime = `${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]} · ${time}–${endTime}`;
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

function timeRemaining(pendingUntil: string | null): { label: string; urgent: boolean } {
  if (!pendingUntil) return { label: "Enginn frestur", urgent: false };
  const diff = new Date(pendingUntil).getTime() - Date.now();
  if (diff <= 0) return { label: "Frestur liðinn!", urgent: true };
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  if (hrs > 0) return { label: `${hrs} klst ${mins % 60} mín eftir`, urgent: hrs < 1 };
  return { label: `${mins} mín eftir`, urgent: mins < 30 };
}

// Check if a booking is day-based (time is 09:00 default)
function isDayBasedBooking(startTime: string): boolean {
  const d = new Date(startTime);
  return d.getHours() === 9 && d.getMinutes() === 0;
}

function pad(n: number): string { return String(n).padStart(2,"0"); }
const HOURS = Array.from({length:13},(_,i)=>i+7); // 07–19

export default function PendingClient({ bookings, workshopId }: { bookings: any[]; workshopId: string }) {
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

  const [selected, setSelected] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Time picker state for day-based confirm
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [confirmHour, setConfirmHour] = useState(9);
  const [confirmMin, setConfirmMin] = useState(0);

  const openConfirm = (booking: any) => {
    setSelected(booking);
    setShowDecline(false);
    setDeclineReason("");
    // Pre-fill with existing time
    const d = new Date(booking.start_time);
    setConfirmHour(d.getHours());
    setConfirmMin(d.getMinutes());
    // Show time picker for day-based bookings
    setShowTimePicker(isDayBasedBooking(booking.start_time));
  };

  const handleConfirm = async (bookingId: string, startTime: string) => {
    setLoading(true);
    try {
      // Build confirmed time from date + selected hour/min
      const baseDate = new Date(startTime);
      const confirmedDate = new Date(baseDate);
      confirmedDate.setHours(confirmHour, confirmMin, 0, 0);

      const res = await fetch("/api/bookings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          confirmed_time: confirmedDate.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Staðfesting mistókst");
      setSelected(null);
      setShowTimePicker(false);
      router.refresh();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleDecline = async (bookingId: string) => {
    if (!declineReason.trim()) { alert("Skrifaðu ástæðu."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, decline_reason: declineReason }),
      });
      if (!res.ok) throw new Error("Höfnun mistókst");
      setSelected(null); setDeclineReason(""); setShowDecline(false);
      router.refresh();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const selectStyle = {
    padding: "8px 12px", borderRadius: 10,
    border: `1px solid ${border}`, background: subsurf, color: text,
    fontSize: 16, fontWeight: 700, cursor: "pointer", outline: "none",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: bg, color: text }}>

      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${border}`, background: surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚠️</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: text }}>Bíður svars</h1>
            <p style={{ fontSize: 13, color: muted, margin: 0 }}>
              {bookings.length === 0 ? "Engar bókanir bíða svars" : `${bookings.length} bókun${bookings.length !== 1 ? "ar" : ""} þarf staðfestingu`}
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {bookings.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <p style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>Allt í lagi!</p>
          <p style={{ fontSize: 14, color: muted, margin: 0 }}>Engar bókanir bíða svars eins og er</p>
        </div>
      )}

      {/* Bookings list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {bookings.map((booking: any) => {
          const remaining = timeRemaining(booking.pending_until);
          const isDay = isDayBasedBooking(booking.start_time);

          return (
            <div key={booking.id} style={{
              background: surface, borderRadius: 16,
              border: `1.5px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`,
              overflow: "hidden",
              boxShadow: remaining.urgent ? `0 0 0 2px ${isDark ? "rgba(239,68,68,0.2)" : "#fee2e2"}` : "none",
            }}>
              {/* Urgency banner */}
              <div style={{ background: remaining.urgent ? (isDark ? "rgba(239,68,68,0.2)" : "#fef2f2") : (isDark ? "rgba(232,168,0,0.1)" : amberBg), padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "#fecaca"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{remaining.urgent ? "🔴" : "🟡"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: remaining.urgent ? (isDark ? "#fca5a5" : "#991b1b") : (isDark ? "#E8A800" : "#7a4f00") }}>
                    {remaining.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isDay && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: amberBg, border: `1px solid ${isDark ? "rgba(232,168,0,0.3)" : "#fde68a"}`, color: isDark ? amber : "#7a4f00", fontWeight: 700 }}>
                      Dagsbókun
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: muted }}>{formatDateOnly(booking.start_time)}</span>
                </div>
              </div>

              {/* Booking details */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: text, margin: "0 0 4px" }}>{booking.customer_name ?? "Óþekktur viðskiptavinur"}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", fontSize: 13, color: muted }}>
                      {booking.customer_plate && <span>🚗 {booking.customer_plate}</span>}
                      {(booking.customer_car_make || booking.customer_car_model) && <span>{[booking.customer_car_make, booking.customer_car_model].filter(Boolean).join(" ")}</span>}
                      {booking.customer_phone && <span>📞 {booking.customer_phone}</span>}
                    </div>
                  </div>
                  {(booking.service?.name_is || booking.service_label) && (
                    <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: amberBg, border: `1px solid ${isDark ? "rgba(232,168,0,0.3)" : "#fde68a"}`, color: isDark ? amber : "#7a4f00", flexShrink: 0 }}>
                      {booking.service?.name_is ?? booking.service_label}
                    </span>
                  )}
                </div>

                {booking.customer_notes && (
                  <div style={{ background: isDark ? "rgba(59,130,246,0.08)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: isDark ? "#93c5fd" : "#1e40af", fontStyle: "italic", margin: 0 }}>"{booking.customer_notes}"</p>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openConfirm(booking)}
                    style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {isDay ? "⏰ Velja tíma og staðfesta" : "✓ Staðfesta"}
                  </button>
                  <button onClick={() => { setSelected(booking); setShowDecline(true); setShowTimePicker(false); }}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ✕ Hafna
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal — with time picker for day-based */}
      {selected && !showDecline && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}>
          <div style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 420 }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${border}` }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>
                {showTimePicker ? "Veldu tíma fyrir viðskiptavin" : "Staðfesta bókun"}
              </h2>
              <p style={{ fontSize: 13, color: muted, margin: "4px 0 0" }}>
                {selected.customer_name ?? "Óþekktur"} · {selected.service?.name_is ?? selected.service_label ?? "Þjónusta"}
              </p>
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {showTimePicker && (
                <>
                  <p style={{ fontSize: 13, color: muted, margin: 0 }}>
                    {formatDateOnly(selected.start_time)} — veldu nákvæman tíma fyrir viðskiptavininn
                  </p>

                  {/* Time selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Klukkustund</label>
                      <select value={confirmHour} onChange={e => setConfirmHour(Number(e.target.value))} style={selectStyle}>
                        {HOURS.map(h => <option key={h} value={h}>{pad(h)}</option>)}
                      </select>
                    </div>
                    <span style={{ color: text, fontSize: 22, fontWeight: 700, marginTop: 20 }}>:</span>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Mínútur</label>
                      <select value={confirmMin} onChange={e => setConfirmMin(Number(e.target.value))} style={selectStyle}>
                        {[0,15,30,45].map(m => <option key={m} value={m}>{pad(m)}</option>)}
                      </select>
                    </div>
                    <div style={{ marginTop: 18 }}>
                      <p style={{ fontSize: 13, color: muted, margin: "0 0 4px" }}>Tími</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: amber, margin: 0 }}>{pad(confirmHour)}:{pad(confirmMin)}</p>
                    </div>
                  </div>

                  <div style={{ background: isDark ? "rgba(34,197,94,0.08)" : "#f0fdf4", border: `1px solid ${isDark ? "rgba(34,197,94,0.2)" : "#86efac"}`, borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ fontSize: 12, color: isDark ? "#86efac" : "#166534", margin: 0, fontWeight: 600 }}>
                      💡 Viðskiptavinurinn fær tímann {pad(confirmHour)}:{pad(confirmMin)} þegar þú staðfestir
                    </p>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleConfirm(selected.id, selected.start_time)} disabled={loading}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Vista..." : "✓ Staðfesta"}
                </button>
                <button onClick={() => { setSelected(null); setShowTimePicker(false); }}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Hætta við
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decline modal */}
      {selected && showDecline && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}>
          <div style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 420 }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${border}` }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>Hafna bókun</h2>
              <p style={{ fontSize: 13, color: muted, margin: "4px 0 0" }}>{selected.customer_name ?? "Óþekktur"}</p>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Ástæða höfnunar *</label>
                <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3}
                  placeholder="T.d. fullbókað, verk utan sérgreinar..."
                  style={{ width: "100%", borderRadius: 10, border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, background: isDark ? "#1a1a1a" : "white", color: text, padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ background: isDark ? "rgba(239,68,68,0.08)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "#fecaca"}`, borderRadius: 10, padding: "8px 12px" }}>
                <p style={{ fontSize: 12, color: isDark ? "#fca5a5" : "#991b1b", margin: 0, fontWeight: 600 }}>
                  💬 Viðskiptavinurinn fær SMS með ástæðu höfnunar
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleDecline(selected.id)} disabled={loading || !declineReason.trim()}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#ef4444", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: loading || !declineReason.trim() ? 0.5 : 1 }}>
                  {loading ? "Vista..." : "Senda höfnun"}
                </button>
                <button onClick={() => { setSelected(null); setShowDecline(false); setDeclineReason(""); }}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Hætta við
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
