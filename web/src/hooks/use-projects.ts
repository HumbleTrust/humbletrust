"use client";

import { useQuery } from "@tanstack/react-query";
import type { PlatformStats, Project } from "@/types";

export type ProjectQuery = {
  minScore?: number;
  maxScore?: number;
  sort?: "newest" | "highest-score" | "most-funded" | "ending-soon";
  status?: string;
};

function toSearchParams(query?: ProjectQuery) {
  const params = new URLSearchParams();
  if (!query) return params;

  if (query.minScore !== undefined) params.set("minScore", String(query.minScore));
  if (query.maxScore !== undefined) params.set("maxScore", String(query.maxScore));
  if (query.sort) params.set("sort", query.sort);
  if (query.status) params.set("status", query.status);

  return params;
}

export function useProjects(query?: ProjectQuery) {
  return useQuery({
    queryKey: ["projects", query],
    queryFn: async () => {
      const params = toSearchParams(query);
      const response = await fetch(`/api/projects?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Projects request failed");
      }

      return (await response.json()) as { projects: Project[] };
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`);

      if (!response.ok) {
        throw new Error("Project request failed");
      }

      return (await response.json()) as { project: Project };
    },
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const response = await fetch("/api/stats");

      if (!response.ok) {
        throw new Error("Stats request failed");
      }

      return (await response.json()) as { stats: PlatformStats };
    },
  });
}
