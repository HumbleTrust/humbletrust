---
name: marketing
description: Marketing skills for conversion, copywriting, SEO, growth, and campaign strategy. Built on Corey Haines' marketing skills framework. Use when working on any marketing task — landing pages, emails, ads, SEO, CRO, positioning, competitor research, or growth.
metadata:
  trigger: Marketing copy, landing pages, emails, SEO, CRO, ads, competitor analysis, growth
  author: Corey Haines (https://corey.co) — adapted for HumbleTrust
  source: https://github.com/coreyhaines31/marketingskills
---

# Marketing Skills

A collection of marketing agent skills covering the full growth stack.

## Available Sub-Skills

### Foundation (start here)
- **product-marketing** — Captures product context, ICP, positioning, messaging. Run this first on any new project. Creates `.agents/product-marketing.md` referenced by all other skills.

### Conversion & CRO
- **cro** — Conversion rate optimization for pages and flows
- **signup** — Optimize signup and activation funnels
- **onboarding** — User onboarding flow improvements
- **ab-testing** — Plan, design, and analyze A/B experiments
- **popups** — Popup and overlay strategy
- **paywalls** — Paywall and upgrade flow optimization

### Content & Copy
- **copywriting** — Persuasive copy for any surface (landing pages, ads, emails)
- **copy-edit** — Edit existing copy to be more compelling
- **cold-email** — Cold outreach sequences
- **emails** — Email marketing campaigns and sequences
- **social** — Social media content and strategy
- **video** — Video script and content strategy
- **image** — Visual content strategy

### SEO
- **seo-audit** — Technical + content SEO audit
- **ai-seo** — AI-optimized search (GEO, AIO)
- **site-arch** — Site architecture for SEO
- **programmatic-seo** — Programmatic SEO strategy
- **schema** — Schema markup implementation
- **content** — Content strategy and calendar
- **aso** — App Store Optimization

### Paid & Measurement
- **ads** — Ad campaigns (Google, Meta, LinkedIn)
- **ad-creative** — Ad creative generation and iteration
- **analytics** — Analytics setup and interpretation

### Growth & Retention
- **referrals** — Referral program design
- **free-tools** — Free tools as growth levers
- **churn-prevention** — Churn reduction strategy
- **community** — Community-led growth
- **lead-magnets** — Lead magnet creation
- **co-marketing** — Partnership and co-marketing

### Sales & GTM
- **revops** — Revenue operations
- **sales-enablement** — Sales collateral and playbooks
- **launch** — Product and feature launch strategy
- **pricing** — Pricing strategy and pages
- **competitors** — Competitor analysis
- **competitor-profile** — Deep competitor profile
- **directory** — Directory and listing strategy
- **prospecting** — Outbound prospecting

### Strategy
- **marketing-ideas** — Brainstorm growth tactics and campaigns
- **marketing-psychology** — Apply psychological principles to copy
- **customer-research** — Customer interviews and research synthesis

## Workflow

### Starting a new project
1. Run product-marketing context setup first
2. Then apply specific skill based on the task

### When user requests marketing work
1. Check if `.agents/product-marketing.md` exists — if not, offer to create it
2. Identify the right sub-skill from the list above
3. Apply that skill's framework to the task

## Core Principles (from Corey Haines)

**Verbatim customer language beats polished descriptions.** Use exact phrases customers use — they reflect how prospects think and speak, making copy more resonant.

**Specificity beats vagueness.** "Helps 4-person teams close deals 40% faster" beats "improves sales performance."

**One clear job per piece.** Every marketing asset has one job: get the click, get the signup, get the reply. Don't dilute with multiple CTAs.

**Position against the alternative, not the abstract.** Customers compare you to what they're using now (spreadsheets, competitors, doing nothing), not to some ideal.

**Benefits over features.** Features describe what it does. Benefits describe what the customer gets. Outcomes beat capabilities.

## How to Invoke

When user says `/marketing [task]` or asks for help with marketing work:

1. Identify which sub-skill applies
2. Check for existing product context in `.agents/product-marketing.md`
3. Apply the appropriate framework
4. Ask for missing context if needed (ICP, product, current metrics)
