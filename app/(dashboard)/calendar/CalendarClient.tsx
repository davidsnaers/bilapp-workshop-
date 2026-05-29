// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { BookingWorkshop, Workshop } from "@/types/database";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AddBookingModal from "./AddBookingModal";
import MonthBubble from "./MonthBubble";
import { useTheme } from "@/components/ThemeProvider";
import Image from "next/image";

const WEEKDAYS_SHORT = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];
const WEEKDAYS_LONG  = ["Sunnudagur","Mánudagur","Þriðjudagur","Miðvikudagur","Fimmtudagur","Föstudagur","Laugardagur"];
const MONTHS_SHORT   = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const MONTHS_LONG    = ["janúar","febrúar","mars","apríl","maí","júní","júlí","ágúst","september","október","nóvember","desember"];

// Mon=0 ... Fri=4 (indices into WEEKDAYS array)
const WEEKDAY_ORDER = [1,2,3,4,5]; // Mon–Fri only in main grid
const WEEKEND_ORDER = [6,0];       // Sat, Sun — small row at bottom

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formatEndTime(iso: string, mins: number): string {
  const d = new Date(new Date(iso).getTime() + mins*60000);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formatDateRange(from: Date, to: Date): string {
  return `${from.getDate()}. ${MONTHS_LONG[from.getMonth()]} – ${to.getDate()}. ${MONTHS_LONG[to.getMonth()]} ${to.getFullYear()}`;
}
function formatBookingDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// Group overlapping bookings for side-by-side display
function groupOverlapping(bookings: any[]): any[][] {
  if (!bookings.length) return [];
  const sorted = [...bookings].sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const groups: any[][] = [];
  let currentGroup: any[] = [];

  for (const b of sorted) {
    const bStart = new Date(b.start_time).getTime();
    const bEnd   = bStart + b.duration_minutes * 60000;
    let overlaps = false;
    for (const existing of currentGroup) {
      const eStart = new Date(existing.start_time).getTime();
      const eEnd   = eStart + existing.duration_minutes * 60000;
      if (bStart < eEnd && bEnd > eStart) { overlaps = true; break; }
    }
    if (overlaps || currentGroup.length === 0) {
      currentGroup.push(b);
    } else {
      groups.push(currentGroup);
      currentGroup = [b];
    }
  }
  if (currentGroup.length) groups.push(currentGroup);
  return groups;
}

interface Props {
  workshop: Workshop;
  bookings: (BookingWorkshop & { service?: { name_is: string } | null })[];
  services: { service?: { id: string; name_is: string; default_duration_minutes: number } | null }[];
  workshopHours: { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }[];
}

export default function CalendarClient({ workshop, bookings, services, workshopHours }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingWorkshop | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // All 7 days of week
  const allWeekDays = useMemo(() => Array.from({length:7},(_,i) => addDays(weekStart,i)), [weekStart]);
  // Mon–Fri
  const weekDays = useMemo(() => allWeekDays.filter(d => d.getDay() >= 1 && d.getDay() <= 5), [allWeekDays]);
  // Sat + Sun
  const weekend  = useMemo(() => [allWeekDays[5], allWeekDays[6]], [allWeekDays]); // Sat=index5, Sun=index6

  const pendingBookings = useMemo(() => bookings.filter(b => b.status === "pending"), [bookings]);

  const bookingsByDay = useMemo(() => {
    const map = new Map();
    allWeekDays.forEach(day => {
      map.set(day.toDateString(), bookings.filter(b => isSameDay(new Date(b.start_time), day)));
    });
    return map;
  }, [bookings, allWeekDays]);

  const goToPrevWeek = () => setWeekStart(d => addDays(d,-7));
  const goToNextWeek = () => setWeekStart(d => addDays(d,7));
  const goToToday   = () => setWeekStart(startOfWeek(new Date()));
  const openAddModal = (date: Date) => { setAddModalDate(date); setShowAddModal(true); };

  const handleDayClick = (date: Date) => {
    setWeekStart(startOfWeek(date));
    router.push(`/bookings/day?date=${date.toISOString().split("T")[0]}`);
  };

  const handleAction = async (bookingId: string, action: "confirm"|"decline"|"complete") => {
    setActionLoading(true);
    try {
      if (action === "confirm") {
        const res = await fetch("/api/bookings/confirm", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({booking_id:bookingId}) });
        if (!res.ok) throw new Error("Staðfesting mistókst");
      } else if (action === "decline") {
        if (!declineReason.trim()) { alert("Þú verður að skrifa ástæðu."); setActionLoading(false); return; }
        const res = await fetch("/api/bookings/decline", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({booking_id:bookingId,decline_reason:declineReason}) });
        if (!res.ok) throw new Error("Höfnun mistókst");
      } else {
        await (supabase as any).from("bookings_workshop").update({status:"completed"}).eq("id",bookingId);
      }
      setSelectedBooking(null); setDeclineReason(""); setShowDeclineInput(false);
      router.refresh();
    } catch(e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  const getOccupancy = (day: Date): number => {
    const dow = day.getDay();
    const hrs = workshopHours.find(h => h.day_of_week === dow);
    const dayB = (bookingsByDay.get(day.toDateString()) ?? []).filter(b =>
      !["declined","cancelled_by_user","cancelled_by_workshop","auto_cancelled"].includes(b.status)
    );
    if (workshop.booking_mode === "day_based") {
      return Math.min(100, Math.round((dayB.length / Math.max(1, workshop.max_cars_per_day)) * 100));
    }
    if (!hrs || hrs.is_closed || !hrs.open_time || !hrs.close_time) return 0;
    const [oh,om] = hrs.open_time.split(":").map(Number);
    const [ch,cm] = hrs.close_time.split(":").map(Number);
    const totalMins = (ch*60+cm) - (oh*60+om);
    const bookedMins = dayB.reduce((sum,b) => sum+b.duration_minutes, 0);
    return Math.min(100, Math.round((bookedMins / Math.max(1,totalMins)) * 100));
  };

  const today = new Date();

  // Theme tokens — cream/amber light, dark gray dark
  const bg       = isDark ? "#1a1a1a" : "#FFFDF8";
  const surface  = isDark ? "#222222" : "#ffffff";
  const surface2 = isDark ? "#2a2a2a" : "#FFF8F0";
  const border   = isDark ? "#2e2e2e" : "#F0E8D8";
  const border2  = isDark ? "#333"    : "#E8DCC8";
  const text     = isDark ? "#f4f4f4" : "#1a1109";
  const muted    = isDark ? "#777"    : "#8B7355";
  const amber    = isDark ? "#E8A800" : "#F5B301";
  const amberBg  = isDark ? "rgba(232,168,0,0.12)" : "#FFF0B8";
  const amberBorder = isDark ? "rgba(232,168,0,0.3)" : "#F5B301";

  const renderDayColumn = (day: Date, isWeekend = false) => {
    const isToday   = isSameDay(day, today);
    const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];
    const isPast    = day < today && !isToday;
    const occupancy = getOccupancy(day);
    const hrs       = workshopHours.find(h => h.day_of_week === day.getDay());
    const isClosed  = hrs?.is_closed ?? false;

    const groups = groupOverlapping(dayBookings);

    const cardBg     = isToday ? amberBg  : surface;
    const cardBorder = isToday ? amberBorder : border;

    if (isClosed) {
      return (
        <div key={day.toDateString()} style={{
          display:"flex", flexDirection:"column", alignItems:"center",
          borderRadius: isWeekend ? 10 : 14,
          border:`1px solid ${border}`,
          background: isDark ? "#1e1e1e" : "#FAF6EE",
          opacity: 0.45, padding: isWeekend ? "8px 4px" : "10px 4px",
          overflow:"hidden", minHeight: isWeekend ? 50 : 120,
        }}>
          <p style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 3px",color:muted}}>{WEEKDAYS_SHORT[day.getDay()]}</p>
          <p style={{fontSize:isWeekend?13:16,fontWeight:700,margin:0,color:muted}}>{day.getDate()}</p>
          <div style={{writingMode:"vertical-rl",textOrientation:"mixed",fontSize:8,fontWeight:700,letterSpacing:"1px",color:muted,textTransform:"uppercase",transform:"rotate(180deg)",marginTop:6}}>Lokað</div>
        </div>
      );
    }

    return (
      <div key={day.toDateString()} style={{
        display:"flex", flexDirection:"column",
        borderRadius: isWeekend ? 10 : 14,
        border:`1.5px solid ${cardBorder}`,
        background: cardBg,
        opacity: isPast ? 0.65 : 1,
        minHeight: isWeekend ? 60 : 160,
        flex: 1,
      }}>
        {/* Day header */}
        <div style={{padding: isWeekend ? "6px 8px 5px" : "8px 10px 6px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"flex-start", justifyContent:"space-between"}}>
          <div>
            <p style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",margin:0,color:isToday?amber:muted}}>{WEEKDAYS_SHORT[day.getDay()]}</p>
            <p style={{fontSize:isWeekend?14:20,fontWeight:700,margin:0,color:isToday?amber:text}}>{day.getDate()}</p>
            {/* Occupancy bar */}
            <div style={{marginTop:3,width:"100%",height:3,background:isDark?"#333":"#E8DCC8",borderRadius:999,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:999,width:`${occupancy}%`,background:occupancy<40?"#22c55e":occupancy<75?"#f59e0b":"#ef4444",transition:"width 0.3s"}} />
            </div>
            {!isWeekend && occupancy > 0 && <p style={{fontSize:8,color:muted,margin:"2px 0 0",fontWeight:600}}>{occupancy}%</p>}
          </div>
          {!isWeekend && (
            <button onClick={() => openAddModal(day)} style={{width:20,height:20,borderRadius:6,border:`1px solid ${border2}`,background:isDark?"#2a2a2a":amberBg,color:amber,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:700}}>+</button>
          )}
        </div>

        {/* Bookings — grouped side by side */}
        <div style={{flex:1,padding:"5px 5px 6px",display:"flex",flexDirection:"column",gap:3,overflowY:"auto"}}>
          {dayBookings.length === 0 && (
            <p style={{fontSize:9,color:isDark?"#333":border2,textAlign:"center",marginTop:10,fontWeight:500}}>Engar bókanir</p>
          )}
          {groups.map((group, gi) => (
            <div key={gi} style={{display:"flex",gap:3}}>
              {group.map(booking => {
                const isPending = booking.status === "pending";
                const isConfirmed = booking.status === "confirmed";
                return (
                  <button key={booking.id} onClick={() => setSelectedBooking(booking)}
                    style={{
                      flex:1, textAlign:"left", padding:"5px 6px", borderRadius:8, cursor:"pointer",
                      border:`1px solid ${isPending?(isDark?"rgba(239,68,68,0.5)":"#fca5a5"):isConfirmed?(isDark?"rgba(34,197,94,0.3)":"#86efac"):(isDark?"#2e2e2e":border)}`,
                      background: isPending?(isDark?"rgba(239,68,68,0.12)":"#fef2f2"):isConfirmed?(isDark?"rgba(34,197,94,0.08)":"#f0fdf4"):(isDark?"#252525":surface),
                      minWidth:0,
                    }}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:2,marginBottom:1}}>
                      <span style={{fontSize:10,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isPending?(isDark?"#fca5a5":"#991b1b"):isConfirmed?(isDark?"#86efac":"#166534"):text}}>
                        {booking.customer_name ?? booking.customer_plate ?? "Bókun"}
                      </span>
                      <span style={{fontSize:9,color:muted,flexShrink:0}}>{formatTime(booking.start_time)}</span>
                    </div>
                    {((booking as any).service?.name_is ?? booking.service_label) && (
                      <span style={{fontSize:9,color:muted,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {(booking as any).service?.name_is ?? booking.service_label}
                      </span>
                    )}
                    {/* Duration bar */}
                    <div style={{marginTop:3,height:2,background:isDark?"#333":"#E8DCC8",borderRadius:999,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:999,width:`${Math.min(100,Math.round((booking.duration_minutes/480)*100))}%`,background:isPending?"#ef4444":isConfirmed?"#22c55e":(isDark?"#444":"#D4C4A0")}} />
                    </div>
                    <span style={{fontSize:8,color:muted,fontWeight:600}}>{formatTime(booking.start_time)}–{formatEndTime(booking.start_time,booking.duration_minutes)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {dayBookings.length > 0 && !isWeekend && (
          <div style={{padding:"4px 8px",borderTop:`1px solid ${border}`}}>
            <button onClick={() => router.push(`/bookings/day?date=${day.toISOString().split("T")[0]}`)} style={{fontSize:9,fontWeight:600,color:muted,background:"none",border:"none",cursor:"pointer",padding:0}}>
              {dayBookings.length} bókun{dayBookings.length!==1?"ar":""} →
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:bg}}>

      {/* Month bubble sidebar */}
      <div style={{width:210,flexShrink:0,borderRight:`1px solid ${border}`,background:isDark?"#1e1e1e":surface,padding:"14px 10px",overflowY:"auto"}}>
        <style>{`.month-bubble{color:${text}}.month-nav-btn{width:26px;height:26px;border-radius:7px;border:1px solid ${border};background:${isDark?"#2a2a2a":amberBg};color:${text};font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;}.month-nav-btn:hover{background:${isDark?"#333":"#FFF0B8"}}`}</style>
        <MonthBubble
          bookings={bookings}
          workshopHours={workshopHours}
          maxCarsPerDay={workshop.max_cars_per_day}
          bookingMode={workshop.booking_mode}
          onDayClick={handleDayClick}
          selectedWeekStart={weekStart}
        />
      </div>

      {/* Main area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${border}`,background:isDark?"#1e1e1e":surface,flexShrink:0}}>
          <div>
            <h1 style={{fontSize:18,fontWeight:700,margin:0,color:text}}>Dagatal</h1>
            <p style={{fontSize:11,color:muted,margin:0}}>{formatDateRange(allWeekDays[0], allWeekDays[6])}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={goToToday} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${border}`,background:isDark?"#2a2a2a":amberBg,color:isDark?"#ccc":text}}>Í dag</button>
            <button onClick={goToPrevWeek} style={{width:28,height:28,borderRadius:8,border:`1px solid ${border}`,background:isDark?"#2a2a2a":amberBg,color:text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <button onClick={goToNextWeek} style={{width:28,height:28,borderRadius:8,border:`1px solid ${border}`,background:isDark?"#2a2a2a":amberBg,color:text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            <button onClick={() => openAddModal(new Date())} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",background:amber,color:"#111"}}>+ Bóka</button>
          </div>
        </div>

        {/* Pending alert */}
        {pendingBookings.length > 0 && (
          <div style={{margin:"8px 12px 0",padding:"8px 12px",background:isDark?"rgba(239,68,68,0.12)":"#fef2f2",border:`1px solid ${isDark?"rgba(239,68,68,0.35)":"#fecaca"}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"#ef4444",color:"white",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{pendingBookings.length}</div>
              <div>
                <p style={{fontSize:11,fontWeight:700,color:isDark?"#fca5a5":"#991b1b",margin:0}}>Bókanir bíða svars</p>
                <p style={{fontSize:10,color:isDark?"#f87171":"#dc2626",margin:0}}>Þarfnast tafarlausrar meðhöndlunar</p>
              </div>
            </div>
            <div style={{display:"flex",gap:5}}>
              {pendingBookings.slice(0,2).map(b => (
                <button key={b.id} onClick={() => setSelectedBooking(b)} style={{padding:"3px 8px",borderRadius:7,fontSize:10,fontWeight:600,cursor:"pointer",background:isDark?"rgba(239,68,68,0.2)":"#fee2e2",border:`1px solid ${isDark?"rgba(239,68,68,0.4)":"#fecaca"}`,color:isDark?"#fca5a5":"#991b1b"}}>
                  {b.customer_name ?? b.customer_plate ?? "Bókun"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calendar grid */}
        <div style={{flex:1,overflow:"auto",padding:"10px 12px 12px",display:"flex",flexDirection:"column",gap:8}}>

          {/* Mon–Fri main grid */}
          <div style={{
            display:"grid",
            gridTemplateColumns: weekDays.map(day => {
              const h = workshopHours.find(h => h.day_of_week === day.getDay());
              return (h?.is_closed ?? false) ? "0.28fr" : "1fr";
            }).join(" "),
            gap:8,
            flex:1,
            minHeight:200,
          }}>
            {weekDays.map(day => renderDayColumn(day))}
          </div>

          {/* Weekend row — smaller at bottom */}
          <div style={{display:"flex",gap:8,height:90}}>
            <div style={{display:"flex",gap:8,flex:1}}>
              {weekend.map(day => (
                <div key={day.toDateString()} style={{flex:1}}>
                  {renderDayColumn(day, true)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)",padding:16}}>
          <div style={{background:surface,borderRadius:20,border:`1px solid ${border}`,width:"100%",maxWidth:440,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 18px 12px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
              <div>
                <div style={{display:"flex",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                  <span style={{padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,border:"1px solid",
                    ...(selectedBooking.status==="pending"?{background:isDark?"rgba(239,68,68,0.15)":"#fef2f2",borderColor:isDark?"rgba(239,68,68,0.4)":"#fecaca",color:isDark?"#fca5a5":"#991b1b"}:
                       selectedBooking.status==="confirmed"?{background:isDark?"rgba(34,197,94,0.1)":"#f0fdf4",borderColor:"#86efac",color:"#166534"}:
                       {background:isDark?"#2a2a2a":"#f9fafb",borderColor:isDark?"#3a3a3a":"#e5e7eb",color:isDark?"#888":"#6b7280"})
                  }}>
                    {selectedBooking.status==="pending"?"Bíður":selectedBooking.status==="confirmed"?"Staðfest":selectedBooking.status==="completed"?"Lokið":"Annað"}
                  </span>
                </div>
                <h2 style={{fontSize:18,fontWeight:700,margin:0,color:text}}>{selectedBooking.customer_name ?? "Óþekktur viðskiptavinur"}</h2>
              </div>
              <button onClick={() => {setSelectedBooking(null);setShowDeclineInput(false);setDeclineReason("");}} style={{width:28,height:28,borderRadius:9,border:`1px solid ${border}`,background:isDark?"#2a2a2a":"#f9fafb",color:muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>

            <div style={{overflowY:"auto",flex:1,padding:"14px 18px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {label:"Tími",value:`${formatTime(selectedBooking.start_time)} – ${formatEndTime(selectedBooking.start_time,selectedBooking.duration_minutes)}`},
                  {label:"Lengd",value:`${selectedBooking.duration_minutes} mín`},
                  selectedBooking.customer_phone?{label:"Sími",value:selectedBooking.customer_phone}:null,
                  selectedBooking.customer_plate?{label:"Bílnúmer",value:selectedBooking.customer_plate}:null,
                  (selectedBooking.customer_car_make||selectedBooking.customer_car_model)?{label:"Bíll",value:[selectedBooking.customer_car_make,selectedBooking.customer_car_model,selectedBooking.customer_car_year].filter(Boolean).join(" ")}:null,
                  {label:"Þjónusta",value:(selectedBooking as any).service?.name_is??selectedBooking.service_label??"—"},
                ].filter((x): x is {label:string;value:string} => Boolean(x)).map(({label,value}) => (
                  <div key={label} style={{background:isDark?"#2a2a2a":amberBg,borderRadius:10,padding:"8px 10px",border:`1px solid ${isDark?"#333":amberBorder+"44"}`}}>
                    <p style={{fontSize:9,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 2px"}}>{label}</p>
                    <p style={{fontSize:13,fontWeight:600,color:text,margin:0}}>{value}</p>
                  </div>
                ))}
              </div>

              {selectedBooking.customer_notes && (
                <div style={{background:isDark?"rgba(59,130,246,0.1)":"#eff6ff",border:`1px solid ${isDark?"rgba(59,130,246,0.3)":"#bfdbfe"}`,borderRadius:12,padding:"10px 12px"}}>
                  <p style={{fontSize:9,fontWeight:700,color:isDark?"#60a5fa":"#1d4ed8",textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 4px"}}>Athugasemdir viðskiptavinar</p>
                  <p style={{fontSize:13,color:isDark?"#93c5fd":"#1e40af",fontStyle:"italic",margin:0}}>"{selectedBooking.customer_notes}"</p>
                </div>
              )}

              {showDeclineInput && (
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:muted,marginBottom:6}}>Ástæða höfnunar *</label>
                  <textarea value={declineReason} onChange={e=>setDeclineReason(e.target.value)} rows={3} placeholder="T.d. fullbókað..." style={{width:"100%",borderRadius:10,border:`1px solid ${border}`,background:isDark?"#1a1a1a":"white",color:text,padding:"8px 10px",fontSize:13,resize:"none",boxSizing:"border-box"}} />
                </div>
              )}
            </div>

            <div style={{padding:"10px 18px 14px",borderTop:`1px solid ${border}`,display:"flex",flexDirection:"column",gap:8}}>
              {selectedBooking.status==="pending" && !showDeclineInput && (
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>handleAction(selectedBooking.id,"confirm")} disabled={actionLoading} style={{flex:1,padding:"10px 0",borderRadius:12,border:"none",background:"#22c55e",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ Staðfesta</button>
                  <button onClick={()=>setShowDeclineInput(true)} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${isDark?"rgba(239,68,68,0.4)":"#fecaca"}`,background:isDark?"rgba(239,68,68,0.1)":"#fef2f2",color:isDark?"#fca5a5":"#dc2626",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Hafna</button>
                </div>
              )}
              {selectedBooking.status==="pending" && showDeclineInput && (
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>handleAction(selectedBooking.id,"decline")} disabled={actionLoading||!declineReason.trim()} style={{flex:1,padding:"10px 0",borderRadius:12,border:"none",background:"#ef4444",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",opacity:declineReason.trim()?1:0.5}}>{actionLoading?"Vista...":"Senda höfnun"}</button>
                  <button onClick={()=>{setShowDeclineInput(false);setDeclineReason("");}} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1px solid ${border}`,background:isDark?"#2a2a2a":"#f9fafb",color:muted,fontSize:13,fontWeight:700,cursor:"pointer"}}>Hætta við</button>
                </div>
              )}
              {selectedBooking.status==="confirmed" && (
                <button onClick={()=>handleAction(selectedBooking.id,"complete")} disabled={actionLoading} style={{width:"100%",padding:"10px 0",borderRadius:12,border:"none",background:isDark?"#333":"#111",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ Merkja sem lokið</button>
              )}
              <button onClick={()=>setSelectedBooking(null)} style={{width:"100%",padding:"8px 0",borderRadius:12,border:`1px solid ${border}`,background:"transparent",color:muted,fontSize:11,fontWeight:600,cursor:"pointer"}}>Loka</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddBookingModal
          workshop={workshop}
          defaultDate={addModalDate ?? new Date()}
          services={services}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
