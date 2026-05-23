"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/ui/ProjectCard";

type FilterChip = "all" | "verified" | "safe" | "moderate" | "risky";
type SortOption = "trustScore" | "totalInvestedSol" | "holderCount" | "createdAt";

const FILTER_CHIPS: { key: FilterChip; label: string; color: string }[] = [
  { key: "all", label: "All", color: "var(--text-secondary)" },
  { key: "verified", label: "Verified", color: "#00FFB2" },
  { key: "safe", label: "Safe", color: "#00D4FF" },
  { key: "moderate", label: "Moderate", color: "#FFB800" },
  { key: "risky", label: "Risky", color: "#FF7A00" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "trustScore", label: "Trust Score" },
  { value: "totalInvestedSol", label: "Total Invested" },
  { value: "holderCount", label: "Holders" },
  { value: "createdAt", label: "Newest" },
];

const SCORE_RANGES: Record<FilterChip, { min?: number; max?: number }> = {
  all: {},
  verified: { min: 90 },
  safe: { min: 70, max: 89 },
  moderate: { min: 40, max: 69 },
  risky: { max: 39 },
};

function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--bg-elevated)",
          }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 14, width: "60%", borderRadius: 6, background: "var(--bg-elevated)" }} />
          <div style={{ height: 11, width: "35%", borderRadius: 6, background: "var(--bg-elevated)" }} />
        </div>
        <div style={{ width: 60, height: 24, borderRadius: 20, background: "var(--bg-elevated)" }} />
      </div>
      <div style={{ height: 40, borderRadius: 6, background: "var(--bg-elevated)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
        <div style={{ height: 30, width: 80, borderRadius: 6, background: "var(--bg-elevated)" }} />
        <div style={{ height: 30, width: 60, borderRadius: 6, background: "var(--bg-elevated)" }} />
        <div style={{ height: 30, width: 64, borderRadius: 8, background: "var(--bg-elevated)" }} />
      </div>
    </div>
  );
}

export default function ExploreTab() {
  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("trustScore");
  const [filter, setFilter] = useState<FilterChip>("all");

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  const scoreRange = SCORE_RANGES[filter];
  const { data: projects, isLoading, error } = useProjects({
    search: debouncedSearch || undefined,
    sort,
    minScore: scoreRange.min,
    maxScore: scoreRange.max,
  });

  const clearSearch = useCallback(() => {
    setRawSearch("");
    setDebouncedSearch("");
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-geist)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Explore Projects
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Discover tokens with verifiable on-chain trust signals
        </p>
      </div>

      {/* Controls row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flexShrink: 0, width: 280 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Search projects..."
            style={{
              width: "100%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              padding: "9px 36px 9px 36px",
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-inter)",
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
          />
          {rawSearch && (
            <button
              onClick={clearSearch}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                padding: 2,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <SlidersHorizontal size={14} color="var(--text-muted)" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              padding: "9px 32px 9px 12px",
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-inter)",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A5568' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_CHIPS.map(({ key, label, color }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: isActive ? `1px solid ${color}60` : "1px solid var(--border-subtle)",
                  background: isActive ? `${color}15` : "transparent",
                  color: isActive ? color : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "var(--font-inter)",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.borderColor = color;
                    (e.currentTarget as HTMLElement).style.color = color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  }
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      {!isLoading && !error && projects && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginBottom: "1.25rem",
            fontFamily: "var(--font-mono)",
          }}
        >
          {projects.length} project{projects.length !== 1 ? "s" : ""} found
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--danger)",
            fontSize: 14,
            background: "rgba(255,68,68,0.06)",
            border: "1px solid rgba(255,68,68,0.2)",
            borderRadius: 12,
          }}
        >
          Failed to load projects. Please try again.
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : projects?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
      </div>

      {/* Empty state */}
      {!isLoading && !error && projects?.length === 0 && (
        <div
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div style={{ fontSize: 48 }}>🔍</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            No projects found
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        input::placeholder { color: var(--text-muted); }
        select option { background: var(--bg-elevated); color: var(--text-primary); }
      `}</style>
    </div>
  );
}
