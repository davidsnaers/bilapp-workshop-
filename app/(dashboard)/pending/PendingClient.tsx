// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MONTHS = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];

function formatDateTime(iso: string, durationMins: number): string {
  const d = new Date(iso);
  const end = new Date(d.getTime() + durationMins * 60000);
  const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  const endTime = `${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]} · ${time}–${endTime}`;
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

  const handleConfirm = async (bookingId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      if (!res.ok) throw new Error("Staðfesting mistókst");
      setSelected(null);
      router.refresh();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleDecline = async (bookingId: string) => {
    if (!declineReason.trim()) { alert("Skrifaðu ástæðu."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/bookings/decline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, decline_reason: declineReason }),
      });
      if (!res.ok) throw new Error("Höfnun mistókst");
      setSelected(null); setDeclineReason(""); setShowDecline(false);
      router.refresh();
    } catch(e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

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
                <span style={{ fontSize: 11, color: muted }}>{formatDateTime(booking.start_time, booking.duration_minutes)}</span>
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

                {/* Decline reason input */}
                {showDecline && selected?.id === booking.id && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ástæða höfnunar *</label>
                    <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={2}
                      placeholder="T.d. fullbókað, verk utan sérgreinar..."
                      style={{ width: "100%", borderRadius: 10, border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, background: isDark ? "#1a1a1a" : "white", color: text, padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  {showDecline && selected?.id === booking.id ? (
                    <>
                      <button onClick={() => handleDecline(booking.id)} disabled={loading || !declineReason.trim()}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: "#ef4444", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: declineReason.trim() ? 1 : 0.5 }}>
                        {loading ? "Vista..." : "Senda höfnun"}
                      </button>
                      <button onClick={() => { setShowDecline(false); setDeclineReason(""); setSelected(null); }}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Hætta við
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleConfirm(booking.id)} disabled={loading}
                        style={{ flex: 2, padding: "10px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✓ Staðfesta
                      </button>
                      <button onClick={() => { setSelected(booking); setShowDecline(true); }}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✕ Hafna
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
