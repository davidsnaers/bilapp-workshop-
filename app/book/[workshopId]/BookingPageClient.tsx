// @ts-nocheck
"use client";

import Image from "next/image";
import { useState, useMemo } from "react";

const MONTHS_IS = ["Janúar","Febrúar","Mars","Apríl","Maí","Júní","Júlí","Ágúst","September","Október","Nóvember","Desember"];
const MONTHS_SHORT_IS = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const WEEKDAYS_IS = ["Su","Má","Þr","Mi","Fi","Fö","La"];
const WEEKDAYS_LONG_IS = ["Sunnudagur","Mánudagur","Þriðjudagur","Miðvikudagur","Fimmtudagur","Föstudagur","Laugardagur"];

function pad(n: number) { return String(n).padStart(2,"0"); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function startOfMonth(y: number, m: number) { return new Date(y,m,1); }
function daysInMonth(y: number, m: number) { return new Date(y,m+1,0).getDate(); }
function mondayFirst(d: Date) { const day=d.getDay(); return day===0?6:day-1; }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

type Step = "service" | "datetime" | "details" | "confirm" | "done";

interface Workshop { id: string; name: string; address: string; phone: string; email: string; booking_mode: string; max_cars_per_day: number; }
interface Service { service: { id: string; name_is: string; name_en: string; default_duration_minutes: number } }

export default function BookingPageClient({
  workshop, services, hours
}: {
  workshop: Workshop;
  services: Service[];
  hours: any[];
}) {
  const [step, setStep] = useState<Step>("service");
  const [lang, setLang] = useState<"is"|"en">("is");

  // Form state
  const [selectedService, setSelectedService] = useState<Service["service"] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{h:number;m:number} | null>(null);
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [carMake, setCarMake]   = useState("");
  const [carModel, setCarModel] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [bookingId, setBookingId] = useState<string|null>(null);

  // Calendar state
  const today = useMemo(() => { const d=new Date(); d.setHours(0,0,0,0); return d; }, []);
  const maxDate = useMemo(() => addDays(today, 30), [today]);
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Availability data (fetched client-side for live updates)
  const [bookings, setBookings] = useState<any[]>([]);
  const [blocks, setBlocks]     = useState<any[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const fetchAvailability = async () => {
    setLoadingAvail(true);
    try {
      const res = await fetch(`/api/public/availability?workshop_id=${workshop.id}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings ?? []);
        setBlocks(data.blocks ?? []);
      }
    } finally { setLoadingAvail(false); }
  };

  const getHoursForDay = (date: Date) => hours.find(h => h.day_of_week === date.getDay());

  const isBlocked = (date: Date) => blocks.some(b => {
    const bs = new Date(b.start_datetime); const be = new Date(b.end_datetime);
    const ds = new Date(date); ds.setHours(0,0,0,0);
    const de = new Date(date); de.setHours(23,59,59,999);
    return bs <= de && be >= ds;
  });

  const getDayStatus = (date: Date): "available"|"full"|"closed"|"past"|"blocked" => {
    if (date < today || date > maxDate) return "past";
    const h = getHoursForDay(date);
    if (!h || h.is_closed) return "closed";
    if (isBlocked(date)) return "blocked";
    const dayBookings = bookings.filter(b => isSameDay(new Date(b.start_time), date));
    if (workshop.booking_mode === "day_based") {
      return dayBookings.length >= workshop.max_cars_per_day ? "full" : "available";
    }
    return getSlots(date, dayBookings, h).length === 0 ? "full" : "available";
  };

  const getSlots = (date: Date, dayBookings: any[], h: any) => {
    if (!h?.open_time || !h?.close_time) return [];
    const [oh,om] = h.open_time.split(":").map(Number);
    const [ch,cm] = h.close_time.split(":").map(Number);
    const dur = selectedService?.default_duration_minutes ?? 60;
    const interval = Math.ceil(Math.max(60,dur)/60)*60;
    const slots: {h:number;m:number}[] = [];
    const now = new Date();
    for (let min = oh*60+om; min+interval <= ch*60+cm; min+=interval) {
      const sh = Math.floor(min/60), sm = min%60;
      if (isSameDay(date,now)) {
        const t = new Date(date); t.setHours(sh,sm,0,0);
        if (t <= now) continue;
      }
      const overlaps = dayBookings.some(b => {
        const bDate = new Date(b.start_time);
        const bs = bDate.getHours()*60+bDate.getMinutes();
        return min < bs+b.duration_minutes && min+interval > bs;
      });
      if (!overlaps) slots.push({h:sh,m:sm});
    }
    return slots;
  };

  const availableSlots = useMemo(() => {
    if (!selectedDate || workshop.booking_mode !== "time_based") return [];
    const h = getHoursForDay(selectedDate);
    if (!h) return [];
    const dayBookings = bookings.filter(b => isSameDay(new Date(b.start_time), selectedDate));
    return getSlots(selectedDate, dayBookings, h);
  }, [selectedDate, bookings, selectedService]);

  // Calendar grid
  const calCells = useMemo(() => {
    const first = startOfMonth(viewYear, viewMonth);
    const off = mondayFirst(first);
    const total = daysInMonth(viewYear, viewMonth);
    const cells: (number|null)[] = [...Array(off).fill(null), ...Array.from({length:total},(_,i)=>i+1)];
    while (cells.length%7!==0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const goToDatetime = async () => {
    if (!selectedService) return;
    await fetchAvailability();
    setStep("datetime");
  };

  const handleDayClick = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    const status = getDayStatus(date);
    if (status !== "available") return;
    setSelectedDate(date);
    setSelectedSlot(null);
    if (workshop.booking_mode === "day_based") setStep("details");
  };

  const handleSlotClick = (slot: {h:number;m:number}) => {
    setSelectedSlot(slot);
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Skráðu nafn"); return; }
    if (!phone.trim()) { setError("Skráðu símanúmer"); return; }
    if (!selectedDate) { setError("Veldu dagsetningu"); return; }

    setError(null);
    setSubmitting(true);

    try {
      let startTime: Date;
      if (selectedSlot) {
        startTime = new Date(selectedDate);
        startTime.setHours(selectedSlot.h, selectedSlot.m, 0, 0);
      } else {
        startTime = new Date(selectedDate);
        startTime.setHours(9, 0, 0, 0);
      }

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshop_id:        workshop.id,
          service_id:         selectedService?.id ?? null,
          service_label:      selectedService?.name_is ?? null,
          customer_name:      name.trim(),
          customer_phone:     phone.trim(),
          customer_plate:     plate.toUpperCase() || null,
          customer_car_make:  carMake || null,
          customer_car_model: carModel || null,
          start_time:         startTime.toISOString(),
          duration_minutes:   selectedService?.default_duration_minutes ?? 60,
          source:             "app",
          customer_notes:     notes || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Villa");

      setBookingId(json.booking?.id ?? "ok");
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    const day = WEEKDAYS_LONG_IS[selectedDate.getDay()];
    const d   = selectedDate.getDate();
    const m   = MONTHS_SHORT_IS[selectedDate.getMonth()];
    if (selectedSlot) return `${day} ${d}. ${m} kl. ${pad(selectedSlot.h)}:${pad(selectedSlot.m)}`;
    return `${day} ${d}. ${m}`;
  };

  const isDark = false; // public page is always light
  const amber  = "#F5B301";
  const bg     = "#FFFDF8";
  const surface = "#ffffff";
  const border  = "#f0e8d8";
  const text    = "#1a1109";
  const muted   = "#8b7355";
  const subsurf = "#FFF8F0";
  const amberBg = "#FFF0B8";

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${border}`, background: subsurf, color: text,
    fontSize: 15, outline: "none", boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };

  const stepDots = ["service","datetime","details"];
  const stepIdx  = stepDots.indexOf(step);

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${border}`, background: surface, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logo.png" alt="Bílapp" width={32} height={32} style={{ borderRadius: 8 }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: text }}>{workshop.name}</p>
            <p style={{ fontSize: 12, color: muted, margin: 0 }}>{workshop.address}</p>
          </div>
        </div>
        {/* Language toggle */}
        <div style={{ display: "flex", borderRadius: 999, border: `1px solid ${border}`, overflow: "hidden" }}>
          {(["is","en"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
              background: lang===l ? "#111" : "white", color: lang===l ? "white" : muted,
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Progress dots */}
        {step !== "done" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 28 }}>
            {stepDots.map((s,i) => (
              <div key={s} style={{ width: i===stepIdx?24:8, height: 8, borderRadius: 999, background: i<=stepIdx?amber:(isDark?"#333":"#e5e7eb"), transition: "all 0.2s" }} />
            ))}
          </div>
        )}

        {/* ── STEP 1: Service ── */}
        {step === "service" && (
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: text }}>
              {lang==="is" ? "Veldu þjónustu" : "Choose a service"}
            </h1>
            <p style={{ fontSize: 14, color: muted, margin: "0 0 20px" }}>
              {lang==="is" ? `${workshop.name} býður upp á eftirfarandi þjónustu:` : `${workshop.name} offers the following services:`}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {services.map(ws => {
                const s = ws.service;
                const sel = selectedService?.id === s.id;
                return (
                  <button key={s.id} onClick={() => setSelectedService(s)} style={{
                    textAlign: "left", padding: "14px 16px", borderRadius: 14,
                    border: `2px solid ${sel ? amber : border}`,
                    background: sel ? amberBg : surface,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: text, margin: 0 }}>
                        {lang==="is" ? s.name_is : (s.name_en || s.name_is)}
                      </p>
                      <p style={{ fontSize: 12, color: muted, margin: "3px 0 0" }}>
                        {s.default_duration_minutes} {lang==="is" ? "mínútur" : "minutes"}
                      </p>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel?amber:border}`, background: sel?amber:"transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {sel && <span style={{ color: "#111", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <button onClick={goToDatetime} disabled={!selectedService} style={{
              width: "100%", marginTop: 20, padding: "14px 0", borderRadius: 14, border: "none",
              background: selectedService ? amber : "#e5e7eb", color: selectedService ? "#111" : "#999",
              fontSize: 15, fontWeight: 700, cursor: selectedService ? "pointer" : "not-allowed",
            }}>
              {lang==="is" ? "Áfram →" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── STEP 2: Date/Time ── */}
        {step === "datetime" && (
          <div>
            <button onClick={() => setStep("service")} style={{ background:"none", border:"none", cursor:"pointer", color: amber, fontSize:13, fontWeight:700, padding:0, marginBottom:16 }}>
              ← {lang==="is" ? "Til baka" : "Back"}
            </button>

            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", color: text }}>
              {lang==="is" ? "Veldu dag" : "Choose a day"}
              {workshop.booking_mode === "time_based" && (lang==="is" ? " og tíma" : " and time")}
            </h1>
            <p style={{ fontSize: 13, color: muted, margin: "0 0 20px" }}>
              {selectedService?.name_is ?? ""} · {selectedService?.default_duration_minutes} {lang==="is"?"mín":"min"}
            </p>

            {/* Calendar */}
            <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: 16, marginBottom: 16 }}>
              {/* Month nav */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <button onClick={() => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); }} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${border}`,background:subsurf,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
                <span style={{ fontWeight:700, fontSize:16, color:text }}>{MONTHS_IS[viewMonth]} {viewYear}</span>
                <button onClick={() => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); }} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${border}`,background:subsurf,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>›</button>
              </div>

              {/* Day headers */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
                {WEEKDAYS_IS.map(d => <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:muted, padding:"4px 0" }}>{d}</div>)}
              </div>

              {/* Cells */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                {calCells.map((day,i) => {
                  if (!day) return <div key={`e${i}`} />;
                  const date = new Date(viewYear,viewMonth,day);
                  const status = getDayStatus(date);
                  const isSel = selectedDate && isSameDay(date,selectedDate);
                  const isT = isSameDay(date,today);
                  const active = status==="available";

                  return (
                    <button key={day} onClick={() => handleDayClick(day)} disabled={!active} style={{
                      aspectRatio:"1", borderRadius:10, border: isSel?`2px solid ${amber}`:isT?`1.5px solid ${amber}`:"1px solid transparent",
                      background: isSel?amber:isT?"#fff8e6":"transparent",
                      cursor: active?"pointer":"default",
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:2,
                      opacity: status==="past"||status==="closed"||status==="blocked" ? 0.3 : 1,
                    }}>
                      <span style={{ fontSize:13, fontWeight: isSel?700:500, color: isSel?"#111":isT?amber:active?text:muted }}>{day}</span>
                      {active && !isSel && <div style={{ width:4,height:4,borderRadius:"50%",background:amber }} />}
                      {status==="full" && <div style={{ width:4,height:4,borderRadius:"50%",background:"#e5e7eb" }} />}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:12, paddingTop:12, borderTop:`1px solid ${border}` }}>
                {[{color:amber,label:lang==="is"?"Laust":"Available"},{color:"#e5e7eb",label:lang==="is"?"Fullbókað":"Full"}].map(item=>(
                  <div key={item.label} style={{ display:"flex",alignItems:"center",gap:5 }}>
                    <div style={{ width:8,height:8,borderRadius:"50%",background:item.color }} />
                    <span style={{ fontSize:11,color:muted }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time slots for time-based */}
            {workshop.booking_mode === "time_based" && selectedDate && (
              <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
                <p style={{ fontSize:15, fontWeight:700, color:text, margin:"0 0 4px" }}>{lang==="is"?"Veldu tíma":"Choose a time"}</p>
                <p style={{ fontSize:12, color:muted, margin:"0 0 12px" }}>
                  {WEEKDAYS_LONG_IS[selectedDate.getDay()]} {selectedDate.getDate()}. {MONTHS_SHORT_IS[selectedDate.getMonth()]}
                </p>

                {availableSlots.length === 0 ? (
                  <p style={{ fontSize:13,color:muted,textAlign:"center",padding:"16px 0" }}>
                    {lang==="is"?"Engir tímar laus þennan dag":"No available slots this day"}
                  </p>
                ) : (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {availableSlots.map(slot => {
                      const sel = selectedSlot?.h===slot.h && selectedSlot?.m===slot.m;
                      const dur = selectedService?.default_duration_minutes??60;
                      const eh  = Math.floor((slot.h*60+slot.m+dur)/60)%24;
                      const em  = (slot.h*60+slot.m+dur)%60;
                      return (
                        <button key={`${slot.h}-${slot.m}`} onClick={()=>handleSlotClick(slot)} style={{
                          padding:"10px 14px", borderRadius:12, border:`2px solid ${sel?amber:border}`,
                          background:sel?amberBg:surface, cursor:"pointer", minWidth:80, textAlign:"center",
                        }}>
                          <p style={{ fontSize:15, fontWeight:700, color:sel?"#7a4f00":text, margin:0 }}>{pad(slot.h)}:{pad(slot.m)}</p>
                          <p style={{ fontSize:11, color:muted, margin:"2px 0 0" }}>–{pad(eh)}:{pad(em)}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Details ── */}
        {step === "details" && (
          <div>
            <button onClick={() => setStep("datetime")} style={{ background:"none",border:"none",cursor:"pointer",color:amber,fontSize:13,fontWeight:700,padding:0,marginBottom:16 }}>
              ← {lang==="is"?"Til baka":"Back"}
            </button>

            <h1 style={{ fontSize:24,fontWeight:700,margin:"0 0 4px",color:text }}>
              {lang==="is"?"Upplýsingar þínar":"Your details"}
            </h1>

            {/* Summary pill */}
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:20 }}>
              <span style={{ padding:"4px 12px",borderRadius:999,fontSize:12,fontWeight:700,background:amberBg,border:`1px solid #fde68a`,color:"#7a4f00" }}>
                {selectedService?.name_is}
              </span>
              <span style={{ padding:"4px 12px",borderRadius:999,fontSize:12,fontWeight:600,background:subsurf,border:`1px solid ${border}`,color:muted }}>
                {formatSelectedDate()}
              </span>
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {[
                {label:lang==="is"?"Nafn *":"Name *",value:name,setter:setName,placeholder:lang==="is"?"Fullt nafn":"Full name"},
                {label:lang==="is"?"Símanúmer *":"Phone *",value:phone,setter:setPhone,placeholder:"778-1009",type:"tel"},
                {label:lang==="is"?"Bílnúmer":"Plate",value:plate,setter:setPlate,placeholder:"ABC-12"},
              ].map(({label,value,setter,placeholder,type})=>(
                <div key={label}>
                  <label style={{ display:"block",fontSize:12,fontWeight:700,color:muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px" }}>{label}</label>
                  <input type={type??"text"} value={value} onChange={e=>setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                {[
                  {label:lang==="is"?"Tegund":"Make",value:carMake,setter:setCarMake,placeholder:"Toyota"},
                  {label:lang==="is"?"Módel":"Model",value:carModel,setter:setCarModel,placeholder:"Corolla"},
                ].map(({label,value,setter,placeholder})=>(
                  <div key={label}>
                    <label style={{ display:"block",fontSize:12,fontWeight:700,color:muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px" }}>{label}</label>
                    <input type="text" value={value} onChange={e=>setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display:"block",fontSize:12,fontWeight:700,color:muted,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px" }}>{lang==="is"?"Athugasemdir":"Notes"}</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
                  placeholder={lang==="is"?"T.d. bremsur, dekk...":"e.g. brakes, tires..."}
                  style={{...inputStyle,resize:"none"}} />
              </div>
            </div>

            {error && (
              <div style={{ marginTop:12,padding:"10px 14px",borderRadius:12,background:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",fontSize:13,fontWeight:600 }}>{error}</div>
            )}

            <button onClick={handleSubmit} disabled={submitting} style={{
              width:"100%",marginTop:16,padding:"14px 0",borderRadius:14,border:"none",
              background:amber,color:"#111",fontSize:15,fontWeight:700,cursor:submitting?"not-allowed":"pointer",opacity:submitting?0.7:1,
            }}>
              {submitting?(lang==="is"?"Sendi bókun...":"Sending..."):(lang==="is"?"Senda bókun":"Send booking")}
            </button>

            <p style={{ fontSize:11,color:muted,textAlign:"center",marginTop:10 }}>
              {lang==="is"?"Verkstæðið staðfestir bókunina fljótlega":"The workshop will confirm your booking shortly"}
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div style={{ textAlign:"center",paddingTop:40 }}>
            <div style={{ width:72,height:72,borderRadius:"50%",background:"#f0fdf4",border:"2px solid #86efac",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px" }}>✅</div>
            <h1 style={{ fontSize:26,fontWeight:700,color:text,margin:"0 0 8px" }}>
              {lang==="is"?"Bókun send!":"Booking sent!"}
            </h1>
            <p style={{ fontSize:15,color:muted,margin:"0 0 24px",lineHeight:1.6 }}>
              {lang==="is"
                ? `${workshop.name} fær tilkynningu og staðfestir bókunina fljótlega.`
                : `${workshop.name} has been notified and will confirm your booking shortly.`}
            </p>
            <div style={{ background:surface,borderRadius:16,border:`1px solid ${border}`,padding:16,textAlign:"left",marginBottom:20 }}>
              {[
                {label:lang==="is"?"Þjónusta":"Service",value:selectedService?.name_is},
                {label:lang==="is"?"Dagsetning":"Date",value:formatSelectedDate()},
                {label:lang==="is"?"Nafn":"Name",value:name},
                {label:lang==="is"?"Sími":"Phone",value:phone},
                ...(plate?[{label:lang==="is"?"Bílnúmer":"Plate",value:plate}]:[]),
              ].map(({label,value})=>(
                <div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${border}` }}>
                  <span style={{ fontSize:13,color:muted,fontWeight:600 }}>{label}</span>
                  <span style={{ fontSize:13,color:text,fontWeight:700 }}>{value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { setStep("service"); setSelectedService(null); setSelectedDate(null); setSelectedSlot(null); setName(""); setPhone(""); setPlate(""); setNotes(""); setCarMake(""); setCarModel(""); }} style={{
              padding:"12px 28px",borderRadius:12,border:`1px solid ${border}`,background:surface,color:text,fontSize:14,fontWeight:600,cursor:"pointer",
            }}>
              {lang==="is"?"Bóka aftur":"Book again"}
            </button>

            {/* Powered by */}
            <div style={{ marginTop:32,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
              <Image src="/logo.png" alt="Bílapp" width={18} height={18} style={{ borderRadius:4,opacity:0.6 }} />
              <span style={{ fontSize:11,color:muted }}>{lang==="is"?"Keyrt af":"Powered by"} Bílapp</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
