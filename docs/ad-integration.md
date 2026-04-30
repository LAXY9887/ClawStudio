# Ad Networks Integration Guide

This document covers how multiple ad networks (Google AdSense, Adsterra, Monetag) are integrated into ClawStudio, how to use the `AdUnit` component, and the compliance rules that must be followed.

**Architecture summary:** three independent enable flags (`adsenseEnabled`, `adsterraEnabled`, `monetagEnabled`) — any combination can run simultaneously. Each `<AdUnit>` placement explicitly declares which `network` it serves; the global flag controls whether that network actually renders.

---

## Multi-Network Architecture

### Enable flags (`nuxt.config.ts` → `runtimeConfig.public`)

```ts
adsenseEnabled: false      // AdSense SDK + per-slot <ins>
adsterraEnabled: true      // Per-slot iframe (banner) / div + script (native)
monetagEnabled: true       // Global Multitag / Push / In-Page Push / Vignette
```

Each is independent. Set any combination of `true`/`false`. The deprecated `adProvider` setting is retained for backward compatibility but no longer read by current code.

### What each network needs

| Network | Global script (in `app.vue`) | Per-slot rendering (in `AdUnit.vue`) |
|---|---|---|
| **AdSense** | `adsbygoogle.js?client=...` once | `<ins class="adsbygoogle">` per slot, push to `window.adsbygoogle` on mount |
| **Adsterra** | None | `<iframe srcdoc>` (banner) or `<div id="container-{key}">` + dynamic `<script>` (native), per slot |
| **Monetag** | Multitag + 3 inline IIFE loaders (in-page push, vignette, push notif) | Nothing — Multitag auto-covers the page |

### How `<AdUnit>` decides what to render

Each placement declares its `network` prop:

```vue
<AdUnit network="adsense" ad-slot="..." />
<AdUnit network="adsterra" adsterra-format="banner" :adsterra-key="..." :adsterra-domain="..." :adsterra-width="728" :adsterra-height="90" />
<AdUnit network="adsterra" adsterra-format="native" :adsterra-key="..." :adsterra-domain="..." />
```

The component renders only if **both** `network` matches **and** the corresponding global flag is enabled. If the flag is off, the placement is silent (no DOM output).

Monetag has no `<AdUnit>` placements — it covers the page globally via Multitag, so the AdUnit component is bypassed entirely.

---

## The AdUnit Component

**File:** `app/components/AdUnit.vue`

Each ad placement is rendered using the `<AdUnit>` component. The component is **network-agnostic** — `network` prop selects between `adsense` and `adsterra`.

### Props

#### Common
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `network` | `'adsense' \| 'adsterra'` | `'adsense'` | Which network this placement uses. |

#### AdSense props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `adSlot` | `string` | — | Ad slot ID from AdSense. |
| `format` | `string` | `'auto'` | `'auto'`, `'autorelaxed'`, `'fluid'`. |
| `layout` | `string` | `''` | Use `'in-article'` for content-interleaved placements. |
| `responsive` | `boolean` | `true` | Whether the ad resizes to fill its container. |

#### Adsterra props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `adsterraFormat` | `'banner' \| 'native'` | `'banner'` | Banner (fixed-size iframe) or Native (responsive container div). |
| `adsterraKey` | `string` | — | Zone key from Adsterra dashboard. |
| `adsterraDomain` | `string` | — | Per-zone CDN domain (varies — see below). |
| `adsterraWidth` | `number` | — | Banner width in px (only for `format='banner'`). |
| `adsterraHeight` | `number` | — | Banner height in px (only for `format='banner'`). |

### How AdSense renders

On mount, the component pushes an empty object to `window.adsbygoogle`. The AdSense SDK (loaded globally) picks this up and fills the corresponding `<ins>` element:

```ts
onMounted(() => {
  if (showAdsense.value) {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  }
})
```

### How Adsterra Banner renders

Adsterra Banner uses a **global `atOptions` variable** that gets overwritten if multiple banners co-exist on the same page. The fix is to render each banner inside an isolated `<iframe srcdoc>`:

```ts
const bannerSrcdoc = computed(() =>
  `<!DOCTYPE html><html><body style="margin:0">
    <script>atOptions={'key':'${key}',...}<\/script>
    <script src="//${domain}/${key}/invoke.js"><\/script>
  </body></html>`
)
```

Each iframe has its own `window`, so multiple banners with different keys don't collide. The `<\/script>` escape is required to prevent the Vue SFC parser from terminating the host `<script setup>` block.

### How Adsterra Native renders

Native banner uses a `<div id="container-{key}">` paired with a script that targets that container by id. Each zone has a unique key → unique container id → no global collision (no iframe needed):

```vue
<div :id="`container-${adsterraKey}`" />
```

```ts
onMounted(() => {
  if (showAdsterraNative.value) {
    const s = document.createElement('script')
    s.async = true
    s.setAttribute('data-cfasync', 'false')
    s.src = `https://${adsterraDomain}/${adsterraKey}/invoke.js`
    document.body.appendChild(s)
  }
})
```

### Adsterra domain quirk

Different zones serve from different domains:

| Format | Typical domain pattern |
|---|---|
| Banner | `www.highperformanceformat.com` (shared) |
| Native | `pl{publisherId}.profitablecpmratenetwork.com` (publisher-specific subdomain) |

The domain is **not** a global config — it's a per-zone prop, because Adsterra may serve different zones from different domains entirely. Always copy the exact `src` URL from the Adsterra dashboard.

The `try/catch` blocks silently handle cases where ad networks are blocked (ad blockers, development mode, etc.).

---

## Current Placements

### AdSense slots (rendered when `adsenseEnabled=true`)

| Slot ID | Location | Format | Notes |
|---------|----------|--------|-------|
| `8882057481` | Left sidebar (`app.vue`) | `auto` (default) | Sticky, visible on `xl` screens only |
| `3629730800` | Right sidebar (`app.vue`) | `auto` (default) | Sticky, visible on `xl` screens only |
| `1939246744` | Above footer (`app.vue`) | `autorelaxed` | Fallback when `adsterraEnabled=false` |
| `1774557803` | Waiting room (`download.vue`) | `auto` (default) | Shown during countdown |
| `7383145112` | Tool page SEO: before "What Is" | `fluid` | `layout="in-article"` |
| `3210094258` | Tool page SEO: before "What Is Frames" | `fluid` | `layout="in-article"` |
| `8504655099` | Tool page SEO: before "How To" | `fluid` | `layout="in-article"` |
| `5316113927` | Tool page SEO: before "Features" | `fluid` | `layout="in-article"` |
| `3438159116` | Tool page SEO: before "Use Cases" | `fluid` | `layout="in-article"` |
| `7191573428` | Tool page SEO: before "FAQ" | `fluid` | `layout="in-article"` |

### Adsterra zones (rendered when `adsterraEnabled=true`)

| Zone format | Key | Domain | Location |
|---|---|---|---|
| Banner 728×90 | `735d1c8140c9922b8c211fd50fe29304` | `www.highperformanceformat.com` | Above footer (`app.vue`) — overrides AdSense slot at this position |
| Native | `4d95f22de7e6a35151b21c2e9a3cedf6` | `pl29298740.profitablecpmratenetwork.com` | First in-article slot per tool page (`SeoSections.vue`) |

Zone keys are config values in `nuxt.config.ts` → `runtimeConfig.public.adsterraBanner{Key,Domain}` and `adsterraNative{Key,Domain}`.

---

## Ad Placement Locations in the Layout

The global layout in `app.vue` defines three persistent ad zones:

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

The sidebars are hidden on screens smaller than `xl` (1280px). They use `sticky top-20` positioning so the ads remain visible while scrolling.

Tool pages then add in-article ads within their SEO content sections.

---

## How to Create and Add a New Ad Slot

### 1. Create the Ad Unit in Google AdSense

1. Go to [Google AdSense](https://www.google.com/adsense/) -> Ads -> By ad unit.
2. Create a new ad unit (Display, In-feed, In-article, or Multiplex).
3. Copy the **data-ad-slot** value (the numeric ID).

### 2. Use It in a Component

**Sidebar or standalone ad:**

```vue
<AdUnit slot="YOUR_NEW_SLOT_ID" />
```

**In-article ad (between content sections):**

```vue
<AdUnit slot="YOUR_NEW_SLOT_ID" format="fluid" layout="in-article" />
```

**Non-responsive (fixed area):**

```vue
<AdUnit slot="YOUR_NEW_SLOT_ID" format="autorelaxed" :responsive="false" />
```

### 3. Recommended Placement Patterns

For tool pages with SEO content, interleave ads between major content sections:

```vue
<section><!-- What Is --></section>
<AdUnit slot="..." format="fluid" layout="in-article" />
<section><!-- How To --></section>
<AdUnit slot="..." format="fluid" layout="in-article" />
<section><!-- Features --></section>
<AdUnit slot="..." format="fluid" layout="in-article" />
<section><!-- FAQ --></section>
```

This provides natural ad exposure without overwhelming the user. AdSense may choose not to fill every slot depending on inventory and page content.

---

## AdSense Compliance Rules

These rules are enforced by Google AdSense policy and must be followed strictly. Violations can result in account suspension.

### No Forced Ads in Modals

The ad modal (`showAdModal`) must **not** contain any AdSense ad units. It is a simple confirmation dialog only. Ads are displayed on the waiting room page, which the user navigates to voluntarily.

**Correct (current implementation):**
```vue
<UModal v-model:open="showAdModal">
  <template #content>
    <!-- Text only: title, description, Confirm/Close buttons -->
    <!-- NO <AdUnit> here -->
  </template>
</UModal>
```

### No Deceptive Text Near Ads

Do not place text near ads that could mislead users into thinking the ad is part of the tool's functionality. Examples of prohibited text:
- "Click here to download" near an ad
- "Your file is ready" next to an ad unit
- Any label that could be confused with a download button

### No Accidental Clicks

Do not place ads in locations where users might accidentally click them:
- Do not put ads directly adjacent to interactive buttons.
- Do not overlay ads on tool controls.
- The waiting room separates the download button from the ad slot with clear visual spacing.

### No Auto-Refresh of Ad Slots

Do not programmatically refresh or reload ad units. Each `<AdUnit>` pushes to `adsbygoogle` once on mount. If a component is re-mounted (e.g., route change), the SDK handles it.

### Content Requirements

Pages serving ads must have substantial, original content. The SEO content sections on tool pages serve this purpose -- they provide educational content about the tool's domain (sprite sheets, frame extraction, etc.).

### Ad Density

Google does not allow more ads than content on a page. The current layout is:
- 2 sidebar ads (layout-level, hidden on smaller screens)
- 1 above-footer ad (layout-level)
- 1 waiting room ad (only on `/download`)
- ~6 in-article ads (tool page SEO sections, with substantial content between each)

This density is within acceptable limits because each in-article ad is separated by a full content section.

---

## Development and Testing

### Ad Blockers

During development, ad blockers will prevent ads from loading. The `try/catch` in `AdUnit.vue` prevents console errors. The ad slots will render as empty space.

### AdSense Sandbox

AdSense does not serve real ads on `localhost`. You will see blank ad slots during local development. To verify ad placement and sizing, deploy to a staging URL that is added to your AdSense site list.

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Blank ad slots in dev | Normal -- AdSense does not serve on localhost | Deploy to verify |
| Console error `adsbygoogle.push()` | Ad blocker or SDK not loaded | Handled by try/catch |
| Ads not showing in production | New slots take up to 30 minutes; page may not meet content requirements | Wait; ensure sufficient content |
| Layout shift when ads load | Ads have variable height | Use fixed containers or accept minor CLS |
