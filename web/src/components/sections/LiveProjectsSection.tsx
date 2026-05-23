"use client";
import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/ui/ProjectCard";
import { Search } from "lucide-react";

const FILTERS = [
  { label: "All", minScore: 0 },
  { label: "Verified (90+)", minScore: 90 },
  { label: "Safe (70–89)", minScore: 70, maxScore: 89 },
  { label: "Moderate", minScore: 40, maxScore: 69 },
  { label: "Risky", minScore: 0, maxScore: 39 },
];

export function LiveProjectsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [filterIdx, setFilterIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("trustScore");

  const filter = FILTERS[filterIdx];
  const { data: projects = [], isLoading } = useProjects({
    minScore: filter.minScore,
    maxScore: (filter as { maxScore?: number }).maxScore ?? 100,
    sort,
    search,
  });

  return (
    <section ref={ref} style={{ padding: "100px 24px", borderTop: "1px solid var(--border-subtle)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          style={{ marginBottom: "2.5rem" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            Live Projects
          </div>
          <h2 style={{ fontFamily: "var(--font-geist)", fontWeight: 700, fontSize: "clamp(1.8rem,3.5vw,2.6rem)", color: "var(--text-primary)", marginBottom: "2rem" }}>
            Verified on-chain launches
          </h2>

          {/* Controls */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  transition: "border-color 0.15s",
                  fontFamily: "var(--font-inter)",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--border-focus)"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--border-subtle)"; }}
              />
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                padding: "9px 12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                color: "var(--text-secondary)",
                fontSize: 13,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="trustScore">Highest Score</option>
              <option value="invested">Most Funded</option>
              <option value="newest">Newest</option>
              <option value="ending">Ending Soon</option>
            </select>

            {/* Filters */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {FILTERS.map((f, i) => (
                <button
                  key={f.label}
                  onClick={() => setFilterIdx(i)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: `1px solid ${filterIdx === i ? "var(--primary)" : "var(--border-subtle)"}`,
                    background: filterIdx === i ? "var(--primary-dim)" : "transparent",
                    color: filterIdx === i ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontWeight: filterIdx === i ? 600 : 400,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 280, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: "1rem" }}>🔍</div>
            <div style={{ fontFamily: "var(--font-geist)", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>No projects found</div>
            <div style={{ fontSize: 14 }}>Try adjusting your filters</div>
          </div>
        ) : (
          <AnimatePresence mode="sync">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
              {projects.slice(0, 6).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
