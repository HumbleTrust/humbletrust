import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HumbleTrust - Trust Infrastructure for Web3",
  description:
    "Launch tokens with liquidity locks, creator vesting, and on-chain TrustScore verification enforced by Solana smart contracts.",
  openGraph: {
    title: "HumbleTrust",
    description: "Where trust becomes executable.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${inter.variable} ${jetbrains.variable} antialiased`}>
        <AppProviders>
          <div className="noise-overlay" />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
