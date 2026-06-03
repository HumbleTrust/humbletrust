---
name: uiux-promax
description: Professional UI/UX design intelligence for building polished interfaces. Provides design systems, color palettes, typography, component patterns, and UX guidelines across all major frameworks. Use when building any UI, designing pages/components, choosing visual style, or reviewing UX.
metadata:
  trigger: UI/UX design, landing pages, dashboards, components, color, typography, dark mode, animations, accessibility
  author: nextlevelbuilder (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — adapted for HumbleTrust
---

# UI/UX Pro Max

Design intelligence for building professional interfaces. Covers product types, visual styles, color systems, typography, component patterns, and UX best practices.

## When to Use

| Scenario | What to do |
|----------|-----------|
| New page or screen | Generate design system first, then build |
| New component | Search by domain: style + ux |
| Choose style / color / font | Design system generation |
| Review existing UI for issues | UX audit checklist |
| Fix a UI bug | Targeted domain search |
| Improve / optimize UX | Domain search: ux, performance |
| Add dark mode | Domain search: style "dark mode" |
| Add charts / data viz | Domain search: chart |
| Stack-specific best practices | Stack search |

## Design System Domains

**product** — Product type patterns (SaaS, DeFi/crypto, marketplace, portfolio, mobile app)

**style** — Visual styles:
- Glassmorphism: frosted glass, blur layers, translucent cards
- Dark neon: dark bg + neon accent colors (good for crypto/web3)
- Minimalism: whitespace-heavy, typography-led
- Brutalism: raw, high-contrast, grid-breaking
- Neumorphism: soft shadows, embossed feel
- Cyberpunk: matrix-green, grid lines, terminal aesthetic

**color** — Color palettes by product type and mood

**typography** — Font pairings (Google Fonts), heading/body scales

**landing** — Page structure, hero patterns, CTA strategy

**chart** — Chart types, data visualization libraries, when to use each

**ux** — UX best practices, anti-patterns, accessibility (WCAG)

## Stack Support

Frameworks with specific guidelines:
`react` | `nextjs` | `astro` | `vue` | `nuxtjs` | `svelte` | `html-tailwind` (default) | `react-native` | `flutter` | `swiftui` | `shadcn` | `jetpack-compose`

## Design System Generation Workflow

### Step 1: Identify requirements
- Product type: DeFi/crypto, SaaS, marketplace, portfolio, mobile
- Target audience: Traders, developers, general consumers
- Style keywords: dark, neon, minimal, glassmorphism, cyberpunk
- Stack in use

### Step 2: Generate complete design system
Based on product type and keywords, specify:

**Color palette:**
- Primary: main brand/action color (hex)
- Secondary: supporting accent
- Background: base surface color
- Surface: card/panel color
- Text: primary + secondary text
- Success/Warning/Error: semantic colors
- Border: subtle dividers

**Typography:**
- Heading font + sizes (h1–h6)
- Body font + sizes (base, sm, xs)
- Monospace font for code/data

**Spacing scale:** 4px base, multiples of 4 (4, 8, 12, 16, 24, 32, 48, 64)

**Border radius:** sharp (0-2px) / medium (4-8px) / rounded (12-16px) / pill (9999px)

**Shadows:** token-based shadow system

**Animation:** duration tokens + easing curves

### Step 3: Component patterns
For each UI component, specify:
- Visual treatment (solid, outlined, ghost, filled)
- States: default, hover, active, disabled, loading
- Accessibility: ARIA roles, keyboard nav, focus ring

## HumbleTrust Design Language

This project uses a **dark neon / cyberpunk** aesthetic:
- Background: `#050A0E` to `#0A0F14` (near-black)
- Primary accent: `#00FF41` (matrix green) for trust/success
- Warning: `#FFDB2B` (amber)
- Danger: `#FF4444` (red)
- Border: `#1A2332` (dark blue-gray)
- Card surface: `#0F1923` (dark slate)
- Text primary: `#E2E8F0`
- Font: JetBrains Mono / Orbitron for headers, Inter for body
- Style: glassmorphism cards + neon glows + hex motifs

## UX Audit Checklist

### Performance
- [ ] LCP < 2.5s (largest contentful paint)
- [ ] No layout shifts (CLS < 0.1)
- [ ] Images lazy-loaded
- [ ] Skeleton states for async data

### Accessibility (WCAG 2.1 AA)
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] All interactive elements keyboard-navigable
- [ ] Focus indicators visible
- [ ] Alt text on images
- [ ] ARIA labels on icon buttons

### Mobile / Responsive
- [ ] Touch targets ≥ 44×44px
- [ ] No horizontal scroll
- [ ] Readable font sizes (≥ 16px body)
- [ ] Forms work on mobile keyboard

### UX Patterns
- [ ] Empty states designed (not just blank)
- [ ] Error states with actionable messages
- [ ] Loading states prevent user confusion
- [ ] Destructive actions require confirmation
- [ ] Success feedback for key actions

## How to Invoke

When user says `/uiux-promax [request]` or asks for UI/UX help:

1. Identify the scenario from the table above
2. Determine stack being used (default: react + tailwind)
3. Generate design system recommendations for the product type
4. Provide specific component patterns and code
5. Run UX audit checklist if reviewing existing UI
6. Always include accessibility considerations
