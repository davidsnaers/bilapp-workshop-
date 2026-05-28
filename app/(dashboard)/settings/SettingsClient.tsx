// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { Workshop } from "@/types/database";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Mon–Fri first, then Sat+Sun at bottom
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon=1...Fri=5, Sat=6, Sun=0
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

  const bg      = isDark ? "#1e1e1e" : "#f9fafb";
  const surface = isDark ? "#252525" : "#ffffff";
  const border  = isDark ? "#2e2e2e" : "#e5e7eb";
  const text    = isDark ? "#f4f4f4" : "#111827";
  const muted   = isDark ? "#888"    : "#6b7280";
  const subsurf = isDark ? "#2e2e2e" : "#f9fafb";
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

  // Build hours map keyed by day_of_week
  const defaultHours = WEEKDAY_ORDER.map(dow => ({
    day_of_week: dow,
    open_time: "09:00",
    close_time: "17:00",
    is_closed: dow === 0 || dow === 6,
  }));

  const [editedHours, setEditedHours] = useState(() => {
    if (hours.length > 0) {
      return WEEKDAY_ORDER.map(dow => {
        const found = hours.find(h => h.day_of_week === dow);
        return found ?? { day_of_week: dow, open_time: "09:00", close_time: "17:00", is_closed: true };
      });
    }
    return defaultHours;
  });

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
      const upsertData = editedHours.map((h: any) => ({
        ...(h.id ? { id: h.id } : {}),
        workshop_id: workshop.id,
        day_of_week: h.day_of_week,
        open_time: h.is_closed ? null : h.open_time,
        close_time: h.is_closed ? null : h.close_time,
        is_closed: h.is_closed,
      }));
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
      if (activeServiceIds.length > 0) {
        await (supabase as any).from("workshop_services").insert(activeServiceIds.map(id => ({ workshop_id: workshop.id, service_id: id, is_active: true })));
      }
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

  const updateHour = (dow: number, field: string, value: any) => {
    setEditedHours(prev => prev.map(h => h.day_of_week === dow ? { ...h, [field]: value } : h));
  };

  const TABS: { value: Tab; label: string; icon: string }[] = [
    { value: "info",     label: "Upplýsingar", icon: "🏪" },
    { value: "hours",    label: "Opnunartímar", icon: "🕐" },
    { value: "services", label: "Þjónustur",   icon: "🔧" },
    { value: "blocks",   label: "Lokanir",     icon: "🚫" },
  ];

  const btnPrimary = { padding: "11px 0", borderRadius: 12, border: "none", background: amber, color: "#111", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" } as const;

  // Separate weekdays from weekend for the hours tab
  const weekdays = editedHours.filter(h => h.day_of_week >= 1 && h.day_of_week <= 5);
  const weekend  = editedHours.filter(h => h.day_of_week === 6 || h.day_of_week === 0);

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
                color: active ? text : muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: -1,
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
            <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>Grunnupplýsingar</h2>
              {[
                { label: "Nafn verkstæðis", value: name, setter: setName, placeholder: "Nafn" },
                { label: "Heimilisfang", value: address, setter: setAddress, placeholder: "Heimilisfang" },
                { label: "Símanúmer", value: phone, setter: setPhone, placeholder: "Sími" },
                { label: "Netfang", value: email, setter: setEmail, placeholder: "Netfang", type: "email" },
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
                    <button key={opt.value} onClick={() => setBookingMode(opt.value as any)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${bookingMode === opt.value ? amber : border}`, background: bookingMode === opt.value ? (isDark ? "rgba(232,168,0,0.15)" : "#fffbeb") : subsurf, color: bookingMode === opt.value ? amber : muted }}>{opt.label}</button>
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

          {/* HOURS — weekdays first, weekend at bottom */}
          {tab === "hours" && (
            <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>Opnunartímar</h2>

              {/* Weekdays Mon–Fri */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {weekdays.map((h: any) => (
                  <HourRow key={h.day_of_week} h={h} isDark={isDark} border={border} subsurf={subsurf} text={text} muted={muted} amber={amber} updateHour={updateHour} />
                ))}
              </div>

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Helgi</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {weekend.map((h: any) => (
                    <HourRow key={h.day_of_week} h={h} isDark={isDark} border={border} subsurf={subsurf} text={text} muted={muted} amber={amber} updateHour={updateHour} />
                  ))}
                </div>
              </div>

              <button onClick={saveHours} disabled={saving} style={{ ...btnPrimary, marginTop: 4 }}>{saving ? "Vista..." : "Vista opnunartíma"}</button>
            </div>
          )}

          {/* SERVICES */}
          {tab === "services" && (
            <ServicesTab
              surface={surface} border={border} text={text} muted={muted}
              subsurf={subsurf} amber={amber} isDark={isDark} btnPrimary={btnPrimary}
              allServices={allServices} workshopId={workshop.id}
              workshopServices={workshopServices} saving={saving} setSaving={setSaving}
              showFeedback={showFeedback} router={router} inputStyle={inputStyle}
            />
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
                <button onClick={addBlock} disabled={saving} style={{ ...btnPrimary, background: isDark ? "#333" : "#111", color: "white" }}>{saving ? "Bæti við..." : "+ Bæta við lokun"}</button>
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

// Extracted hour row component
function HourRow({ h, isDark, border, subsurf, text, muted, amber, updateHour }: any) {
  const DAYS_LONG = ["Sunnudagur","Mánudagur","Þriðjudagur","Miðvikudagur","Fimmtudagur","Föstudagur","Laugardagur"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: subsurf, border: `1px solid ${border}` }}>
      <span style={{ width: 100, fontSize: 13, fontWeight: 600, color: text, flexShrink: 0 }}>{DAYS_LONG[h.day_of_week]}</span>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
        <input type="checkbox" checked={!h.is_closed} onChange={e => updateHour(h.day_of_week, "is_closed", !e.target.checked)} style={{ accentColor: amber }} />
        <span style={{ fontSize: 12, color: muted, width: 40 }}>{h.is_closed ? "Lokað" : "Opið"}</span>
      </label>
      {!h.is_closed && (
        <>
          <input type="time" value={h.open_time ?? "09:00"} onChange={e => updateHour(h.day_of_week, "open_time", e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${border}`, background: isDark ? "#1e1e1e" : "white", color: text, fontSize: 12, outline: "none" }} />
          <span style={{ color: muted }}>–</span>
          <input type="time" value={h.close_time ?? "17:00"} onChange={e => updateHour(h.day_of_week, "close_time", e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${border}`, background: isDark ? "#1e1e1e" : "white", color: text, fontSize: 12, outline: "none" }} />
        </>
      )}
    </div>
  );
}

// ── Services tab with editable durations ─────────────────────
function ServicesTab({ surface, border, text, muted, subsurf, amber, isDark, btnPrimary, allServices, workshopId, workshopServices, saving, setSaving, showFeedback, router, inputStyle }: any) {
  const supabase = createSupabaseBrowserClient();

  // Build initial state: service_id -> { active, duration_minutes }
  const buildInitial = () => {
    const map: Record<string, { active: boolean; duration: number; name: string }> = {};
    allServices.forEach((s: any) => {
      const ws = workshopServices.find((w: any) => w.service?.id === s.id || w.service_id === s.id);
      map[s.id] = {
        active: !!ws?.is_active,
        duration: ws?.custom_duration_minutes ?? s.default_duration_minutes,
        name: s.name_is,
      };
    });
    return map;
  };

  const [serviceMap, setServiceMap] = useState<Record<string, { active: boolean; duration: number; name: string }>>(buildInitial);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(60);
  const [addingNew, setAddingNew] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);

  const toggleService = (id: string) => {
    setServiceMap(prev => ({ ...prev, [id]: { ...prev[id], active: !prev[id].active } }));
  };

  const setDuration = (id: string, duration: number) => {
    setServiceMap(prev => ({ ...prev, [id]: { ...prev[id], duration } }));
  };

  const handleSave = async () => {
    setLocalSaving(true);
    try {
      // Delete existing workshop services
      await (supabase as any).from("workshop_services").delete().eq("workshop_id", workshopId);

      // Re-insert active ones with custom duration
      const toInsert = Object.entries(serviceMap)
        .filter(([_, v]) => v.active)
        .map(([serviceId, v]) => ({
          workshop_id: workshopId,
          service_id: serviceId,
          is_active: true,
          custom_duration_minutes: v.duration,
        }));

      if (toInsert.length > 0) {
        await (supabase as any).from("workshop_services").insert(toInsert);
      }

      showFeedback("Þjónustur vistaðar ✓");
      router.refresh();
    } catch (e: any) {
      showFeedback(e?.message ?? "Villa", false);
    } finally {
      setLocalSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!newServiceName.trim()) return;
    setLocalSaving(true);
    try {
      // Create new service in services table
      const { data: newService, error } = await (supabase as any)
        .from("services")
        .insert({ name_is: newServiceName.trim(), name_en: newServiceName.trim(), default_duration_minutes: newServiceDuration, is_active: true })
        .select()
        .single();

      if (error) throw error;

      // Add to workshop
      await (supabase as any).from("workshop_services").insert({
        workshop_id: workshopId, service_id: newService.id,
        is_active: true, custom_duration_minutes: newServiceDuration,
      });

      setNewServiceName("");
      setNewServiceDuration(60);
      setAddingNew(false);
      showFeedback("Þjónusta bætt við ✓");
      router.refresh();
    } catch (e: any) {
      showFeedback(e?.message ?? "Villa", false);
    } finally {
      setLocalSaving(false);
    }
  };

  const DURATION_OPTIONS = [15,30,45,60,90,120,150,180,240,300,360];

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} mín`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} klst`;
    return `${h} klst ${m} mín`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>Þjónustur</h2>
            <p style={{ fontSize: 13, color: muted, margin: "2px 0 0" }}>Veldu þjónustur og stilltu tímalengd</p>
          </div>
          <button onClick={() => setAddingNew(true)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${border}`, background: subsurf, color: text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Bæta við
          </button>
        </div>

        {/* Add new service form */}
        {addingNew && (
          <div style={{ background: isDark ? "rgba(232,168,0,0.08)" : "#fffbeb", border: `1px solid ${isDark ? "rgba(232,168,0,0.3)" : "#fde68a"}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: amber, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ný þjónusta</p>
            <input
              type="text" value={newServiceName} onChange={e => setNewServiceName(e.target.value)}
              placeholder="Heiti þjónustu" style={{ ...inputStyle, marginBottom: 0 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: muted, flexShrink: 0 }}>Tímalengd:</label>
              <select value={newServiceDuration} onChange={e => setNewServiceDuration(Number(e.target.value))}
                style={{ ...inputStyle, marginBottom: 0, flex: 1, cursor: "pointer" }}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{formatDuration(d)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAddNew} disabled={!newServiceName.trim() || localSaving}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: amber, color: "#111", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {localSaving ? "Vista..." : "Bæta við"}
              </button>
              <button onClick={() => { setAddingNew(false); setNewServiceName(""); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Hætta við
              </button>
            </div>
          </div>
        )}

        {/* Service list */}
        {Object.entries(serviceMap).map(([id, s]) => (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${s.active ? amber : border}`, background: s.active ? (isDark ? "rgba(232,168,0,0.08)" : "#fffbeb") : subsurf }}>
            {/* Toggle */}
            <button onClick={() => toggleService(id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${s.active ? amber : border}`, background: s.active ? amber : "transparent", color: "#111", fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.active ? "✓" : ""}
            </button>

            {/* Name */}
            <span style={{ flex: 1, fontSize: 13, fontWeight: s.active ? 700 : 500, color: s.active ? (isDark ? amber : "#7a4f00") : muted }}>
              {s.name}
            </span>

            {/* Duration selector — only shown when active */}
            {s.active && (
              <select value={s.duration} onChange={e => setDuration(id, Number(e.target.value))}
                style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${border}`, background: isDark ? "#1e1e1e" : "white", color: text, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{formatDuration(d)}</option>)}
              </select>
            )}
          </div>
        ))}

        <button onClick={handleSave} disabled={localSaving}
          style={{ ...btnPrimary, marginTop: 4 }}>
          {localSaving ? "Vista..." : "Vista þjónustur"}
        </button>
      </div>
    </div>
  );
}
