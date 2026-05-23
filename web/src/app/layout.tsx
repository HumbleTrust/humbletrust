import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import "@/legacy/index.css";
import { Providers } from "@/components/layout/Providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HumbleTrust — Trust Infrastructure for Web3",
  description:
    "Accountability enforced by code, not promises. Launch tokens with verifiable on-chain trust signals.",
  openGraph: {
    title: "HumbleTrust",
    description: "Trust Infrastructure for Web3. Built on Solana.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${inter.variable}`}>
      <body style={{ background: "var(--bg-base)", color: "var(--text-primary)", fontFamily: "var(--font-inter)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
