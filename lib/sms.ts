// @ts-nocheck
// ── Twilio SMS service ────────────────────────────────────────
// Add to .env.local:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=your_auth_token
//   TWILIO_MESSAGING_SID=MG90efecda10fe96eb00a081c8161bdaf8

const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SID = process.env.TWILIO_MESSAGING_SID;

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_MESSAGING_SID) {
    console.warn("[SMS] Twilio credentials not configured — skipping SMS to", to);
    return false;
  }

  // Normalise number — add +354 if not already international
  const normalised = to.startsWith("+") ? to : `+354${to.replace(/[\s\-()]/g, "")}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const body = new URLSearchParams({
      To:                  normalised,
      MessagingServiceSid: TWILIO_MESSAGING_SID,
      Body:                message,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("[SMS] Twilio error:", json.message ?? json);
      return false;
    }

    console.log("[SMS] ✓ Sent to", normalised, "SID:", json.sid);
    return true;
  } catch (e) {
    console.error("[SMS] Fetch failed:", e);
    return false;
  }
}

// ── Icelandic message templates ───────────────────────────────

export const SMS_TEMPLATES = {
  workshopNewBooking: (customerName: string, service: string, date: string) =>
    `Bílapp: Ný bókun frá ${customerName} — ${service} ${date}. Opnaðu Bílapp til að staðfesta eða hafna.`,

  customerBookingReceived: (workshopName: string, service: string, date: string) =>
    `Bílapp: Bókun þín hjá ${workshopName} fyrir ${service} ${date} hefur verið móttekin. Verkstæðið staðfestir fljótlega.`,

  customerConfirmed: (workshopName: string, service: string, date: string, phone: string) =>
    `Bílapp: Bókun þín hjá ${workshopName} er staðfest! ${service} ${date}.${phone ? ` Sími: ${phone}.` : ""}`,

  customerDeclined: (workshopName: string, reason: string) =>
    `Bílapp: ${workshopName} gat ekki tekið við bókuninni. Ástæða: ${reason}. Vinsamlega bókaðu aftur.`,

  customerAutoCancelled: (workshopName: string) =>
    `Bílapp: Bókun þín hjá ${workshopName} var sjálfkrafa aflýst þar sem verkstæðið svaraði ekki í tíma. Vinsamlega bókaðu aftur.`,

  customerReminder24h: (workshopName: string, service: string, date: string) =>
    `Bílapp: Áminning — ${service} hjá ${workshopName} á morgun ${date}.`,

  customerReminder2h: (workshopName: string, service: string, time: string) =>
    `Bílapp: Áminning — ${service} hjá ${workshopName} í dag kl. ${time}.`,
};
