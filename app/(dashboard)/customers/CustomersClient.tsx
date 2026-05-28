// @ts-nocheck
"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";

const MONTHS = ["jan","feb","mar","apr","maí","jún","júl","ágú","sep","okt","nóv","des"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "í dag";
  if (days === 1) return "í gær";
  if (days < 30) return `${days} dögum síðan`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mánuðum síðan`;
  return `${Math.floor(months / 12)} ári síðan`;
}

const STATUS_LABEL: Record<string, string> = { pending: "Bíður", confirmed: "Staðfest", completed: "Lokið", declined: "Hafnað", cancelled_by_user: "Aflýst", cancelled_by_workshop: "Aflýst", auto_cancelled: "Aflýst", no_show: "Mætti ekki" };

interface Customer {
  name: string; phone: string | null; plate: string | null;
  carMake: string | null; carModel: string | null; bookings: any[];
}

export default function CustomersClient({ customers }: { customers: Customer[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");

  const bg      = isDark ? "#1e1e1e" : "#f9fafb";
  const surface = isDark ? "#252525" : "#ffffff";
  const border  = isDark ? "#2e2e2e" : "#e5e7eb";
  const text    = isDark ? "#f4f4f4" : "#111827";
  const muted   = isDark ? "#888"    : "#6b7280";
  const subsurf = isDark ? "#2e2e2e" : "#f9fafb";
  const amber   = isDark ? "#E8A800" : "#F5B301";

  // Search by plate OR name OR phone — plate match takes priority
  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase().replace(/[\s\-]/g, "");
    const plate = (c.plate ?? "").toLowerCase().replace(/[\s\-]/g, "");
    // Plate match — partial match works
    if (plate.includes(q)) return true;
    // Phone match
    if ((c.phone ?? "").includes(q)) return true;
    // Name match
    if ((c.name ?? "").toLowerCase().includes(search.toLowerCase())) return true;
    return false;
  });

  const getStatusColor = (status: string) => {
    if (status === "completed") return { bg: isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4", border: isDark ? "rgba(34,197,94,0.3)" : "#86efac", color: isDark ? "#86efac" : "#166534" };
    if (status === "pending")   return { bg: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", border: isDark ? "rgba(239,68,68,0.3)" : "#fecaca", color: isDark ? "#fca5a5" : "#991b1b" };
    if (status === "no_show")   return { bg: isDark ? "rgba(249,115,22,0.1)" : "#fff7ed", border: isDark ? "rgba(249,115,22,0.3)" : "#fed7aa", color: isDark ? "#fdba74" : "#9a3412" };
    return { bg: subsurf, border, color: muted };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: bg, color: text }}>
      <div style={{ padding: "18px 24px 16px", borderBottom: `1px solid ${border}`, background: surface }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 2px", color: text }}>Viðskiptavinir</h1>
        <p style={{ fontSize: 13, color: muted, margin: "0 0 12px" }}>{customers.length} viðskiptavinir skráðir</p>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Leita eftir bílnúmeri, nafni eða síma..."
          style={{ width: "100%", maxWidth: 360, padding: "8px 14px", borderRadius: 10, border: `1px solid ${border}`, background: subsurf, color: text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        <p style={{ fontSize: 11, color: muted, margin: "4px 0 0" }}>Sama bílnúmer = sama heimsókn, óháð nafni</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {filtered.length === 0 && (
          <div style={{ background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "64px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>👤</p>
            <p style={{ fontWeight: 700, color: text, margin: 0 }}>Engir viðskiptavinir fundust</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {filtered.map((customer, i) => {
            const lastBooking = customer.bookings[0];
            const totalVisits = customer.bookings.filter((b: any) => b.status === "completed").length;
            return (
              <button key={i} onClick={() => setSelected(customer)} style={{ textAlign: "left", background: surface, borderRadius: 16, border: `1px solid ${border}`, padding: "14px 16px", cursor: "pointer", color: text, width: "100%" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? "rgba(232,168,0,0.15)" : "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: amber, flexShrink: 0 }}>
                    {customer.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</p>
                    {customer.phone && <p style={{ fontSize: 12, color: muted, margin: "2px 0 0" }}>{customer.phone}</p>}
                  </div>
                </div>
                {customer.plate && (
                  <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: subsurf, border: `1px solid ${border}`, color: muted, marginBottom: 8 }}>
                    🚗 {customer.plate}{customer.carMake ? ` · ${customer.carMake}` : ""}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: muted }}>
                  <span>{totalVisits > 0 ? `${totalVisits} heimsókn${totalVisits !== 1 ? "ir" : ""}` : "Aldrei lokið"}</span>
                  {lastBooking && <span>{timeAgo(lastBooking.start_time)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }}>
          <div style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 480, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? "rgba(232,168,0,0.15)" : "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: amber }}>
                  {selected.name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>{selected.name}</h2>
                  {selected.phone && <p style={{ fontSize: 13, color: muted, margin: 0 }}>{selected.phone}</p>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 30, height: 30, borderRadius: 10, border: `1px solid ${border}`, background: subsurf, color: muted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {(selected.plate || selected.carMake) && (
                <div style={{ background: subsurf, borderRadius: 12, padding: "10px 12px", border: `1px solid ${border}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>Bíll</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: text, margin: 0 }}>{[selected.plate, selected.carMake, selected.carModel].filter(Boolean).join(" · ")}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>
                  Þjónustusaga ({selected.bookings.length} bókun{selected.bookings.length !== 1 ? "ir" : ""})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selected.bookings.map((b: any, i: number) => {
                    const sc = getStatusColor(b.status);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: subsurf, borderRadius: 10, border: `1px solid ${border}`, padding: "10px 12px" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: text, margin: 0 }}>{b.service?.name_is ?? b.service_label ?? "Þjónusta"}</p>
                          <p style={{ fontSize: 11, color: muted, margin: "2px 0 0" }}>{formatDate(b.start_time)}</p>
                        </div>
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>{STATUS_LABEL[b.status] ?? b.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${border}` }}>
              <button onClick={() => setSelected(null)} style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Loka</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
