// @ts-nocheck
// Resend email service
// Add to .env.local: RESEND_API_KEY=re_xxxxxxxxxxxx
// Sign up at resend.com — free up to 3000 emails/month
// Set FROM_EMAIL to your verified domain email e.g. bókanir@bilapp.is

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL ?? "Bílapp <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping email to", to);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    const json = await res.json();
    if (!res.ok) { console.error("[Email] Resend error:", json); return false; }
    console.log("[Email] ✓ Sent to", to, "id:", json.id);
    return true;
  } catch (e) {
    console.error("[Email] Fetch failed:", e);
    return false;
  }
}

// ── Email templates ───────────────────────────────────────────

export function emailBookingReceived(params: {
  customerName: string;
  workshopName: string;
  serviceName: string;
  dateStr: string;
  plate: string;
  isDayBased?: boolean;
}): { subject: string; html: string } {
  const { customerName, workshopName, serviceName, dateStr, plate, isDayBased } = params;

  return {
    subject: `Bókun móttekin — ${workshopName}`,
    html: `
<!DOCTYPE html>
<html lang="is">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #e8e0d0">

    <!-- Header -->
    <div style="background:#111;padding:24px 28px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;background:#F5B301;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#111">B</div>
      <div>
        <div style="color:white;font-weight:800;font-size:16px">Bílapp</div>
        <div style="color:#888;font-size:12px">Bókunarkerfi</div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px">
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">✅</span>
        <div>
          <div style="font-weight:700;color:#166534;font-size:14px">Bókun móttekin!</div>
          <div style="color:#166534;font-size:12px">Verkstæðið staðfestir fljótlega</div>
        </div>
      </div>

      <p style="font-size:15px;color:#1a1109;margin:0 0 20px">Hæ ${customerName},</p>
      <p style="font-size:14px;color:#555;margin:0 0 24px;line-height:1.6">
        Við höfum móttekið bókun þína hjá <strong>${workshopName}</strong>. Verkstæðið mun staðfesta bókunina og hafa samband ef þarf.
      </p>

      <!-- Details -->
      <div style="background:#FFFDF8;border:1px solid #f0e8d8;border-radius:14px;padding:16px;margin-bottom:24px">
        ${[
          ["🔧 Þjónusta", serviceName],
          ["📅 Dagsetning", isDayBased ? dateStr.split(" kl.")[0] + " — tími staðfestur af verkstæði" : dateStr],
          ["🚗 Bílnúmer", plate],
        ].map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0e8d8">
            <span style="font-size:13px;color:#8b7355">${label}</span>
            <span style="font-size:13px;font-weight:700;color:#1a1109">${value}</span>
          </div>
        `).join("")}
      </div>

      <p style="font-size:13px;color:#888;margin:0;line-height:1.6">
        Ef þú þarft að breyta eða afbóka skaltu hafa samband við verkstæðið beint.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9f9f7;border-top:1px solid #f0e8d8;padding:16px 28px;text-align:center">
      <p style="font-size:11px;color:#aaa;margin:0">Keyrt af Bílapp · bilapp.is</p>
    </div>
  </div>
</body>
</html>`,
  };
}

export function emailBookingConfirmed(params: {
  customerName: string;
  workshopName: string;
  workshopPhone: string;
  serviceName: string;
  dateStr: string;
  plate: string;
}): { subject: string; html: string } {
  const { customerName, workshopName, workshopPhone, serviceName, dateStr, plate } = params;

  return {
    subject: `Bókun staðfest ✓ — ${workshopName}`,
    html: `
<!DOCTYPE html>
<html lang="is">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #e8e0d0">

    <div style="background:#111;padding:24px 28px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;background:#F5B301;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#111">B</div>
      <div>
        <div style="color:white;font-weight:800;font-size:16px">Bílapp</div>
        <div style="color:#888;font-size:12px">Bókunarkerfi</div>
      </div>
    </div>

    <div style="padding:28px">
      <div style="background:#FFF0B8;border:1px solid #F5B301;border-radius:12px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🎉</span>
        <div>
          <div style="font-weight:700;color:#7a4f00;font-size:14px">Bókun staðfest!</div>
          <div style="color:#7a4f00;font-size:12px">Við hlökkum til að sjá þig</div>
        </div>
      </div>

      <p style="font-size:15px;color:#1a1109;margin:0 0 20px">Hæ ${customerName},</p>
      <p style="font-size:14px;color:#555;margin:0 0 24px;line-height:1.6">
        <strong>${workshopName}</strong> hefur staðfest bókun þína. Við hlökkum til að sjá þig!
      </p>

      <div style="background:#FFFDF8;border:1px solid #f0e8d8;border-radius:14px;padding:16px;margin-bottom:24px">
        ${[
          ["🔧 Þjónusta", serviceName],
          ["📅 Tími", dateStr],
          ["🚗 Bílnúmer", plate],
          ["📞 Sími verkstæðis", workshopPhone || "—"],
        ].map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0e8d8">
            <span style="font-size:13px;color:#8b7355">${label}</span>
            <span style="font-size:13px;font-weight:700;color:#1a1109">${value}</span>
          </div>
        `).join("")}
      </div>

      <p style="font-size:13px;color:#888;margin:0;line-height:1.6">
        Mundu að koma með bílinn á réttum tíma. Ef eitthvað kemur upp skaltu hringja í ${workshopPhone ?? "verkstæðið"}.
      </p>
    </div>

    <div style="background:#f9f9f7;border-top:1px solid #f0e8d8;padding:16px 28px;text-align:center">
      <p style="font-size:11px;color:#aaa;margin:0">Keyrt af Bílapp · bilapp.is</p>
    </div>
  </div>
</body>
</html>`,
  };
}

export function emailBookingDeclined(params: {
  customerName: string;
  workshopName: string;
  serviceName: string;
  reason: string;
}): { subject: string; html: string } {
  const { customerName, workshopName, serviceName, reason } = params;

  return {
    subject: `Bókun hafnað — ${workshopName}`,
    html: `
<!DOCTYPE html>
<html lang="is">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #e8e0d0">

    <div style="background:#111;padding:24px 28px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;background:#F5B301;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#111">B</div>
      <div>
        <div style="color:white;font-weight:800;font-size:16px">Bílapp</div>
        <div style="color:#888;font-size:12px">Bókunarkerfi</div>
      </div>
    </div>

    <div style="padding:28px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">❌</span>
        <div>
          <div style="font-weight:700;color:#991b1b;font-size:14px">Bókun hafnað</div>
          <div style="color:#991b1b;font-size:12px">Vinsamlega bókaðu aftur</div>
        </div>
      </div>

      <p style="font-size:15px;color:#1a1109;margin:0 0 20px">Hæ ${customerName},</p>
      <p style="font-size:14px;color:#555;margin:0 0 16px;line-height:1.6">
        Því miður gat <strong>${workshopName}</strong> ekki tekið við bókun þinni fyrir <strong>${serviceName}</strong>.
      </p>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Ástæða</div>
        <div style="font-size:14px;color:#1a1109">${reason}</div>
      </div>

      <p style="font-size:13px;color:#888;margin:0;line-height:1.6">
        Við mælum með að bóka aftur eða hafa samband við verkstæðið beint.
      </p>
    </div>

    <div style="background:#f9f9f7;border-top:1px solid #f0e8d8;padding:16px 28px;text-align:center">
      <p style="font-size:11px;color:#aaa;margin:0">Keyrt af Bílapp · bilapp.is</p>
    </div>
  </div>
</body>
</html>`,
  };
}
