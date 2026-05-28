// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { BookingWorkshop, Workshop } from "@/types/database";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AddBookingModal from "./AddBookingModal";
import MonthBubble from "./MonthBubble";
import { useTheme } from "@/components/ThemeProvider";

const WEEKDAYS_SHORT = ["Sun","Mán","Þri","Mið","Fim","Fös","Lau"];
const MONTHS_SHORT   = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];
const MONTHS_LONG    = ["janúar","febrúar","mars","apríl","maí","júní","júlí","ágúst","september","október","nóvember","desember"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateRange(from: Date, to: Date): string {
  return `${from.getDate()}. ${MONTHS_LONG[from.getMonth()]} – ${to.getDate()}. ${MONTHS_LONG[to.getMonth()]} ${to.getFullYear()}`;
}

function formatBookingDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const STATUS_STYLE: Record<string, string> = {
  pending:               "bg-red-100 border-red-300 text-red-800",
  confirmed:             "bg-green-100 border-green-300 text-green-800",
  completed:             "bg-gray-100 border-gray-300 text-gray-600",
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

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingWorkshop | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const pendingBookings = useMemo(() => bookings.filter(b => b.status === "pending"), [bookings]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, typeof bookings>();
    weekDays.forEach(day => {
      map.set(day.toDateString(), bookings.filter(b => isSameDay(new Date(b.start_time), day)));
    });
    return map;
  }, [bookings, weekDays]);

  const goToPrevWeek = () => setWeekStart(d => addDays(d, -7));
  const goToNextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToToday   = () => setWeekStart(startOfWeek(new Date()));

  const openAddModal = (date: Date) => { setAddModalDate(date); setShowAddModal(true); };

  const handleDayClick = (date: Date) => {
    setWeekStart(startOfWeek(date));
    router.push(`/bookings/day?date=${date.toISOString().split("T")[0]}`);
  };

  const handleAction = async (bookingId: string, action: "confirm" | "decline" | "complete") => {
    setActionLoading(true);
    try {
      if (action === "confirm") {
        const res = await fetch("/api/bookings/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: bookingId }),
        });
        if (!res.ok) throw new Error("Staðfesting mistókst");

      } else if (action === "decline") {
        if (!declineReason.trim()) { alert("Þú verður að skrifa ástæðu."); setActionLoading(false); return; }
        const res = await fetch("/api/bookings/decline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: bookingId, decline_reason: declineReason }),
        });
        if (!res.ok) throw new Error("Höfnun mistókst");

      } else if (action === "complete") {
        await (supabase as any)
          .from("bookings_workshop")
          .update({ status: "completed" })
          .eq("id", bookingId);
      }

      setSelectedBooking(null);
      setDeclineReason("");
      setShowDeclineInput(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message ?? "Eitthvað fór úrskeiðis");
    } finally {
      setActionLoading(false);
    }
  };

  const today = new Date();

  // Occupancy for each day in week
  const getOccupancyForDay = (day: Date): number => {
    const dow = day.getDay();
    const hours = workshopHours.find(h => h.day_of_week === dow);
    const dayBookings = (bookingsByDay.get(day.toDateString()) ?? []).filter(b =>
      !["declined","cancelled_by_user","cancelled_by_workshop","auto_cancelled"].includes(b.status)
    );

    if (workshop.booking_mode === "day_based") {
      return Math.min(100, Math.round((dayBookings.length / Math.max(1, workshop.max_cars_per_day)) * 100));
    } else {
      if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return 0;
      const [oh, om] = hours.open_time.split(":").map(Number);
      const [ch, cm] = hours.close_time.split(":").map(Number);
      const totalMins = (ch * 60 + cm) - (oh * 60 + om);
      const bookedMins = dayBookings.reduce((sum, b) => sum + b.duration_minutes, 0);
      return Math.min(100, Math.round((bookedMins / Math.max(1, totalMins)) * 100));
    }
  };

  const isDark = theme === "dark";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Month bubble sidebar ── */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${isDark ? "#3a3a3a" : "#e5e7eb"}`,
        background: isDark ? "#2a2a2a" : "white",
        padding: "16px 12px",
        overflowY: "auto",
      }}>
        <style>{`
          .month-bubble { color: var(--color-text-primary); }
          .month-nav-btn {
            width: 28px; height: 28px; border-radius: 8px;
            border: 0.5px solid var(--color-border-tertiary);
            background: var(--color-background-secondary);
            color: var(--color-text-primary);
            font-size: 16px; cursor: pointer; display: flex;
            align-items: center; justify-content: center;
          }
          .month-nav-btn:hover { background: var(--color-background-tertiary); }
        `}</style>
        <MonthBubble
          bookings={bookings}
          workshopHours={workshopHours}
          maxCarsPerDay={workshop.max_cars_per_day}
          bookingMode={workshop.booking_mode}
          onDayClick={handleDayClick}
          selectedWeekStart={weekStart}
        />
      </div>

      {/* ── Main calendar area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", borderBottom: `1px solid ${isDark ? "#3a3a3a" : "#e5e7eb"}`,
          background: isDark ? "#2a2a2a" : "white", flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: isDark ? "#f4f4f4" : "#111" }}>Dagatal</h1>
            <p style={{ fontSize: 12, color: isDark ? "#888" : "#6b7280", margin: 0 }}>
              {formatDateRange(weekDays[0], weekDays[6])}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={goToToday} style={{
              padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
              background: isDark ? "#333" : "white",
              color: isDark ? "#ccc" : "#374151",
            }}>Í dag</button>
            <button onClick={goToPrevWeek} style={{
              width: 32, height: 32, borderRadius: 10, border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
              background: isDark ? "#333" : "white", color: isDark ? "#ccc" : "#6b7280",
              fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <button onClick={goToNextWeek} style={{
              width: 32, height: 32, borderRadius: 10, border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
              background: isDark ? "#333" : "white", color: isDark ? "#ccc" : "#6b7280",
              fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
            <button onClick={() => openAddModal(new Date())} style={{
              padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: "none", background: "#F5B301", color: "#111",
            }}>+ Bóka</button>
          </div>
        </div>

        {/* Pending alert */}
        {pendingBookings.length > 0 && (
          <div style={{
            margin: "10px 16px 0", padding: "10px 14px",
            background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2",
            border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`,
            borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", background: "#ef4444",
                color: "white", fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{pendingBookings.length}</div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#fca5a5" : "#991b1b", margin: 0 }}>Bókanir bíða svars</p>
                <p style={{ fontSize: 11, color: isDark ? "#f87171" : "#dc2626", margin: 0 }}>Smelltu til að skoða</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {pendingBookings.slice(0, 2).map(b => (
                <button key={b.id} onClick={() => setSelectedBooking(b)} style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: isDark ? "rgba(239,68,68,0.2)" : "#fee2e2",
                  border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fecaca"}`,
                  color: isDark ? "#fca5a5" : "#991b1b",
                }}>{b.customer_name ?? b.customer_plate ?? "Bókun"}</button>
              ))}
            </div>
          </div>
        )}

        {/* Week grid */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px 16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: weekDays.map(day => {
              const h = workshopHours.find(h => h.day_of_week === day.getDay());
              return (h?.is_closed ?? false) ? "0.32fr" : "1fr";
            }).join(" "),
            gap: 8, minHeight: "100%",
          }}>
            {weekDays.map(day => {
              const isToday = isSameDay(day, today);
              const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];
              const isPast = day < today && !isToday;
              const occupancy = getOccupancyForDay(day);
              const hours = workshopHours.find(h => h.day_of_week === day.getDay());
              const isClosed = hours?.is_closed ?? false;

              const cardBg = isClosed
                ? isDark ? "#252525" : "#f9fafb"
                : isDark
                  ? isToday ? "#3a3200" : "#2e2e2e"
                  : isToday ? "#fffbeb" : "white";
              const cardBorder = isClosed
                ? isDark ? "#2e2e2e" : "#f3f4f6"
                : isDark
                  ? isToday ? "#F5B301" : "#3a3a3a"
                  : isToday ? "#fbbf24" : "#e5e7eb";

              // Closed day — compact vertical layout
              if (isClosed) {
                return (
                  <div key={day.toDateString()} style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "flex-start", minHeight: 180,
                    borderRadius: 12, border: `1px solid ${cardBorder}`,
                    background: cardBg, opacity: 0.5, padding: "10px 4px",
                    overflow: "hidden",
                  }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px", color: isDark ? "#555" : "#d1d5db" }}>
                      {WEEKDAYS_SHORT[day.getDay()]}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: isDark ? "#444" : "#d1d5db" }}>
                      {day.getDate()}
                    </p>
                    {/* Rotated "Lokað" label */}
                    <div style={{
                      writingMode: "vertical-rl", textOrientation: "mixed",
                      fontSize: 9, fontWeight: 700, letterSpacing: "1px",
                      color: isDark ? "#444" : "#d1d5db", textTransform: "uppercase",
                      transform: "rotate(180deg)",
                    }}>Lokað</div>
                  </div>
                );
              }

              return (
                <div key={day.toDateString()} style={{
                  display: "flex", flexDirection: "column", minHeight: 180,
                  borderRadius: 16, border: `1px solid ${cardBorder}`,
                  background: cardBg, opacity: isPast ? 0.6 : 1,
                }}>
                  {/* Day header */}
                  <div style={{
                    padding: "8px 10px 6px",
                    borderBottom: `1px solid ${isDark ? "#3a3a3a" : "#f3f4f6"}`,
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                  }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, color: isToday ? "#F5B301" : isDark ? "#666" : "#9ca3af" }}>
                        {WEEKDAYS_SHORT[(day.getDay())]}
                      </p>
                      <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: isToday ? "#F5B301" : isDark ? "#f4f4f4" : "#111" }}>
                        {day.getDate()}
                      </p>
                      <div style={{ marginTop: 4, width: "100%", height: 3, background: isDark ? "#444" : "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999,
                          width: `${occupancy}%`,
                          background: occupancy < 40 ? "#22c55e" : occupancy < 75 ? "#f59e0b" : "#ef4444",
                          transition: "width 0.3s",
                        }} />
                      </div>
                      {occupancy > 0 && (
                        <p style={{ fontSize: 9, color: isDark ? "#666" : "#9ca3af", margin: "2px 0 0", fontWeight: 600 }}>{occupancy}% uppfyllt</p>
                      )}
                    </div>
                    <button onClick={() => openAddModal(day)} style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
                      background: isDark ? "#333" : "#f9fafb",
                      color: isDark ? "#888" : "#9ca3af",
                      fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>+</button>
                  </div>

                  {/* Bookings */}
                  <div style={{ flex: 1, padding: "6px 6px 8px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
                    {dayBookings.length === 0 && (
                      <p style={{ fontSize: 10, color: isDark ? "#444" : "#e5e7eb", textAlign: "center", marginTop: 12, fontWeight: 500 }}>
                        Engar bókanir
                      </p>
                    )}
                    {dayBookings.map(booking => {
                      const styleKey = booking.status in STATUS_STYLE ? booking.status : "completed";
                      const isPending = booking.status === "pending";
                      return (
                        <button key={booking.id} onClick={() => setSelectedBooking(booking)} style={{
                          textAlign: "left", padding: "5px 7px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${isPending ? "#fca5a5" : isDark ? "#3a3a3a" : "#e5e7eb"}`,
                          background: isPending
                            ? isDark ? "rgba(239,68,68,0.15)" : "#fef2f2"
                            : booking.status === "confirmed"
                            ? isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4"
                            : isDark ? "#333" : "#f9fafb",
                          width: "100%",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              color: isPending ? (isDark ? "#fca5a5" : "#991b1b") : isDark ? "#e4e4e4" : "#111",
                            }}>{booking.customer_name ?? booking.customer_plate ?? "Bókun"}</span>
                            <span style={{ fontSize: 10, color: isDark ? "#666" : "#9ca3af", flexShrink: 0 }}>{formatTime(booking.start_time)}</span>
                          </div>
                          {((booking as any).service?.name_is ?? booking.service_label) && (
                            <span style={{ fontSize: 10, color: isDark ? "#888" : "#6b7280", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {(booking as any).service?.name_is ?? booking.service_label}
                            </span>
                          )}
                          {/* Duration bar */}
                          <div style={{ marginTop: 3, height: 2, background: isDark ? "#444" : "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 999,
                              width: `${Math.min(100, Math.round((booking.duration_minutes / 480) * 100))}%`,
                              background: isPending ? "#ef4444" : booking.status === "confirmed" ? "#22c55e" : isDark ? "#555" : "#d1d5db",
                            }} />
                          </div>
                          <span style={{ fontSize: 9, color: isDark ? "#555" : "#d1d5db", fontWeight: 600 }}>{booking.duration_minutes} mín</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Day footer */}
                  {dayBookings.length > 0 && (
                    <div style={{ padding: "6px 8px", borderTop: `1px solid ${isDark ? "#3a3a3a" : "#f3f4f6"}` }}>
                      <button onClick={() => router.push(`/bookings/day?date=${day.toISOString().split("T")[0]}`)} style={{
                        fontSize: 10, fontWeight: 600, color: isDark ? "#888" : "#9ca3af",
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                      }}>
                        {dayBookings.length} bókun{dayBookings.length !== 1 ? "ar" : ""} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}>
          <div style={{
            background: isDark ? "#2a2a2a" : "white",
            borderRadius: 20, border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
            width: "100%", maxWidth: 440, maxHeight: "85vh",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${isDark ? "#3a3a3a" : "#f3f4f6"}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid", ...(selectedBooking.status === "pending" ? { background: isDark ? "rgba(239,68,68,0.15)" : "#fef2f2", borderColor: isDark ? "#f87171" : "#fecaca", color: isDark ? "#fca5a5" : "#991b1b" } : selectedBooking.status === "confirmed" ? { background: isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4", borderColor: "#86efac", color: "#166534" } : { background: isDark ? "#333" : "#f9fafb", borderColor: isDark ? "#555" : "#e5e7eb", color: isDark ? "#888" : "#6b7280" }) }}>
                    {STATUS_LABEL[selectedBooking.status] ?? selectedBooking.status}
                  </span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: isDark ? "#f4f4f4" : "#111" }}>
                  {selectedBooking.customer_name ?? "Óþekktur viðskiptavinur"}
                </h2>
              </div>
              <button onClick={() => { setSelectedBooking(null); setShowDeclineInput(false); setDeclineReason(""); }} style={{
                width: 30, height: 30, borderRadius: 10, border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
                background: isDark ? "#333" : "#f9fafb", color: isDark ? "#888" : "#6b7280",
                fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Tími", value: formatBookingDateTime(selectedBooking.start_time) },
                  { label: "Lengd", value: `${selectedBooking.duration_minutes} mín` },
                  selectedBooking.customer_phone ? { label: "Sími", value: selectedBooking.customer_phone } : null,
                  selectedBooking.customer_plate ? { label: "Bílnúmer", value: selectedBooking.customer_plate } : null,
                  (selectedBooking.customer_car_make || selectedBooking.customer_car_model) ? { label: "Bíll", value: [selectedBooking.customer_car_make, selectedBooking.customer_car_model, selectedBooking.customer_car_year].filter(Boolean).join(" ") } : null,
                  { label: "Þjónusta", value: (selectedBooking as any).service?.name_is ?? selectedBooking.service_label ?? "—" },
                ].filter((x): x is { label: string; value: string } => Boolean(x)).map(({ label, value }) => (
                  <div key={label} style={{ background: isDark ? "#333" : "#f9fafb", borderRadius: 10, padding: "8px 10px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#666" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#e4e4e4" : "#111", margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {selectedBooking.customer_notes && (
                <div style={{ background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"}`, borderRadius: 12, padding: "10px 12px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Athugasemdir viðskiptavinar</p>
                  <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af", fontStyle: "italic", margin: 0 }}>"{selectedBooking.customer_notes}"</p>
                </div>
              )}

              {showDeclineInput && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: isDark ? "#888" : "#374151", marginBottom: 6 }}>Ástæða höfnunar *</label>
                  <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3}
                    placeholder="T.d. fullbókað..."
                    style={{
                      width: "100%", borderRadius: 10, border: `1px solid ${isDark ? "#555" : "#e5e7eb"}`,
                      background: isDark ? "#333" : "#f9fafb", color: isDark ? "#e4e4e4" : "#111",
                      padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box",
                    }} />
                </div>
              )}
            </div>

            <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${isDark ? "#3a3a3a" : "#f3f4f6"}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedBooking.status === "pending" && !showDeclineInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction(selectedBooking.id, "confirm")} disabled={actionLoading} style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                    background: "#22c55e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>✓ Staðfesta</button>
                  <button onClick={() => setShowDeclineInput(true)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 12,
                    border: `1px solid ${isDark ? "#555" : "#fecaca"}`,
                    background: isDark ? "#3a2020" : "#fef2f2",
                    color: isDark ? "#fca5a5" : "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>✕ Hafna</button>
                </div>
              )}
              {selectedBooking.status === "pending" && showDeclineInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction(selectedBooking.id, "decline")} disabled={actionLoading || !declineReason.trim()} style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                    background: "#ef4444", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: declineReason.trim() ? 1 : 0.5,
                  }}>{actionLoading ? "Vista..." : "Senda höfnun"}</button>
                  <button onClick={() => { setShowDeclineInput(false); setDeclineReason(""); }} style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
                    background: isDark ? "#333" : "#f9fafb", color: isDark ? "#888" : "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>Hætta við</button>
                </div>
              )}
              {selectedBooking.status === "confirmed" && (
                <button onClick={() => handleAction(selectedBooking.id, "complete")} disabled={actionLoading} style={{
                  width: "100%", padding: "10px 0", borderRadius: 12, border: "none",
                  background: isDark ? "#333" : "#111", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>✓ Merkja sem lokið</button>
              )}
              <button onClick={() => setSelectedBooking(null)} style={{
                width: "100%", padding: "8px 0", borderRadius: 12, border: `1px solid ${isDark ? "#444" : "#e5e7eb"}`,
                background: "transparent", color: isDark ? "#666" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>Loka</button>
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
