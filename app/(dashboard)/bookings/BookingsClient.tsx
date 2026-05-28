// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { BookingWorkshop } from "@/types/database";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_STYLE_LIGHT = { pending: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" }, confirmed: { bg: "#f0fdf4", border: "#86efac", color: "#166534" }, completed: { bg: "#f9fafb", border: "#e5e7eb", color: "#6b7280" }, declined: { bg: "#f9fafb", border: "#e5e7eb", color: "#9ca3af" }, cancelled_by_user: { bg: "#f9fafb", border: "#e5e7eb", color: "#9ca3af" }, cancelled_by_workshop: { bg: "#f9fafb", border: "#e5e7eb", color: "#9ca3af" }, auto_cancelled: { bg: "#f9fafb", border: "#e5e7eb", color: "#9ca3af" }, no_show: { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" } };
const STATUS_STYLE_DARK = { pending: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", color: "#fca5a5" }, confirmed: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "#86efac" }, completed: { bg: "#2e2e2e", border: "#3a3a3a", color: "#888" }, declined: { bg: "#2e2e2e", border: "#3a3a3a", color: "#666" }, cancelled_by_user: { bg: "#2e2e2e", border: "#3a3a3a", color: "#666" }, cancelled_by_workshop: { bg: "#2e2e2e", border: "#3a3a3a", color: "#666" }, auto_cancelled: { bg: "#2e2e2e", border: "#3a3a3a", color: "#666" }, no_show: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", color: "#fdba74" } };
const STATUS_LABEL = { pending: "Bíður", confirmed: "Staðfest", completed: "Lokið", declined: "Hafnað", cancelled_by_user: "Aflýst", cancelled_by_workshop: "Aflýst", auto_cancelled: "Sjálf-aflýst", no_show: "Mætti ekki" };

const MONTHS = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]} – ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formatEndTime(iso: string, mins: number): string {
  const d = new Date(new Date(iso).getTime() + mins * 60000);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// TABS: Allar, Bíður svar (urgent!), Staðfest, Lokið
const TABS = [
  { value: "",           label: "Allar" },
  { value: "pending",    label: "🔴 Bíður svars", urgent: true },
  { value: "confirmed",  label: "Staðfest" },
  { value: "completed",  label: "Lokið" },
];

interface Props {
  bookings: (BookingWorkshop & { service?: { name_is: string } | null })[];
  workshopId: string;
  activeStatus: string;
}

export default function BookingsClient({ bookings, workshopId, activeStatus }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg      = isDark ? "#1e1e1e" : "#f9fafb";
  const surface = isDark ? "#252525" : "#ffffff";
  const border  = isDark ? "#2e2e2e" : "#e5e7eb";
  const text    = isDark ? "#f4f4f4" : "#111827";
  const muted   = isDark ? "#888"    : "#6b7280";
  const subsurf = isDark ? "#2e2e2e" : "#f9fafb";
  const amber   = isDark ? "#E8A800" : "#F5B301";

  const [selected, setSelected] = useState<BookingWorkshop | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [workshopNotes, setWorkshopNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  const getStatusStyle = (status: string) => isDark ? (STATUS_STYLE_DARK[status] ?? STATUS_STYLE_DARK.completed) : (STATUS_STYLE_LIGHT[status] ?? STATUS_STYLE_LIGHT.completed);

  const openBooking = (b: BookingWorkshop) => {
    setSelected(b);
    setWorkshopNotes(b.workshop_notes ?? "");
    setShowDeclineInput(false);
    setDeclineReason("");
    setEditingNotes(false);
  };

  const handleAction = async (action: "confirm" | "decline" | "complete" | "no_show") => {
    if (!selected) return;
    setActionLoading(true);
    try {
      if (action === "confirm") {
        const res = await fetch("/api/bookings/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: selected.id }) });
        if (!res.ok) throw new Error("Staðfesting mistókst");
      } else if (action === "decline") {
        if (!declineReason.trim()) { alert("Skrifaðu ástæðu fyrir höfnun."); setActionLoading(false); return; }
        const res = await fetch("/api/bookings/decline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: selected.id, decline_reason: declineReason }) });
        if (!res.ok) throw new Error("Höfnun mistókst");
      } else {
        await (supabase as any).from("bookings_workshop").update({ status: action === "complete" ? "completed" : "no_show" }).eq("id", selected.id);
      }
      setSelected(null); setDeclineReason(""); setShowDeclineInput(false);
      router.refresh();
    } catch (e: any) { alert(e.message ?? "Villa"); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm("Eyða þessari bókun?")) return;
    await (supabase as any).from("bookings_workshop").delete().eq("id", selected.id);
    setSelected(null);
    router.refresh();
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await (supabase as any).from("bookings_workshop").update({ workshop_notes: workshopNotes }).eq("id", selected.id);
      setEditingNotes(false); router.refresh();
    } finally { setActionLoading(false); }
  };

  const pendingCount = bookings.filter(b => b.status === "pending").length;

  // Sort by start_time ascending (next up at top)
  const sorted = [...bookings].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: bg, color: text }}>

      {/* Header */}
      <div style={{ padding: "18px 24px 0", borderBottom: `1px solid ${border}`, background: surface }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: text }}>Bókanir</h1>
            <p style={{ fontSize: 13, color: muted, margin: "2px 0 0" }}>
              {bookings.length} bókun{bookings.length !== 1 ? "ar" : ""}
              {pendingCount > 0 && (
                <span style={{ marginLeft: 8, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`, color: isDark ? "#fca5a5" : "#991b1b" }}>
                  ⚠️ {pendingCount} bíður svars
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map(tab => {
            const active = activeStatus === tab.value;
            const isUrgent = tab.urgent && pendingCount > 0;
            return (
              <a key={tab.value} href={tab.value ? `/bookings?status=${tab.value}` : "/bookings"} style={{
                padding: "7px 16px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: active ? 700 : 600,
                textDecoration: "none",
                border: `1px solid ${active ? border : isUrgent ? "rgba(239,68,68,0.4)" : "transparent"}`,
                borderBottom: active ? `1px solid ${surface}` : isUrgent ? "none" : "1px solid transparent",
                background: active ? surface : isUrgent ? (isDark ? "rgba(239,68,68,0.15)" : "#fef2f2") : "transparent",
                color: active ? text : isUrgent ? (isDark ? "#fca5a5" : "#991b1b") : muted,
                marginBottom: -1,
              }}>
                {tab.label}
                {tab.urgent && pendingCount > 0 && (
                  <span style={{ marginLeft: 6, background: "#ef4444", color: "white", borderRadius: 999, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>{pendingCount}</span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* List — sorted by time, next up first */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {sorted.length === 0 && (
          <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "64px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>📋</p>
            <p style={{ fontWeight: 700, color: text, margin: 0 }}>Engar bókanir</p>
            <p style={{ fontSize: 13, color: muted, margin: "4px 0 0" }}>{activeStatus === "pending" ? "Engar bókanir bíða svars" : "Engar bókanir fundust"}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(booking => {
            const ss = getStatusStyle(booking.status);
            const isPending = booking.status === "pending";
            const startTime = new Date(booking.start_time);
            const endTimeStr = formatEndTime(booking.start_time, booking.duration_minutes);

            return (
              <button key={booking.id} onClick={() => openBooking(booking)} style={{
                textAlign: "left", background: surface, borderRadius: 16,
                border: `1px solid ${isPending ? (isDark ? "rgba(239,68,68,0.5)" : "#fecaca") : border}`,
                padding: "14px 16px", cursor: "pointer", width: "100%", color: text,
                boxShadow: isPending ? `0 0 0 1px ${isDark ? "rgba(239,68,68,0.2)" : "#fecaca"}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: text }}>{booking.customer_name ?? "Óþekktur viðskiptavinur"}</span>
                      <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}>{STATUS_LABEL[booking.status] ?? booking.status}</span>
                      {booking.source === "manual" && <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: subsurf, border: `1px solid ${border}`, color: muted }}>Handvirk</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 13, color: muted, marginBottom: 6 }}>
                      {booking.customer_plate && <span>🚗 {booking.customer_plate}</span>}
                      {(booking.customer_car_make || booking.customer_car_model) && <span>{[booking.customer_car_make, booking.customer_car_model, booking.customer_car_year].filter(Boolean).join(" ")}</span>}
                      {booking.customer_phone && <span>📞 {booking.customer_phone}</span>}
                    </div>
                    {((booking as any).service?.name_is ?? booking.service_label) && (
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: isDark ? "rgba(232,168,0,0.15)" : "#fffbeb", border: `1px solid ${isDark ? "rgba(232,168,0,0.3)" : "#fde68a"}`, color: isDark ? "#E8A800" : "#92400e" }}>
                        {(booking as any).service?.name_is ?? booking.service_label}
                      </span>
                    )}
                    {booking.customer_notes && <p style={{ fontSize: 12, color: muted, fontStyle: "italic", margin: "6px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{booking.customer_notes}"</p>}
                  </div>

                  {/* Time — show start–end */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: text, margin: 0 }}>{WEEKDAYS[startTime.getDay()]} {startTime.getDate()}. {MONTHS[startTime.getMonth()]}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: amber, margin: "2px 0 0" }}>
                      {String(startTime.getHours()).padStart(2,"0")}:{String(startTime.getMinutes()).padStart(2,"0")} – {endTimeStr}
                    </p>
                    <p style={{ fontSize: 11, color: muted, margin: "2px 0 0" }}>{booking.duration_minutes} mín</p>
                  </div>
                </div>

                {/* Pending quick actions */}
                {isPending && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "#fee2e2"}`, display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button onClick={e => { e.stopPropagation(); openBooking(booking); }} style={{ flex: 1, padding: "7px 0", borderRadius: 10, border: "none", background: "#22c55e", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Staðfesta</button>
                    <button onClick={e => { e.stopPropagation(); openBooking(booking); }} style={{ flex: 1, padding: "7px 0", borderRadius: 10, border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Hafna</button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}>
          <div style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 480, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  {(() => { const ss = getStatusStyle(selected.status); return <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}>{STATUS_LABEL[selected.status] ?? selected.status}</span>; })()}
                  {selected.source === "manual" && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: subsurf, border: `1px solid ${border}`, color: muted }}>Handvirk bókun</span>}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>{selected.customer_name ?? "Óþekktur viðskiptavinur"}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 30, height: 30, borderRadius: 10, border: `1px solid ${border}`, background: subsurf, color: muted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Tími", value: `${String(new Date(selected.start_time).getHours()).padStart(2,"0")}:${String(new Date(selected.start_time).getMinutes()).padStart(2,"0")} – ${formatEndTime(selected.start_time, selected.duration_minutes)}` },
                  { label: "Lengd", value: `${selected.duration_minutes} mín` },
                  selected.customer_phone ? { label: "Sími", value: selected.customer_phone } : null,
                  selected.customer_plate ? { label: "Bílnúmer", value: selected.customer_plate } : null,
                  (selected.customer_car_make || selected.customer_car_model) ? { label: "Bíll", value: [selected.customer_car_make, selected.customer_car_model, selected.customer_car_year].filter(Boolean).join(" ") } : null,
                  { label: "Þjónusta", value: (selected as any).service?.name_is ?? selected.service_label ?? "—" },
                ].filter((x): x is { label: string; value: string } => Boolean(x)).map(({ label, value }) => (
                  <div key={label} style={{ background: subsurf, borderRadius: 10, padding: "8px 10px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: text, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {selected.customer_notes && (
                <div style={{ background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"}`, borderRadius: 12, padding: "10px 12px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Athugasemdir viðskiptavinar</p>
                  <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af", fontStyle: "italic", margin: 0 }}>"{selected.customer_notes}"</p>
                </div>
              )}

              <div style={{ background: subsurf, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>Athugasemdir verkstæðis</p>
                  {!editingNotes && <button onClick={() => setEditingNotes(true)} style={{ fontSize: 11, fontWeight: 700, color: amber, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Breyta</button>}
                </div>
                {editingNotes ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <textarea value={workshopNotes} onChange={e => setWorkshopNotes(e.target.value)} rows={3} style={{ width: "100%", borderRadius: 10, border: `1px solid ${border}`, background: isDark ? "#1e1e1e" : "white", color: text, padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={handleSaveNotes} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: amber, color: "#111", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Vista</button>
                      <button onClick={() => { setEditingNotes(false); setWorkshopNotes(selected.workshop_notes ?? ""); }} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Hætta við</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: selected.workshop_notes ? text : muted, fontStyle: selected.workshop_notes ? "normal" : "italic", margin: 0 }}>{selected.workshop_notes || "Engar athugasemdir"}</p>
                )}
              </div>

              {showDeclineInput && (
                <div style={{ background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, borderRadius: 12, padding: "10px 12px" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: isDark ? "#fca5a5" : "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Ástæða höfnunar *</label>
                  <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="T.d. fullbókað..." style={{ width: "100%", borderRadius: 10, border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, background: isDark ? "#1e1e1e" : "white", color: text, padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
                </div>
              )}
            </div>

            <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.status === "pending" && !showDeclineInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction("confirm")} disabled={actionLoading} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓ Staðfesta</button>
                  <button onClick={() => setShowDeclineInput(true)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Hafna</button>
                </div>
              )}
              {selected.status === "pending" && showDeclineInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction("decline")} disabled={actionLoading || !declineReason.trim()} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "#ef4444", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: declineReason.trim() ? 1 : 0.5 }}>{actionLoading ? "Vista..." : "Senda höfnun"}</button>
                  <button onClick={() => { setShowDeclineInput(false); setDeclineReason(""); }} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${border}`, background: subsurf, color: muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Hætta við</button>
                </div>
              )}
              {selected.status === "confirmed" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction("complete")} disabled={actionLoading} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: isDark ? "#333" : "#111", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓ Merkja sem lokið</button>
                  <button onClick={() => handleAction("no_show")} disabled={actionLoading} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, background: isDark ? "rgba(249,115,22,0.1)" : "#fff7ed", color: isDark ? "#fdba74" : "#9a3412", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Mætti ekki</button>
                </div>
              )}
              {/* Delete — only for manual bookings */}
              {selected.source === "manual" && (
                <button onClick={handleDelete} style={{ width: "100%", padding: "9px 0", borderRadius: 12, border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, background: "transparent", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑 Eyða bókun</button>
              )}
              <button onClick={() => setSelected(null)} style={{ width: "100%", padding: "9px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Loka</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
