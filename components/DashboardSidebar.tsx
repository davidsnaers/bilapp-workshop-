// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { Workshop } from "@/types/database";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/calendar",  label: "Dagatal",        icon: "📅" },
  { href: "/bookings",  label: "Bókanir",         icon: "📋" },
  { href: "/customers", label: "Viðskiptavinir",  icon: "👤" },
  { href: "/settings",  label: "Stillingar",      icon: "⚙️" },
];

export default function DashboardSidebar({ workshop }: { workshop: Workshop | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const bg      = isDark ? "#1e1e1e" : "#ffffff";
  const border  = isDark ? "#2e2e2e" : "#e5e7eb";
  const text    = isDark ? "#f4f4f4" : "#111827";
  const muted   = isDark ? "#666"    : "#9ca3af";
  const subsurf = isDark ? "#2a2a2a" : "#f9fafb";
  const hoverBg = isDark ? "#2a2a2a" : "#f9fafb";
  const amber   = isDark ? "#E8A800" : "#F5B301";
  const activeBg = isDark ? "rgba(232,168,0,0.12)" : "#fffbeb";
  const activeBorder = isDark ? "#E8A800" : "#fbbf24";
  const activeText = isDark ? "#E8A800" : "#92400e";

  return (
    <div style={{ width: 220, flexShrink: 0, background: bg, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Logo */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/logo.png" alt="Bílapp" width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: text, margin: 0 }}>Bílapp</p>
            <p style={{ fontSize: 11, color: muted, margin: 0 }}>Verkstæðissvæði</p>
          </div>
        </div>
      </div>

      {/* Workshop */}
      {workshop && (
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>Verkstæði</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: text, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workshop.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: workshop.status === "active" ? "#22c55e" : "#f59e0b" }} />
            <span style={{ fontSize: 11, color: muted }}>{workshop.status === "active" ? "Virkt" : "Í bið"}</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 10, textDecoration: "none",
              fontSize: 13, fontWeight: active ? 700 : 500,
              background: active ? activeBg : "transparent",
              border: `1px solid ${active ? activeBorder : "transparent"}`,
              color: active ? activeText : isDark ? "#ccc" : "#374151",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme + signout */}
      <div style={{ padding: "8px", borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <button onClick={toggleTheme} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 10px", borderRadius: 10, border: `1px solid ${border}`,
          background: subsurf, color: isDark ? "#ccc" : "#374151",
          cursor: "pointer", fontSize: 12, fontWeight: 600, width: "100%",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{isDark ? "🌙" : "☀️"}</span>
            {isDark ? "Dökkt þema" : "Ljóst þema"}
          </span>
          <div style={{ width: 32, height: 18, borderRadius: 999, background: isDark ? amber : "#d1d5db", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: isDark ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
          </div>
        </button>

        <button onClick={handleSignOut} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10,
          border: "1px solid transparent", background: "transparent", color: muted,
          cursor: "pointer", fontSize: 13, fontWeight: 500, width: "100%",
        }}>
          <span style={{ fontSize: 15 }}>🚪</span> Útskráning
        </button>
      </div>
    </div>
  );
}
