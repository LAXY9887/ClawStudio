# Ad Networks Integration Guide

ClawStudio currently uses **Google AdSense** as its sole ad network. AdSense is disabled (`adsenseEnabled: false`) pending approval; all slot code is in place so enabling is a single config toggle.

---

## Architecture

### Enable flag (`nuxt.config.ts` → `runtimeConfig.public`)

```ts
adsenseEnabled: false          // set to true once AdSense approval is received
adsenseClient: 'ca-pub-6385934484512467'
```

When `adsenseEnabled` is false, no AdSense SDK is injected and all `<AdUnit>` components render nothing.

### How it works

- `app.vue` injects `adsbygoogle.js` once globally (only when `adsenseEnabled=true`)
- Each placement uses `<AdUnit ad-slot="...">` which pushes to `window.adsbygoogle` on mount

---

## The AdUnit Component

**File:** [app/components/AdUnit.vue](../app/components/AdUnit.vue)

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `adSlot` | `string` | — | Ad slot ID from AdSense. |
| `format` | `string` | `'auto'` | `'auto'`, `'autorelaxed'`, `'fluid'`. |
| `layout` | `string` | `''` | Use `'in-article'` for content-interleaved placements. |
| `responsive` | `boolean` | `true` | Whether the ad resizes to fill its container. |

---

## Current Placements

### AdSense slots (active when `adsenseEnabled=true`)

| Slot ID | Location | Format | Notes |
|---------|----------|--------|-------|
| `8882057481` | Left sidebar (`app.vue`) | `auto` | Sticky, visible on `xl` screens only |
| `3629730800` | Right sidebar (`app.vue`) | `auto` | Sticky, visible on `xl` screens only |
| `1939246744` | Above footer (`app.vue`) | `autorelaxed` | Full-width, centered |
| `1774557803` | Waiting room (`download.vue`) | `auto` | Shown during countdown |
| `7383145112` | Tool page SEO: before "What Is" | `fluid` | `layout="in-article"` |
| `3210094258` | Tool page SEO: before "What Is Frames" | `fluid` | `layout="in-article"` |
| `8504655099` | Tool page SEO: before "How To" | `fluid` | `layout="in-article"` |
| `5316113927` | Tool page SEO: before "Features" | `fluid` | `layout="in-article"` |
| `3438159116` | Tool page SEO: before "Use Cases" | `fluid` | `layout="in-article"` |
| `7191573428` | Tool page SEO: before "FAQ" | `fluid` | `layout="in-article"` |

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  UHeader                                            │
├────────┬────────────────────────────┬───────────────┤
│ Left   │                            │ Right         │
│ sidebar│   <NuxtPage /> (main)      │ sidebar       │
│ ad     │                            │ ad            │
│ (xl+)  │                            │ (xl+)         │
├────────┴────────────────────────────┴───────────────┤
│  Above-footer ad (centered, full width)             │
├─────────────────────────────────────────────────────┤
│  UFooter                                            │
└─────────────────────────────────────────────────────┘
```

The sidebars are hidden on screens narrower than `xl` (1280px).

---

## Adding a New Slot

1. Create the ad unit in Google AdSense → Ads → By ad unit
2. Copy the **data-ad-slot** value
3. Use in a component:

```vue
<!-- Sidebar or standalone -->
<AdUnit ad-slot="YOUR_SLOT_ID" />

<!-- In-article (between content sections) -->
<AdUnit ad-slot="YOUR_SLOT_ID" format="fluid" layout="in-article" />

<!-- Non-responsive fixed area -->
<AdUnit ad-slot="YOUR_SLOT_ID" format="autorelaxed" :responsive="false" />
```

---

## AdSense Compliance Rules

### No Ads in Modals

The usage-gate modal (`showAdModal`) must contain **no AdSense ad units** — it is a confirmation dialog only. Ads are shown on the waiting room page which the user navigates to voluntarily.

### No Deceptive Text Near Ads

Do not place text near ads that could mislead users into thinking the ad is part of the tool.

### No Accidental Clicks

Do not place ads adjacent to interactive buttons or overlapping tool controls.

### No Auto-Refresh

Do not programmatically refresh or reload ad units. Each `<AdUnit>` pushes to `adsbygoogle` once on mount.

### Content Requirements

Pages serving ads must have substantial, original content. The SEO sections on tool pages fulfill this.

### Ad Density

Current density per tool page:
- 2 sidebar ads (layout-level, hidden on smaller screens)
- 1 above-footer ad (layout-level)
- 1 waiting room ad (only on `/download`)
- ~6 in-article ads (SEO sections, with substantial content between each)

---

## Development Notes

AdSense does not serve on `localhost`. Ad slots render as empty space during local development — this is normal. The `try/catch` in `AdUnit.vue` suppresses any SDK errors from ad blockers.
