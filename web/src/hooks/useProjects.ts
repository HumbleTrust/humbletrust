"use client";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@/types";

interface ProjectFilters {
  minScore?: number;
  maxScore?: number;
  sort?: string;
  search?: string;
}

async function fetchProjects(filters: ProjectFilters): Promise<Project[]> {
  const params = new URLSearchParams();
  if (filters.minScore !== undefined) params.set("minScore", String(filters.minScore));
  if (filters.maxScore !== undefined) params.set("maxScore", String(filters.maxScore));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.search) params.set("search", filters.search);
  const res = await fetch(`/api/projects?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function fetchStats() {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: () => fetchProjects(filters),
    staleTime: 30_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
    enabled: Boolean(id),
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
}
