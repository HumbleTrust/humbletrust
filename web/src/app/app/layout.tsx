"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Compass, Rocket, Briefcase, BarChart2, Wallet } from "lucide-react";
import { Suspense } from "react";

const NAV_ITEMS = [
  { tab: "explore", label: "Explore", icon: Compass },
  { tab: "launch", label: "Launch", icon: Rocket },
  { tab: "portfolio", label: "Portfolio", icon: Briefcase },
  { tab: "analytics", label: "Analytics", icon: BarChart2 },
];

function SidebarNav() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "explore";

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 12px" }}>
      {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
        const isActive = activeTab === tab;
        return (
          <Link
            key={tab}
            href={`/app?tab=${tab}`}
            style={{ textDecoration: "none", position: "relative" }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--primary)" : "var(--text-secondary)",
                transition: "color 0.15s ease",
                zIndex: 1,
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    background: "var(--primary-dim)",
                    border: "1px solid rgba(0,255,178,0.15)",
                    zIndex: -1,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--primary), var(--secondary))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Shield size={17} color="#05080F" />
        </div>
        <span
          style={{
            fontFamily: "var(--font-geist)",
            fontWeight: 700,
            fontSize: 17,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          HumbleTrust
        </span>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, paddingTop: 16, paddingBottom: 16 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "0 26px",
            marginBottom: 8,
          }}
        >
          Navigation
        </div>
        <Suspense fallback={null}>
          <SidebarNav />
        </Suspense>
      </div>

      {/* Footer section */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Network badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(0,255,178,0.06)",
            border: "1px solid rgba(0,255,178,0.15)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--primary)",
              boxShadow: "0 0 8px var(--primary)",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--primary)",
              letterSpacing: "0.08em",
            }}
          >
            DEVNET
          </span>
        </div>

        {/* Wallet placeholder */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            transition: "border-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
          }}
        >
          <Wallet size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            Connect Wallet
          </span>
        </div>
      </div>
    </aside>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-base)",
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: 240,
          minHeight: "100vh",
          overflowY: "auto",
          background: "var(--bg-base)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
