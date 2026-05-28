"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { Workshop } from "@/types/database";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DAYS_LONG = ["Sunnudagur","Mánudagur","Þriðjudagur","Miðvikudagur","Fimmtudagur","Föstudagur","Laugardagur"];
const MONTHS = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];

function formatBlockDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

type Tab = "info" | "hours" | "services" | "blocks";

interface Props {
  workshop: Workshop; hours: any[]; blocks: any[];
  workshopServices: any[]; allServices: any[];
}

export default function SettingsClient({ workshop, hours, blocks, workshopServices, allServices }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg      = isDark ? "#242424" : "#f9fafb";
  const surface = isDark ? "#2a2a2a" : "#ffffff";
  const border  = isDark ? "#3a3a3a" : "#e5e7eb";
  const text    = isDark ? "#f4f4f4" : "#111827";
  const muted   = isDark ? "#888"    : "#6b7280";
  const subsurf = isDark ? "#333"    : "#f9fafb";
  const amber   = isDark ? "#E8A800" : "#F5B301";

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${border}`, background: subsurf, color: text,
    fontSize: 13, outline: "none", boxSizing: "border-box" as const,
  };

  const [tab, setTab] = useState<Tab>("info");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const [name, setName] = useState(workshop.name);
  const [address, setAddress] = useState(workshop.address);
  const [phone, setPhone] = useState(workshop.phone);
  const [email, setEmail] = useState(workshop.email);
  const [maxCars, setMaxCars] = useState(workshop.max_cars_per_day);
  const [parallelSlots, setParallelSlots] = useState(workshop.parallel_slots);
  const [bookingMode, setBookingMode] = useState(workshop.booking_mode);

  const [editedHours, setEditedHours] = useState(
    hours.length > 0 ? hours : DAYS_LONG.map((_, i) => ({ day_of_week: i, open_time: "09:00", close_time: "17:00", is_closed: i === 0 || i === 6 }))
  );

  const [activeServiceIds, setActiveServiceIds] = useState<string[]>(
    workshopServices.filter((ws: any) => ws.is_active).map((ws: any) => ws.service?.id).filter(Boolean)
  );

  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  const saveInfo = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("workshops").update({ name, address, phone, email, max_cars_per_day: maxCars, parallel_slots: parallelSlots, booking_mode: bookingMode }).eq("id", workshop.id);
      if (error) throw error;
      showFeedback("Upplýsingar vistaðar ✓");
      router.refresh();
    } catch (e: any) { showFeedback(e?.message ?? "Villa", false); }
    finally { setSaving(false); }
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      const upsertData = editedHours.map((h: any) => ({ ...(h.id ? { id: h.id } : {}), workshop_id: workshop.id, day_of_week: h.day_of_week, open_time: h.is_closed ? null : h.open_time, close_time: h.is_closed ? null : h.close_time, is_closed: h.is_closed }));
      const { error } = await (supabase as any).from("workshop_hours").upsert(upsertData, { onConflict: "workshop_id,day_of_week" });
      if (error) throw error;
      showFeedback("Opnunartímar vistaðir ✓");
      router.refresh();
    } catch (e: any) { showFeedback(e?.message ?? "Villa", false); }
    finally { setSaving(false); }
  };

  const saveServices = async () => {
    setSaving(true);
    try {
      await (supabase as any).from("workshop_services").delete().eq("workshop_id", workshop.id);
      if (activeServiceIds.length > 0) await (supabase as any).from("workshop_services").insert(activeServiceIds.map(id => ({ workshop_id: workshop.id, service_id: id, is_active: true })));
      showFeedback("Þjónustur vistaðar ✓");
      router.refresh();
    } catch (e: any) { showFeedback(e?.message ?? "Villa", false); }
    finally { setSaving(false); }
  };

  const addBlock = async () => {
    if (!blockStart || !blockEnd) { showFeedback("Veldu upphafs- og lokadagsetningu", false); return; }
    if (new Date(blockEnd) <= new Date(blockStart)) { showFeedback("Lokadagsetning verður að vera á eftir upphafsdagsetningu", false); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("workshop_blocks").insert({ workshop_id: workshop.id, start_datetime: new Date(blockStart).toISOString(), end_datetime: new Date(blockEnd).toISOString(), reason: blockReason || null });
      if (error) throw error;
      setBlockStart(""); setBlockEnd(""); setBlockReason("");
      showFeedback("Lokun bætt við ✓");
      router.refresh();
    } catch (e: any) { showFeedback(e?.message ?? "Villa", false); }
    finally { setSaving(false); }
  };

  const deleteBlock = async (id: string) => {
    try {
      await (supabase as any).from("workshop_blocks").delete().eq("id", id);
      showFeedback("Lokun eytt ✓");
      router.refresh();
    } catch (e: any) { showFeedback(e?.message ?? "Villa", false); }
  };

  const TABS: { value: Tab; label: string; icon: string }[] = [
    { value: "info",     label: "Upplýsingar", icon: "🏪" },
    { value: "hours",    label: "Opnunartímar", icon: "🕐" },
    { value: "services", label: "Þjónustur",   icon: "🔧" },
    { value: "blocks",   label: "Lokanir",     icon: "🚫" },
  ];

  const btnPrimary = { padding: "11px 0", borderRadius: 12, border: "none", background: amber, color: "#111", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" } as const;
  const btnSecondary = { padding: "11px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: bg, color: text }}>

      {/* Header */}
      <div style={{ padding: "18px 24px 0", borderBottom: `1px solid ${border}`, background: surface }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 2px", color: text }}>Stillingar</h1>
        <p style={{ fontSize: 13, color: muted, margin: "0 0 14px" }}>{workshop.name}</p>
        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map(t => {
            const active = tab === t.value;
            return (
              <button key={t.value} onClick={() => setTab(t.value)} style={{
                padding: "8px 14px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: active ? 700 : 500,
                border: `1px solid ${active ? border : "transparent"}`,
                borderBottom: active ? `1px solid ${surface}` : "1px solid transparent",
                background: active ? surface : "transparent",
                color: active ? text : muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                marginBottom: -1,
              }}><span>{t.icon}</span>{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ margin: "12px 24px 0", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: feedback.ok ? (isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4") : (isDark ? "rgba(239,68,68,0.1)" : "#fef2f2"), border: `1px solid ${feedback.ok ? (isDark ? "rgba(34,197,94,0.3)" : "#86efac") : (isDark ? "rgba(239,68,68,0.3)" : "#fecaca")}`, color: feedback.ok ? (isDark ? "#86efac" : "#166534") : (isDark ? "#fca5a5" : "#991b1b") }}>
          {feedback.msg}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        <div style={{ maxWidth: 560 }}>

          {/* INFO */}
          {tab === "info" && (
            <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>Grunnupplýsingar</h2>
              {[
                { label: "Nafn verkstæðis", value: name, setter: setName, placeholder: "Nafn" },
                { label: "Heimilisfang",    value: address, setter: setAddress, placeholder: "Heimilisfang" },
                { label: "Símanúmer",       value: phone, setter: setPhone, placeholder: "Sími" },
                { label: "Netfang",         value: email, setter: setEmail, placeholder: "Netfang", type: "email" },
              ].map(({ label, value, setter, placeholder, type }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</label>
                  <input type={type ?? "text"} value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Bókunarhamur</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ value: "day_based", label: "Dagsbókanir" }, { value: "time_based", label: "Tímabókanir" }].map(opt => (
                    <button key={opt.value} onClick={() => setBookingMode(opt.value as any)} style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${bookingMode === opt.value ? amber : border}`,
                      background: bookingMode === opt.value ? (isDark ? "rgba(232,168,0,0.15)" : "#fffbeb") : subsurf,
                      color: bookingMode === opt.value ? amber : muted,
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {bookingMode === "day_based" ? (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Hámarksbílar á dag</label>
                  <input type="number" min={1} max={50} value={maxCars} onChange={e => setMaxCars(Number(e.target.value))} style={inputStyle} />
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Samhliða bókanir (1-4)</label>
                  <input type="number" min={1} max={4} value={parallelSlots} onChange={e => setParallelSlots(Number(e.target.value))} style={inputStyle} />
                </div>
              )}

              <button onClick={saveInfo} disabled={saving} style={btnPrimary}>{saving ? "Vista..." : "Vista upplýsingar"}</button>
            </div>
          )}

          {/* HOURS */}
          {tab === "hours" && (
            <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>Opnunartímar</h2>
              {editedHours.map((h: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: subsurf, border: `1px solid ${border}` }}>
                  <span style={{ width: 90, fontSize: 13, fontWeight: 600, color: text, flexShrink: 0 }}>{DAYS_LONG[i]}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={!h.is_closed} onChange={e => setEditedHours((prev: any[]) => prev.map((x, j) => j === i ? { ...x, is_closed: !e.target.checked } : x))} style={{ accentColor: amber }} />
                    <span style={{ fontSize: 12, color: muted }}>{h.is_closed ? "Lokað" : "Opið"}</span>
                  </label>
                  {!h.is_closed && (
                    <>
                      <input type="time" value={h.open_time ?? "09:00"} onChange={e => setEditedHours((prev: any[]) => prev.map((x, j) => j === i ? { ...x, open_time: e.target.value } : x))}
                        style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${border}`, background: isDark ? "#2a2a2a" : "white", color: text, fontSize: 12, outline: "none" }} />
                      <span style={{ color: muted }}>–</span>
                      <input type="time" value={h.close_time ?? "17:00"} onChange={e => setEditedHours((prev: any[]) => prev.map((x, j) => j === i ? { ...x, close_time: e.target.value } : x))}
                        style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${border}`, background: isDark ? "#2a2a2a" : "white", color: text, fontSize: 12, outline: "none" }} />
                    </>
                  )}
                </div>
              ))}
              <button onClick={saveHours} disabled={saving} style={btnPrimary}>{saving ? "Vista..." : "Vista opnunartíma"}</button>
            </div>
          )}

          {/* SERVICES */}
          {tab === "services" && (
            <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: "0 0 4px" }}>Þjónustur</h2>
              <p style={{ fontSize: 13, color: muted, margin: "0 0 6px" }}>Veldu þær þjónustur sem verkstæðið þitt býður upp á.</p>
              {allServices.map((s: any) => {
                const active = activeServiceIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => setActiveServiceIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    border: `1px solid ${active ? amber : border}`,
                    background: active ? (isDark ? "rgba(232,168,0,0.1)" : "#fffbeb") : subsurf,
                    color: active ? amber : text,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{active ? "✓ " : ""}{s.name_is}</span>
                    <span style={{ fontSize: 11, color: muted }}>{s.default_duration_minutes} mín</span>
                  </button>
                );
              })}
              <button onClick={saveServices} disabled={saving || activeServiceIds.length === 0} style={{ ...btnPrimary, marginTop: 4 }}>{saving ? "Vista..." : "Vista þjónustur"}</button>
            </div>
          )}

          {/* BLOCKS */}
          {tab === "blocks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>Bæta við lokun</h2>
                <p style={{ fontSize: 13, color: muted, margin: 0 }}>Lokaðu á dagsetningar vegna frídaga, veikinda eða annarra ástæðna.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Frá</label>
                    <input type="datetime-local" value={blockStart} onChange={e => setBlockStart(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Til</label>
                    <input type="datetime-local" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Ástæða (valfrjálst)</label>
                  <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="T.d. Sumarfrí, veikindi..." style={inputStyle} />
                </div>
                <button onClick={addBlock} disabled={saving} style={{ ...btnPrimary, background: isDark ? "#444" : "#111", color: "white" }}>{saving ? "Bæti við..." : "+ Bæta við lokun"}</button>
              </div>

              {blocks.length > 0 && (
                <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: "0 0 12px" }}>Skráðar lokanir</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {blocks.map((block: any) => (
                      <div key={block.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: subsurf, borderRadius: 10, border: `1px solid ${border}`, padding: "10px 12px" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: text, margin: 0 }}>{formatBlockDate(block.start_datetime)} – {formatBlockDate(block.end_datetime)}</p>
                          {block.reason && <p style={{ fontSize: 11, color: muted, margin: "2px 0 0" }}>{block.reason}</p>}
                        </div>
                        <button onClick={() => deleteBlock(block.id)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", color: isDark ? "#fca5a5" : "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eyða</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {blocks.length === 0 && (
                <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "48px 24px", textAlign: "center" }}>
                  <p style={{ fontSize: 28, margin: "0 0 8px" }}>📅</p>
                  <p style={{ fontWeight: 700, color: text, margin: 0 }}>Engar lokanir skráðar</p>
                  <p style={{ fontSize: 13, color: muted, margin: "4px 0 0" }}>Bættu við lokun hér að ofan</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
