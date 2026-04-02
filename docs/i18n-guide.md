# i18n Guide

This document covers how internationalization works in ClawStudio, including file structure, key conventions, adding new languages, and common patterns.

---

## Overview

ClawStudio uses [@nuxtjs/i18n](https://i18n.nuxtjs.org/) with the `prefix_except_default` URL strategy. English (`en`) is the default locale and has no URL prefix. All other locales are prefixed (e.g., `/zh-TW/tools/gif-to-sprite`).

---

## Configuration

The i18n module is configured in `nuxt.config.ts`:

```ts
i18n: {
  locales: [
    { code: 'en', name: 'English', file: 'en.json' },
    { code: 'zh-TW', name: '繁體中文', file: 'zh-TW.json' }
  ],
  defaultLocale: 'en',
  langDir: '../i18n/locales',
  strategy: 'prefix_except_default'
}
```

### URL Strategy: `prefix_except_default`

| Locale | URL |
|--------|-----|
| `en` (default) | `/tools/gif-to-sprite` |
| `zh-TW` | `/zh-TW/tools/gif-to-sprite` |

The default locale has **no prefix**. All non-default locales are prefixed with their locale code.

---

## File Structure

```
i18n/
  locales/
    en.json       # English (default)
    zh-TW.json    # Traditional Chinese
```

Each file is a flat JSON object with nested keys. The top-level keys are:

| Key | Purpose |
|-----|---------|
| `site` | Site name and slogan |
| `nav` | Navigation labels |
| `footer` | Footer links and terms of service |
| `privacy` | Privacy policy page content |
| `waitingRoom` | Download waiting room text |
| `home` | Homepage title and tool cards |
| `gifToSprite` | GIF to Sprite tool (all UI + SEO content) |

Each new tool gets its own top-level key (e.g., `yourTool`).

---

## Key Naming Conventions

### Top-level namespacing

Each tool or page gets a camelCase top-level key:

```json
{
  "gifToSprite": { ... },
  "imageResizer": { ... },
  "jsonFormatter": { ... }
}
```

### Nested structure within a tool

Follow this hierarchy (modeled after `gifToSprite`):

```json
{
  "yourTool": {
    "title": "...",
    "subtitle": "...",
    "mode": { ... },
    "upload": {
      "title": "...",
      "limit": "...",
      "accept": "...",
      "changeFile": "..."
    },
    "convert": "Convert!",
    "url": {
      "placeholder": "..."
    },
    "options": {
      "title": "Advanced Options",
      ...
    },
    "adModal": {
      "title": "...",
      "description": "...",
      "remaining": "...",
      "watch": "Confirm",
      "close": "Close"
    },
    "status": {
      "uploading": "...",
      "converting": "...",
      "error": "...",
      "retry": "..."
    },
    "result": {
      ...
      "reset": "..."
    },
    "seo": {
      "api": { ... },
      "whatIs": { "title": "...", "content": "..." },
      "howTo": {
        "title": "...",
        "step1": { "title": "...", "content": "..." },
        "step2": { "title": "...", "content": "..." }
      },
      "features": {
        "title": "...",
        "items": {
          "featureKey": { "title": "...", "content": "..." }
        }
      },
      "faq": {
        "title": "...",
        "items": {
          "questionKey": { "q": "...", "a": "..." }
        }
      }
    }
  }
}
```

### Homepage tool cards

```json
{
  "home": {
    "tools": {
      "yourTool": {
        "title": "Tool Name",
        "description": "Short description."
      }
    }
  }
}
```

---

## Using `t()` -- Basic Translation

Import from `useI18n()`:

```ts
const { t } = useI18n()
```

### Simple key

```vue
{{ t('gifToSprite.title') }}
```

### With interpolation (named parameters)

JSON:
```json
"info": "{width} x {height} px - {size}"
```

Usage:
```vue
{{ t('gifToSprite.result.spritesheet.info', resultInfo) }}
```

Where `resultInfo` is an object like `{ width: 256, height: 128, size: '45.2 KB' }`.

### With named parameter (single value)

JSON:
```json
"countdown": "Please wait {seconds} seconds..."
```

Usage:
```vue
{{ t('waitingRoom.countdown', { seconds: remaining }) }}
```

### Pluralization

JSON (pipe-separated singular | plural):
```json
"remaining": "{count} free conversion remaining | {count} free conversions remaining"
```

Usage (third argument is the count for plural selection):
```ts
t('gifToSprite.adModal.remaining', { count: remainingUses }, remainingUses)
```

---

## Using `t()` with Computed for SEO Meta

For reactive SEO meta, wrap `t()` in a function:

```ts
useSeoMeta({
  title: () => t('gifToSprite.title'),
  description: () => t('gifToSprite.subtitle')
})
```

Using an arrow function ensures the value updates when the locale changes.

---

## Array-like Items: The Bracket-Index Workaround

Vue I18n's `tm()` function can return raw message objects instead of resolved strings, which causes issues. This project uses a **bracket-index pattern** with `t()` instead:

### JSON

```json
{
  "tips": [
    "First tip with **bold** text.",
    "Second tip.",
    "Third tip.",
    "Fourth tip."
  ]
}
```

### Usage (loop with index)

```vue
<li v-for="i in 4" :key="i">
  <span v-html="t(`waitingRoom.tips[${i - 1}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')" />
</li>
```

### Usage (computed array builder)

This pattern is used in `app.vue` for the terms items:

```ts
const termsItems = computed(() => {
  const items: string[] = []
  for (let i = 0; i < 6; i++) {
    items.push(t(`footer.termsContent.items[${i}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'))
  }
  return items
})
```

**Key takeaway:** When you have an array in the JSON, access each item with `t('key.path[index]')` rather than `tm('key.path')`.

### Markdown-like bold

Some strings use `**bold**` syntax in the JSON. These are converted to `<strong>` tags with a regex replace, then rendered with `v-html`:

```ts
t(`some.key[${i}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
```

---

## Dynamic Key Iteration

For SEO sections where you loop over a known set of keys, use `v-for` with a hardcoded array of key names:

```vue
<div v-for="key in ['spritesheet', 'frames', 'columns', 'padding', 'removeBg', 'url', 'privacy']" :key="key">
  <h3>{{ t(`gifToSprite.seo.features.items.${key}.title`) }}</h3>
  <p>{{ t(`gifToSprite.seo.features.items.${key}.content`) }}</p>
</div>
```

For FAQ items, map the keys to accordion items:

```vue
<UAccordion
  :items="['formats', 'maxSize', 'maxFrames', 'transparency'].map(key => ({
    label: t(`gifToSprite.seo.faq.items.${key}.q`),
    value: key,
    content: t(`gifToSprite.seo.faq.items.${key}.a`)
  }))"
/>
```

---

## Language Switcher

The language switcher is implemented in `app.vue` using `useSwitchLocalePath`:

```ts
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const allLocales = computed(() => locales.value as Array<{ code: string, name: string }>)

const localeItems = computed(() =>
  allLocales.value.map(l => ({
    label: l.name,
    to: switchLocalePath(l.code as 'en' | 'zh-TW'),
    active: l.code === locale.value
  }))
)
```

The items are fed to a `<UDropdownMenu>` that renders each locale as a navigation link. `switchLocalePath()` returns the current route re-mapped to the target locale (e.g., `/tools/gif-to-sprite` -> `/zh-TW/tools/gif-to-sprite`).

The `<html lang>` attribute is set dynamically:

```ts
useHead({
  htmlAttrs: {
    lang: locale
  }
})
```

---

## Locale-Aware Routing with `useLocalePath`

When navigating programmatically, always use `useLocalePath()` to generate locale-prefixed paths:

```ts
const localePath = useLocalePath()

// In a tool page
navigateTo({
  path: localePath('/download'),
  query: { type: 'spritesheet', from: localePath('/tools/gif-to-sprite') }
})
```

In templates with `<NuxtLink>`:

```vue
<NuxtLink :to="localePath(tool.to)">
  ...
</NuxtLink>
```

This ensures that when a user is browsing in `zh-TW`, all links and navigation targets include the `/zh-TW` prefix.

---

## How to Add a New Language

### 1. Create the locale file

Create `i18n/locales/<code>.json` with the same key structure as `en.json`. Translate all values.

### 2. Register in `nuxt.config.ts`

Add the locale to the `locales` array:

```ts
i18n: {
  locales: [
    { code: 'en', name: 'English', file: 'en.json' },
    { code: 'zh-TW', name: '繁體中文', file: 'zh-TW.json' },
    { code: 'ja', name: '日本語', file: 'ja.json' }       // new
  ],
  defaultLocale: 'en',
  langDir: '../i18n/locales',
  strategy: 'prefix_except_default'
}
```

### 3. That's it

The language switcher in `app.vue` automatically picks up all locales from the config. No template changes are needed -- the `localeItems` computed property iterates over `locales.value`.

The new locale will be accessible at `/<code>/...` (e.g., `/ja/tools/gif-to-sprite`).

---

## Checklist for i18n When Adding a New Tool

- [ ] Add the tool's top-level key (e.g., `yourTool`) to `en.json`
- [ ] Add the same key to `zh-TW.json` (and any other locale files)
- [ ] Add `home.tools.yourTool.title` and `home.tools.yourTool.description` in all locale files
- [ ] Ensure all SEO content keys are present (`seo.api`, `seo.whatIs`, `seo.howTo`, `seo.features`, `seo.faq`)
- [ ] Verify pluralization keys use the pipe `|` separator format
- [ ] Verify array items use the bracket-index access pattern, not `tm()`
- [ ] Test the tool page in each locale to confirm no missing keys
