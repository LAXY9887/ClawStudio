# AdSense Integration Guide

This document covers how Google AdSense is integrated into ClawStudio, how to use the `AdUnit` component, and the compliance rules that must be followed.

---

## How the SDK Is Loaded

The AdSense JavaScript SDK is loaded **once** globally in `app/app.vue` via `useHead`:

```ts
useHead({
  script: [
    {
      src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6385934484512467',
      async: true,
      crossorigin: 'anonymous'
    }
  ]
})
```

This injects the `<script>` tag into the `<head>` of every page. The `client` parameter is the AdSense publisher ID: `ca-pub-6385934484512467`.

---

## The AdUnit Component

**File:** `app/components/AdUnit.vue`

Each ad placement is rendered using the `<AdUnit>` component, which wraps a standard AdSense `<ins>` tag.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `slot` | `string` | **(required)** | Ad slot ID from AdSense. |
| `format` | `string` | `'auto'` | Ad format (`'auto'`, `'autorelaxed'`, `'fluid'`). |
| `layout` | `string` | `''` | Ad layout type. Use `'in-article'` for content-interleaved placements. |
| `responsive` | `boolean` | `true` | Whether the ad resizes to fill its container. |

### How It Works

On mount, the component pushes an empty object to the `window.adsbygoogle` array. The AdSense SDK picks this up and fills the corresponding `<ins>` element:

```ts
onMounted(() => {
  try {
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
  } catch {}
})
```

The `try/catch` silently handles cases where the SDK is blocked (ad blockers, development mode, etc.).

---

## Current Ad Slot IDs and Their Locations

| Slot ID | Location | Format | Notes |
|---------|----------|--------|-------|
| `8882057481` | Left sidebar (`app.vue`) | `auto` (default) | Sticky, visible on `xl` screens only |
| `3629730800` | Right sidebar (`app.vue`) | `auto` (default) | Sticky, visible on `xl` screens only |
| `1939246744` | Above footer (`app.vue`) | `autorelaxed` | Non-responsive (`responsive={false}`) |
| `1774557803` | Waiting room (`download.vue`) | `auto` (default) | Shown during countdown |
| `7383145112` | GIF tool SEO: before "What Is" section | `fluid` | `layout="in-article"` |
| `3210094258` | GIF tool SEO: before "What Is Frames" section | `fluid` | `layout="in-article"` |
| `8504655099` | GIF tool SEO: before "How To" section | `fluid` | `layout="in-article"` |
| `5316113927` | GIF tool SEO: before "Features" section | `fluid` | `layout="in-article"` |
| `3438159116` | GIF tool SEO: before "Use Cases" section | `fluid` | `layout="in-article"` |
| `7191573428` | GIF tool SEO: before "FAQ" section | `fluid` | `layout="in-article"` |

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
