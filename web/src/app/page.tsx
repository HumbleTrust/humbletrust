import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { ProblemSolutionSection } from "@/components/sections/ProblemSolutionSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { TrustScoreDemoSection } from "@/components/sections/TrustScoreDemoSection";
import { LiveProjectsSection } from "@/components/sections/LiveProjectsSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { StatsSection } from "@/components/sections/StatsSection";
import { CTASection } from "@/components/sections/CTASection";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSolutionSection />
        <HowItWorksSection />
        <TrustScoreDemoSection />
        <LiveProjectsSection />
        <FeaturesSection />
        <StatsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
