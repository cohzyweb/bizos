---
name: Retail Operating System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#734700'
  on-tertiary: '#ffffff'
  tertiary-container: '#945d00'
  on-tertiary-container: '#ffe6cc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  metric-numeral:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for the fast-paced, high-volume environment of Nigerian retail shopkeepers, kiosk owners, and inventory managers. The visual tone balances enterprise-grade institutional trustworthiness with local operating practicalities: lightning-fast legibility under harsh sunlight, immediate status identification across dynamic connection states, and zero-latency visual feedback for cash and transfer transactions.

The design movement combines **Modern Utility** with **Airy Structural Precision**:
- **Atmosphere:** Clean, open, and luminous. Interfaces rely on breathing space rather than dense visual dividers, reducing cognitive strain during frantic morning and evening trade rushes.
- **Trust Architecture:** Grounded deep teals project financial discipline, stability, and dependability, instantly distancing the product from casual consumer apps while avoiding sterile corporate stiffness.
- **Contextual Awareness:** Explicit micro-states celebrate sync confirmations, immediately surface debt collection ledgers ("Who Owes Me"), and normalize offline-first operation without inducing panic.
- **Visual Rhythm:** Balanced Bento-grid modules organize sales counters, stock levels, and daily profit metrics into glanceable units with high contrast and structured borders.

## Colors

The palette employs purposeful functional assignment designed for immediate transactional triage.

### Palette Architecture
- **Primary (Vibrant Deep Teal - `#0F766E`):** Represents core authority, primary actions, and key navigation highlights.
  - Interactive Hover: `#0D9488`
  - Active / Deep Solid: `#115E59`
  - Subtle Canvas Fill / Active Tabs: `#F0FDFA`
- **Secondary (Operational Emerald - `#10B981`):** Strictly reserved for positive cash inflow, completed bank transfers, automated inventory reconciliations, and the vital "Synced with Cloud" state.
  - Emerald Soft Badge Fill: `#ECFDF5`
  - Emerald Text / Stroke: `#047857`
- **Tertiary (Alert Amber / Ochre - `#F59E0B`):** Dedicated to connectivity changes ("Working Offline"), reorder thresholds, and pending settlement confirmations.
  - Amber Soft Badge Fill: `#FFFBEB`
  - Amber Text / Stroke: `#B45309`
- **Functional Semantic (Coral Red - `#EF4444`):** Elevated priority indicator specifically tuned for outstanding customer debt ("Customer Owes"), overdue credit, inventory losses, and voided receipts.
  - Coral Soft Badge Fill: `#FEF2F2`
  - Coral Text / Stroke: `#B91C1C`
- **Neutrals & Surfaces (Slate Architecture):**
  - App Canvas Ground: `#F8FAFC`
  - Surface Card Ground: `#FFFFFF`
  - Hairline Border / Separator: `#E2E8F0`
  - Muted Label / Hint Text: `#64748B`
  - Body Text / Secondary Data: `#334155`
  - Primary Headers / High-Emphasis Figures: `#0F172A`

### Usage Rules
Never use pure saturated black (`#000000`). All text rendering must use slate tones to preserve lightness. Gradients are strictly limited to primary summary highlight cards (`linear-gradient(135deg, #0F766E 0%, #115E59 100%)`).

## Typography

Typography prioritizes computational clarity and swift scanning under high operational tempo.

- **Primary Pairing:** **Plus Jakarta Sans** is assigned to headlines, card titles, and high-impact metrics for its crisp, modern geometric friendliness. **Inter** handles all dense tables, transaction logs, inputs, and form controls due to its rock-solid horizontal metrics and unambiguous letterforms.
- **Naira Currency Handling (`₦`):** All financial figures must employ tabular figures (`font-variant-numeric: tabular-nums`) to maintain strict vertical column alignment across ledgers. When displaying the Naira sign (`₦`), maintain font weight identity with the succeeding numeric characters to avoid optical thinning.
- **Hierarchy Rules:** Large totals must lead with weight rather than solely relying on scale. Section labels above Bento cards use uppercase `label-sm` with slate styling (`#64748B`) to anchor subsequent values.

## Layout & Spacing

The layout is built upon an 8pt modular grid enclosed within an absolute maximum content width of **1200px** on desktop viewports.

### Breakpoint Matrix
- **Mobile (< 768px):** Single-column stack. Sticky top status bar (showing sync & cash total). Horizontal swipe tracks for quick metrics. Edge canvas margin: `1rem`. Gaps: `0.75rem`.
- **Tablet (768px - 1023px):** 6-column fluid structure. Bento cards dynamically adopt 2-column or 3-column splits. Margin: `1.5rem`. Gutters: `1.25rem`.
- **Desktop (1024px - 1200px max):** 12-column structured Bento framework centered within the viewport. Global side margins: `2rem`. Gutters: `1.5rem`.

### Structure & Density
Spacious interior padding (`1.25rem` to `1.5rem`) inside Bento cards maintains the airy profile, preventing operational dashboards from feeling cluttered. Data tables apply compact vertical cell padding (`0.75rem`) to sustain fast scanning while retaining generous horizontal space (`1rem`).

## Elevation & Depth

Depth is established primarily through crisp boundary definition rather than heavy drop shadows, preventing visual muddiness on low-end screens.

- **Layer 0 (Canvas Base):** Base backdrop rendered in `#F8FAFC`.
- **Layer 1 (Modular Surfaces):** Pure white cards (`#FFFFFF`) framed with a mandatory crisp hairline border: `1px solid #E2E8F0`. Flat elevation with no default shadow.
- **Layer 2 (Lifted State / Popovers / Modals):** Applied to transaction quick-add panels, search dropdowns, and date filters. Uses a lightweight ambient shadow tinted with slate: `box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)` combined with the standard `1px solid #E2E8F0` border.
- **Layer 3 (Critical Toast & Connectivity Banners):** Floating status pills (e.g., "Offline Mode — Changes Saved Locally") utilize a solid high-contrast surface with `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12)`.

## Shapes

The design system employs a structured, friendly geometry (`roundedness: 2` base).

- **Buttons, Inputs, and Form Controls:** Formatted with `0.5rem` (`8px`) border radius. This delivers an approachable, precise target area for touchscreen taps without losing business rigor.
- **Bento Modules & Standard Cards (`rounded-lg`):** Styled with `1rem` (`16px`) corners, establishing smooth modular segmentation across sales charts, tables, and metric summaries.
- **Full Modals & Action Drawers (`rounded-xl`):** Configured with `1.5rem` (`24px`) radius on top desktop corners and mobile sheet entries.
- **Tags, Pills, and Offline Indicators:** Always rendered as fully rounded pills (`border-radius: 9999px`) to visually differentiate status tokens from actionable rectangular buttons.

## Components

### Buttons
- **Primary:** Solid `#0F766E` background with `#FFFFFF` text. Hover state shifts to `#0D9488`. Active press: `#115E59`. Height: 44px min for thumb-friendly operation. Roundedness: 8px.
- **Secondary / Ghost:** `#FFFFFF` background, `1px solid #E2E8F0`, text `#334155`. Hover transitions to `#F0FDFA` with border tinting to `#0F766E`.
- **Destructive / Debt Action:** `#FEF2F2` background with `#B91C1C` text for passive triggers; solid `#EF4444` for irreversible actions.

### Badges & Status Pills
- **Badge Shape:** Compact pill (`rounded-full`), padding `0.25rem 0.625rem`.
- **Synced / Successful:** `#ECFDF5` background, `#047857` text, leading `6px` solid emerald circle.
- **Offline / Warning:** `#FFFBEB` background, `#B45309` text, leading amber pulse dot.
- **Customer Owes / Overdue:** `#FEF2F2` background, `#B91C1C` text, bold font styling.

### Input Fields & Search
- Surface: `#FFFFFF` with `1px solid #E2E8F0`. Text: `#0F172A`. Placeholder: `#94A3B8`.
- Focus State: Zero fuzzy glow; crisp `2px solid #0F766E` outline with an inner zero-pixel ring.
- Currency Input Preset: Attached static prefix box displaying `₦` in high-contrast bold slate.

### Data Tables & Transaction Rows
- Border-free interior verticals; horizontal dividers strictly `1px solid #E2E8F0`.
- Alternating rows avoid heavy zebra striping; they rely on transparent base rows with an immediate hover transition to `#F8FAFC`.
- All monetary amounts right-aligned with tabular numbers; statuses center-aligned.

### Cards (Bento System)
- White container with `16px` radius, `1px solid #E2E8F0` border, `1.25rem` inner padding.
- Metric cards incorporate an optional micro-sparkline or delta tag positioned top-right, maintaining clear separation from the primary numeral.

### Device Mockups & App Shell Presentation
- Screen representations must sit inside minimalist slate chassis with clean outer hairline borders and subtle internal screen bezels. Drop shadows under floating mockups must use soft multi-stop slate blurs to emphasize product depth without visual noise.