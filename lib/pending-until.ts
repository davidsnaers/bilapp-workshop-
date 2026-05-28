// @ts-nocheck
// Calculate pending_until deadline for a new booking
// During business hours: 3 hours from now
// Outside business hours: 3 hours after next opening

interface WorkshopHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

function parseTime(timeStr: string): { h: number; m: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { h, m };
}

function setTime(date: Date, h: number, m: number): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function calculatePendingUntil(hours: WorkshopHour[], now = new Date()): Date {
  const RESPONSE_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

  // Get today's hours
  const todayDow = now.getDay();
  const todayHours = hours.find(h => h.day_of_week === todayDow);

  if (todayHours && !todayHours.is_closed && todayHours.open_time && todayHours.close_time) {
    const { h: oh, m: om } = parseTime(todayHours.open_time);
    const { h: ch, m: cm } = parseTime(todayHours.close_time);
    const openToday  = setTime(now, oh, om);
    const closeToday = setTime(now, ch, cm);

    // We are currently within business hours
    if (now >= openToday && now < closeToday) {
      const deadline = new Date(now.getTime() + RESPONSE_WINDOW_MS);
      // Cap at closing time
      return deadline < closeToday ? deadline : closeToday;
    }
  }

  // Outside business hours — find next opening
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + i);
    const nextDow = nextDate.getDay();
    const nextHours = hours.find(h => h.day_of_week === nextDow);

    if (nextHours && !nextHours.is_closed && nextHours.open_time) {
      const { h, m } = parseTime(nextHours.open_time);
      const nextOpen = setTime(nextDate, h, m);
      return new Date(nextOpen.getTime() + RESPONSE_WINDOW_MS);
    }
  }

  // Fallback — 24 hours
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
