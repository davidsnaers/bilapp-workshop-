// @ts-nocheck
// Client-side booking action helpers
// These call the API routes which handle SMS + DB update together

export async function confirmBooking(bookingId: string): Promise<boolean> {
  const res = await fetch("/api/bookings/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  return res.ok;
}

export async function declineBooking(bookingId: string, reason: string): Promise<boolean> {
  if (!reason.trim()) return false;
  const res = await fetch("/api/bookings/decline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId, decline_reason: reason }),
  });
  return res.ok;
}

export async function createBooking(data: Record<string, any>): Promise<{ id: string } | null> {
  const res = await fetch("/api/bookings/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.booking;
}
