import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#05080F",
          surface: "#0A0F1A",
          elevated: "#0F1624",
        },
        border: {
          subtle: "#1A2436",
          focus: "#2A3A56",
        },
        primary: {
          DEFAULT: "#00FFB2",
          dim: "rgba(0,255,178,0.12)",
        },
        secondary: {
          DEFAULT: "#3D7FFF",
          dim: "rgba(61,127,255,0.12)",
        },
        accent: {
          DEFAULT: "#7B4FFF",
          dim: "rgba(123,79,255,0.12)",
        },
        danger: "#FF4444",
        warning: "#FFB800",
        success: "#00FF87",
        text: {
          primary: "#F0F4FF",
          secondary: "#8896B3",
          muted: "#4A5568",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        display: ["80px", { lineHeight: "1.0", letterSpacing: "-3px", fontWeight: "800" }],
        h1: ["64px", { lineHeight: "1.05", letterSpacing: "-2px", fontWeight: "700" }],
        h2: ["48px", { lineHeight: "1.1", letterSpacing: "-1.5px", fontWeight: "700" }],
        h3: ["32px", { lineHeight: "1.2", letterSpacing: "-1px", fontWeight: "600" }],
        h4: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.8" }],
        body: ["16px", { lineHeight: "1.7" }],
        small: ["14px", { lineHeight: "1.5" }],
        mono: ["13px", { lineHeight: "1.5" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
        "4xl": "96px",
        "5xl": "128px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "9999px",
      },
      boxShadow: {
        "card-glow": "0 0 60px rgba(0,255,178,0.04)",
        "primary-glow": "0 0 30px rgba(0,255,178,0.25)",
        "blue-glow": "0 0 30px rgba(61,127,255,0.25)",
        "purple-glow": "0 0 30px rgba(123,79,255,0.25)",
        "danger-glow": "0 0 30px rgba(255,68,68,0.25)",
        "inner-border": "inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
export default config;
