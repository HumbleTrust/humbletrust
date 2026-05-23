"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/app", label: "Projects" },
  { href: "/app?tab=launch", label: "Launch" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "all 0.2s ease",
        background: scrolled ? "rgba(5,8,15,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border-subtle)" : "1px solid transparent",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, var(--primary), var(--secondary))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield size={18} color="#05080F" />
          </div>
          <span style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>
            HumbleTrust
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="hidden md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                color: pathname === link.href.split("?")[0] ? "var(--primary)" : "var(--text-secondary)",
                transition: "color 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => {
                const active = pathname === link.href.split("?")[0];
                (e.target as HTMLElement).style.color = active ? "var(--primary)" : "var(--text-secondary)";
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            padding: "4px 10px",
            borderRadius: 6,
            background: "var(--primary-dim)",
            border: "1px solid rgba(0,255,178,0.2)",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--primary)",
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", display: "inline-block", boxShadow: "0 0 6px var(--primary)" }} />
            DEVNET
          </div>
          <Link
            href="/app?tab=launch"
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              background: "var(--primary)",
              color: "var(--bg-base)",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(0,255,178,0.4)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            Launch
          </Link>
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: "var(--bg-surface)",
              borderBottom: "1px solid var(--border-subtle)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  style={{ textDecoration: "none", fontSize: 16, color: "var(--text-primary)", fontWeight: 500 }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
