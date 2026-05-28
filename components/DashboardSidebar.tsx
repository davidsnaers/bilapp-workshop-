"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { Workshop } from "@/types/database";
import Link from "next/link";
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
    router.push("/login");
    router.refresh();
  };

  const sidebarStyle = {
    width: 220,
    flexShrink: 0,
    background: isDark ? "#2a2a2a" : "white",
    borderRight: `1px solid ${isDark ? "#3a3a3a" : "#e5e7eb"}`,
    display: "flex",
    flexDirection: "column" as const,
    minHeight: "100vh",
  };

  const textColor = isDark ? "#e4e4e4" : "#111827";
  const mutedColor = isDark ? "#666" : "#9ca3af";
  const borderColor = isDark ? "#3a3a3a" : "#f3f4f6";
  const hoverBg = isDark ? "#333" : "#f9fafb";
  const activeBg = isDark ? "#3a2e00" : "#fffbeb";
  const activeBorder = isDark ? "#E8A800" : "#fbbf24";
  const activeText = isDark ? "#E8A800" : "#92400e";

  return (
    <div style={sidebarStyle}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: isDark ? "#E8A800" : "#F5B301",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#1a1a1a",
          }}>B</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: textColor, margin: 0 }}>Bílapp</p>
            <p style={{ fontSize: 11, color: mutedColor, margin: 0 }}>Verkstæðissvæði</p>
          </div>
        </div>
      </div>

      {/* Workshop info */}
      {workshop && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${borderColor}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: mutedColor, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 3px" }}>Verkstæði</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: textColor, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workshop.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: workshop.status === "active" ? "#22c55e" : "#f59e0b" }} />
            <span style={{ fontSize: 11, color: mutedColor, fontWeight: 500 }}>
              {workshop.status === "active" ? "Virkt" : workshop.status === "paused" ? "Í bið" : "Uppsetning"}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
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
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + sign out */}
      <div style={{ padding: "10px 8px", borderTop: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 10px", borderRadius: 10,
          border: `1px solid ${isDark ? "#3a3a3a" : "#e5e7eb"}`,
          background: isDark ? "#333" : "#f9fafb",
          color: isDark ? "#ccc" : "#374151",
          cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{isDark ? "🌙" : "☀️"}</span>
            {isDark ? "Dökkt þema" : "Ljóst þema"}
          </span>
          {/* Toggle pill */}
          <div style={{
            width: 32, height: 18, borderRadius: 999,
            background: isDark ? "#E8A800" : "#d1d5db",
            position: "relative", transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: 2,
              left: isDark ? 14 : 2,
              width: 14, height: 14, borderRadius: "50%",
              background: "white", transition: "left 0.2s",
            }} />
          </div>
        </button>

        {/* Sign out */}
        <button onClick={handleSignOut} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 10px", borderRadius: 10,
          border: "1px solid transparent", background: "transparent",
          color: mutedColor, cursor: "pointer", fontSize: 13, fontWeight: 500,
          width: "100%",
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = hoverBg}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
        >
          <span style={{ fontSize: 15 }}>🚪</span>
          Útskráning
        </button>
      </div>
    </div>
  );
}
