"use client";

import { useState, useMemo } from "react";
import type { BookingWorkshop } from "@/types/database";

const MONTHS = ["Janúar","Febrúar","Mars","Apríl","Maí","Júní","Júlí","Ágúst","September","Október","Nóvember","Desember"];
const DAYS_SHORT = ["Mán","Þri","Mið","Fim","Fös","Lau","Sun"];

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first day index (0=Mon, 6=Sun)
function mondayFirstDay(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

interface DayStats {
  bookingCount: number;
  occupancyPct: number;
  hasPending: boolean;
}

interface Props {
  bookings: (BookingWorkshop & { service?: { name_is: string } | null })[];
  workshopHours: { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }[];
  maxCarsPerDay: number;
  bookingMode: string;
  onDayClick: (date: Date) => void;
  selectedWeekStart: Date;
}

export default function MonthBubble({ bookings, workshopHours, maxCarsPerDay, bookingMode, onDayClick, selectedWeekStart }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const goToToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build day stats map
  const dayStatsMap = useMemo(() => {
    const map = new Map<string, DayStats>();
    const totalDays = daysInMonth(viewYear, viewMonth);

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = date.toDateString();
      const dow = date.getDay(); // 0=Sun
      const hours = workshopHours.find(h => h.day_of_week === dow);

      const dayBookings = bookings.filter(b => {
        const bd = new Date(b.start_time);
        return bd.getFullYear() === viewYear && bd.getMonth() === viewMonth && bd.getDate() === d
          && !["declined","cancelled_by_user","cancelled_by_workshop","auto_cancelled"].includes(b.status);
      });

      let occupancyPct = 0;

      if (bookingMode === "day_based") {
        occupancyPct = Math.min(100, Math.round((dayBookings.length / Math.max(1, maxCarsPerDay)) * 100));
      } else {
        // Time-based: sum duration vs total open minutes
        if (hours && !hours.is_closed && hours.open_time && hours.close_time) {
          const [oh, om] = hours.open_time.split(":").map(Number);
          const [ch, cm] = hours.close_time.split(":").map(Number);
          const totalMins = (ch * 60 + cm) - (oh * 60 + om);
          const bookedMins = dayBookings.reduce((sum, b) => sum + b.duration_minutes, 0);
          occupancyPct = Math.min(100, Math.round((bookedMins / Math.max(1, totalMins)) * 100));
        }
      }

      map.set(dateStr, {
        bookingCount: dayBookings.length,
        occupancyPct,
        hasPending: dayBookings.some(b => b.status === "pending"),
      });
    }

    return map;
  }, [bookings, viewYear, viewMonth, workshopHours, maxCarsPerDay, bookingMode]);

  // Calendar grid
  const firstDay = startOfMonth(viewYear, viewMonth);
  const firstDayOffset = mondayFirstDay(firstDay);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const isInSelectedWeek = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    const weekEnd = new Date(selectedWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return date >= selectedWeekStart && date <= weekEnd;
  };

  const getOccupancyColor = (pct: number): string => {
    if (pct === 0) return "var(--color-border-tertiary)";
    if (pct < 40) return "#22c55e";
    if (pct < 75) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="month-bubble">
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} className="month-nav-btn">‹</button>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{MONTHS[viewMonth]}</p>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{viewYear}</p>
        </div>
        <button onClick={nextMonth} className="month-nav-btn">›</button>
      </div>

      {/* Today button */}
      <button onClick={goToToday} style={{
        display: "block", width: "100%", marginBottom: 10,
        padding: "5px 0", fontSize: 11, fontWeight: 600,
        background: "var(--color-background-secondary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        color: "var(--color-text-secondary)", cursor: "pointer",
      }}>Í dag</button>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--color-text-secondary)", paddingBottom: 2 }}>{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const date = new Date(viewYear, viewMonth, day);
          const stats = dayStatsMap.get(date.toDateString());
          const isToday = date.toDateString() === today.toDateString();
          const inWeek = isInSelectedWeek(day);
          const isPast = date < today && !isToday;

          return (
            <button
              key={day}
              onClick={() => onDayClick(date)}
              title={stats?.bookingCount ? `${stats.bookingCount} bókanir · ${stats.occupancyPct}% uppfyllt` : ""}
              style={{
                position: "relative",
                padding: "4px 2px 6px",
                borderRadius: 6,
                border: isToday ? "1.5px solid #F5B301" : inWeek ? "1px solid var(--color-border-secondary)" : "0.5px solid transparent",
                background: inWeek ? "var(--color-background-secondary)" : "transparent",
                cursor: "pointer",
                opacity: isPast ? 0.5 : 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              {/* Day number */}
              <span style={{
                fontSize: 11,
                fontWeight: isToday ? 700 : 500,
                color: isToday ? "#F5B301" : "var(--color-text-primary)",
              }}>{day}</span>

              {/* Booking dot + count */}
              {stats && stats.bookingCount > 0 ? (
                <>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: stats.hasPending ? "#ef4444" : "var(--color-text-secondary)",
                    lineHeight: 1,
                  }}>{stats.bookingCount}</span>

                  {/* Occupancy bar */}
                  <div style={{
                    width: "80%", height: 2, borderRadius: 999,
                    background: "var(--color-border-tertiary)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${stats.occupancyPct}%`,
                      height: "100%",
                      background: getOccupancyColor(stats.occupancyPct),
                      borderRadius: 999,
                    }} />
                  </div>
                </>
              ) : (
                <div style={{ height: 14 }} />
              )}

              {/* Pending indicator */}
              {stats?.hasPending && (
                <div style={{
                  position: "absolute", top: 2, right: 2,
                  width: 4, height: 4, borderRadius: "50%",
                  background: "#ef4444",
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Uppfyllt %</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { color: "#22c55e", label: "0–40% laust" },
            { color: "#f59e0b", label: "40–75% að fylla" },
            { color: "#ef4444", label: "75%+ fullt" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginLeft: 2 }} />
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Bíður svars</span>
          </div>
        </div>
      </div>
    </div>
  );
}
