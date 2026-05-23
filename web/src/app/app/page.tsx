"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function TabSkeleton() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 80,
            borderRadius: 12,
            background: "var(--bg-surface)",
            animation: "pulse 1.5s ease-in-out infinite",
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

const ExploreTab = dynamic(() => import("./_components/ExploreTab"), { loading: () => <TabSkeleton />, ssr: false });
const LaunchTab = dynamic(() => import("./_components/LaunchTab"), { loading: () => <TabSkeleton />, ssr: false });
const PortfolioTab = dynamic(() => import("./_components/PortfolioTab"), { loading: () => <TabSkeleton />, ssr: false });
const AnalyticsTab = dynamic(() => import("./_components/AnalyticsTab"), { loading: () => <TabSkeleton />, ssr: false });

function TabContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "explore";

  return (
    <>
      {tab === "explore" && <ExploreTab />}
      {tab === "launch" && <LaunchTab />}
      {tab === "portfolio" && <PortfolioTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {!["explore", "launch", "portfolio", "analytics"].includes(tab) && <ExploreTab />}
    </>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <TabContent />
    </Suspense>
  );
}
