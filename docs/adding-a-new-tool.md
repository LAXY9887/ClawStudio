# Adding a New Tool to ClawStudio

This guide walks through every step required to add a new tool page to the ClawStudio tool hub. The existing **GIF to Sprite** tool (`app/pages/tools/gif-to-sprite.vue`) is the reference implementation throughout.

---

## Architecture Overview

Every tool follows the same pattern:

```
Browser (tool page)
  -> $fetch('/api/<endpoint>', { method: 'POST', body: formData })
  -> Nuxt server proxy (server/api/<endpoint>.post.ts)
  -> GCP Cloud Run service (external API)
  -> binary response flows back through the proxy to the browser
```

Key concerns handled per tool:

| Concern | Where |
|---------|-------|
| Server proxy | `server/api/<endpoint>.post.ts` |
| Runtime secrets | `nuxt.config.ts` runtimeConfig + `.env` |
| Tool UI page | `app/pages/tools/<tool-slug>.vue` |
| Homepage card | `app/pages/index.vue` |
| i18n keys | `i18n/locales/en.json` + `i18n/locales/zh-TW.json` |
| Usage limiter | Cookie-based, per tool page |
| Download waiting room | `app/pages/download.vue` + `useDownloadStore` |
| SEO content | Bottom of tool page, below `<USeparator>` |
| Route rules | `nuxt.config.ts` routeRules (optional) |

---

## Step 1: Create the Server API Proxy Endpoint

Create a file at `server/api/<your-endpoint>.post.ts`. The proxy reads FormData from the client, forwards it to the Cloud Run service with an internal auth header, and streams the binary response back.

**Reference:** `server/api/convert.post.ts`

```ts
// server/api/your-endpoint.post.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const formData = await readFormData(event)

  const response = await $fetch.raw(`${config.yourServiceUrl}/your-path`, {
    method: 'POST',
    headers: {
      'X-Internal-Key': config.internalKey
    },
    body: formData,
    responseType: 'arrayBuffer'
  })

  // Set the correct Content-Type for your tool's output
  setResponseHeader(event, 'Content-Type', response.headers.get('content-type') || 'application/octet-stream')
  return new Uint8Array(response._data as ArrayBuffer)
})
```

If your endpoint returns a downloadable file (like a ZIP), also set `Content-Disposition`:

```ts
setResponseHeader(event, 'Content-Disposition', 'attachment; filename="output.zip"')
```

**Key points:**
- `readFormData(event)` reads the multipart body from the client.
- `$fetch.raw()` is used to get the raw response (including headers).
- `responseType: 'arrayBuffer'` ensures binary data is not corrupted.
- `config.yourServiceUrl` comes from `runtimeConfig` (see Step 2).

---

## Step 2: Add Environment Variables

### 2a. Update `nuxt.config.ts` runtimeConfig

Add your new service URL to the `runtimeConfig` block. Keys here are **server-only** (not exposed to the client):

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    gifServiceUrl: '',       // existing
    internalKey: '',         // existing (shared across services)
    yourServiceUrl: ''       // <-- add this
  },
  // ...
})
```

### 2b. Update `.env` and `.env.example`

Nuxt auto-maps environment variables to runtimeConfig using the `NUXT_` prefix with snake_case-to-camelCase conversion:

```bash
# .env
NUXT_YOUR_SERVICE_URL=https://your-service-abcdef-uc.a.run.app
```

```bash
# .env.example  (add for documentation)
NUXT_YOUR_SERVICE_URL=https://your-service.a.run.app
```

**Naming convention:** `runtimeConfig.yourServiceUrl` maps to `NUXT_YOUR_SERVICE_URL`.

### 2c. Add to Cloud Secrets / CI

If the project uses Firebase App Hosting or Cloud Build, add the secret to `apphosting.yaml` or your CI environment. The `NUXT_INTERNAL_KEY` is typically shared across all backend services.

---

## Step 3: Create the Tool Page

Create `app/pages/tools/<your-tool-slug>.vue`. Follow this structure, which mirrors `gif-to-sprite.vue`:

### 3a. Script Setup Skeleton

```vue
<script setup lang="ts">
const { t } = useI18n()

// SEO
useSeoMeta({
  title: () => t('yourTool.title'),
  description: () => t('yourTool.subtitle')
})

// ─── State ───
const file = ref<File | null>(null)
const status = ref<'idle' | 'uploading' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')
const resultBlob = ref<Blob | null>(null)

// ─── Usage Limiter ───
const FREE_LIMIT = 3
const usageCount = useCookie<number>('usage_count', { default: () => 0, maxAge: 60 * 60 * 24 })
const showAdModal = ref(false)
const remainingUses = computed(() => FREE_LIMIT - usageCount.value)
const limitExceeded = computed(() => usageCount.value >= FREE_LIMIT)

// ─── Core Logic ───
async function convert() {
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file.value!)
    // ... append tool-specific params

    const response = await $fetch.raw('/api/your-endpoint', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob
    resultBlob.value = blob
    status.value = 'done'

    // If limit exceeded, route to waiting room
    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, 'output-filename.png')
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { detail?: string } }
    errorMessage.value = err.data?.detail || t('yourTool.status.error')
  }
}

function submitConvert() {
  if (!file.value) return
  usageCount.value++   // increment BEFORE converting
  convert()
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = 'output-filename.png'
  a.click()
  URL.revokeObjectURL(url)
}

function onAdConfirm() {
  showAdModal.value = false
  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: {
      type: 'your-type',
      from: localePath('/tools/your-tool-slug')
    }
  })
}

function reset() {
  file.value = null
  status.value = 'idle'
  errorMessage.value = ''
  resultBlob.value = null
}
</script>
```

### 3b. Template Structure

The template follows this layout order:

```
1. Title + subtitle (centered)
2. Upload zone (drag-drop + file input)
3. URL input + Convert button (optional, if tool supports URL input)
4. Remaining uses hint
5. Error alert
6. Advanced options accordion
7. Converting spinner
8. Result preview + download/reset buttons
9. <USeparator>
10. SEO content sections (see Step 7)
11. Ad modal (usage limit exceeded)
```

Each section is conditionally shown based on `status`:
- `idle | error` -- upload zone, options, error alert
- `converting` -- spinner
- `done` -- result preview, action buttons

### 3c. Ad Modal (Usage Limit)

The ad modal is a simple confirmation dialog. It does **not** contain ads (AdSense compliance). It navigates the user to the download waiting room:

```vue
<UModal v-model:open="showAdModal">
  <template #content>
    <div class="p-6 text-center space-y-4">
      <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
      <h3 class="text-lg font-bold">{{ t('yourTool.adModal.title') }}</h3>
      <p class="text-sm text-muted">{{ t('yourTool.adModal.description') }}</p>
      <div class="flex justify-center gap-3 pt-2">
        <UButton :label="t('yourTool.adModal.watch')" size="lg" @click="onAdConfirm" />
        <UButton :label="t('yourTool.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
      </div>
    </div>
  </template>
</UModal>
```

---

## Step 4: Add i18n Keys

You must add keys in **both** `i18n/locales/en.json` and `i18n/locales/zh-TW.json`.

### Top-level key structure

Use a camelCase key matching the tool name. The existing tool uses `gifToSprite`. Example for a new tool:

```jsonc
// en.json (top-level, alongside "gifToSprite", "home", "site", etc.)
{
  "yourTool": {
    "title": "Your Tool Name",
    "subtitle": "One-line description of what this tool does.",
    "upload": {
      "title": "Drop your file here or click to select",
      "limit": "Max file size: 20MB",
      "accept": "Only .xyz files are accepted",
      "changeFile": "Click to choose a different file"
    },
    "convert": "Convert!",
    "url": {
      "placeholder": "Or paste a file URL..."
    },
    "options": {
      "title": "Advanced Options"
      // ... tool-specific option labels
    },
    "adModal": {
      "title": "Please support us.",
      "description": "Unlock 3 more conversions by reading our articles. Thank you for supporting this free tool!",
      "remaining": "{count} free conversion remaining | {count} free conversions remaining",
      "watch": "Confirm",
      "close": "Close"
    },
    "status": {
      "uploading": "Uploading...",
      "converting": "Converting...",
      "error": "Conversion failed",
      "retry": "Try Again"
    },
    "result": {
      // ... result display labels, download button labels
      "reset": "Convert Another File"
    },
    "seo": {
      // ... SEO content sections (see Step 7)
    }
  }
}
```

### Homepage tool card keys

Also add under `home.tools`:

```jsonc
{
  "home": {
    "tools": {
      "gifToSprite": { ... },        // existing
      "yourTool": {                   // add this
        "title": "Your Tool Name",
        "description": "Short description for the homepage card."
      }
    }
  }
}
```

### Pluralization

For the `remaining` key, Vue I18n uses pipe-separated forms:

```json
"remaining": "{count} free conversion remaining | {count} free conversions remaining"
```

Usage in template: `t('yourTool.adModal.remaining', { count: remainingUses }, remainingUses)`

### Array-like items workaround

The project does **not** use `tm()` for arrays. Instead, it accesses array items by index with bracket syntax:

```ts
t(`waitingRoom.tips[${i}]`)
```

This is because `tm()` can return raw message objects. The bracket-index pattern with `t()` is the established convention in this codebase.

---

## Step 5: Add the Tool Card on the Homepage

Edit `app/pages/index.vue`. Add an entry to the `tools` array:

```ts
const tools = [
  {
    key: 'gifToSprite',
    icon: 'i-lucide-images',
    to: '/tools/gif-to-sprite'
  },
  {
    key: 'yourTool',                    // matches home.tools.yourTool in i18n
    icon: 'i-lucide-your-icon',         // any Lucide icon
    to: '/tools/your-tool-slug'         // matches the page filename
  }
]
```

The card template automatically pulls `home.tools.{key}.title` and `home.tools.{key}.description` from i18n. No template changes needed.

---

## Step 6: Integrate the Download Waiting Room

The waiting room is already built. Your tool just needs to:

1. **Store the blob** when the usage limit is exceeded (in the `convert()` function):

```ts
if (usageCount.value >= FREE_LIMIT) {
  useDownloadStore().setBlob(blob, 'your-output-filename.ext')
  showAdModal.value = true
}
```

2. **Navigate to `/download`** when the user confirms the ad modal (in `onAdConfirm()`):

```ts
navigateTo({
  path: localePath('/download'),
  query: {
    type: 'your-type',
    from: localePath('/tools/your-tool-slug')
  }
})
```

The `/download` page and `WaitingRoom.vue` component handle the rest: countdown timer, download trigger, usage count reset, and redirect back to the tool.

**Note:** The blob is stored in a module-level `ref` (not sessionStorage), so it survives navigation but not page refresh. If the user refreshes the download page, they are redirected back to the return path.

---

## Step 7: SEO Content Sections Pattern

Every tool page includes SEO content below the main tool UI. This content helps with search engine indexing and provides educational value. The pattern from `gif-to-sprite.vue`:

```vue
<!-- Placed after the tool UI closing div -->
<USeparator class="my-4" />

<UPageSection>
  <div class="max-w-3xl mx-auto space-y-12">

    <!-- API Promotion (if applicable) -->
    <section>
      <h2 class="text-2xl font-bold mb-4">{{ t('yourTool.seo.api.title') }}</h2>
      <p class="text-muted leading-relaxed mb-3">{{ t('yourTool.seo.api.content') }}</p>
      <!-- CTA buttons to RapidAPI or external resources -->
    </section>

    <!-- In-article ad between sections -->
    <AdUnit slot="YOUR_AD_SLOT_ID" format="fluid" layout="in-article" />

    <!-- What Is [concept] -->
    <section>
      <h2 class="text-2xl font-bold mb-4">{{ t('yourTool.seo.whatIs.title') }}</h2>
      <p class="text-muted leading-relaxed">{{ t('yourTool.seo.whatIs.content') }}</p>
    </section>

    <AdUnit slot="ANOTHER_AD_SLOT_ID" format="fluid" layout="in-article" />

    <!-- How To Use -->
    <section>
      <h2 class="text-2xl font-bold mb-6">{{ t('yourTool.seo.howTo.title') }}</h2>
      <div class="space-y-6">
        <div v-for="step in ['step1', 'step2', 'step3']" :key="step">
          <h3 class="text-lg font-semibold mb-2">{{ t(`yourTool.seo.howTo.${step}.title`) }}</h3>
          <p class="text-muted leading-relaxed">{{ t(`yourTool.seo.howTo.${step}.content`) }}</p>
        </div>
      </div>
    </section>

    <AdUnit slot="ANOTHER_AD_SLOT_ID" format="fluid" layout="in-article" />

    <!-- Features grid -->
    <section>
      <h2 class="text-2xl font-bold mb-6">{{ t('yourTool.seo.features.title') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div v-for="key in ['feature1', 'feature2', 'feature3']" :key="key" class="border border-muted rounded-lg p-5">
          <h3 class="font-semibold mb-2">{{ t(`yourTool.seo.features.items.${key}.title`) }}</h3>
          <p class="text-sm text-muted leading-relaxed">{{ t(`yourTool.seo.features.items.${key}.content`) }}</p>
        </div>
      </div>
    </section>

    <AdUnit slot="ANOTHER_AD_SLOT_ID" format="fluid" layout="in-article" />

    <!-- FAQ -->
    <section>
      <h2 class="text-2xl font-bold mb-6">{{ t('yourTool.seo.faq.title') }}</h2>
      <UAccordion
        :items="['q1', 'q2', 'q3'].map(key => ({
          label: t(`yourTool.seo.faq.items.${key}.q`),
          value: key,
          content: t(`yourTool.seo.faq.items.${key}.a`)
        }))"
      />
    </section>

  </div>
</UPageSection>
```

**Interleave `<AdUnit>` components** between major sections using `format="fluid"` and `layout="in-article"` for in-content ad placements.

---

## Step 8: Route Rules (Optional)

If your tool page should be prerendered at build time (for faster initial loads / SEO), add it to `routeRules` in `nuxt.config.ts`:

```ts
routeRules: {
  '/': { prerender: true },
  '/tools/your-tool-slug': { prerender: true }   // optional
}
```

Currently only the homepage is prerendered. Tool pages that depend heavily on client-side interaction typically do not need prerendering.

---

## Checklist

Use this checklist when adding a new tool:

- [ ] `server/api/<endpoint>.post.ts` -- proxy endpoint created
- [ ] `nuxt.config.ts` -- runtimeConfig key added (if new service URL)
- [ ] `.env` / `.env.example` -- environment variable added
- [ ] `app/pages/tools/<slug>.vue` -- tool page created
- [ ] `i18n/locales/en.json` -- all i18n keys added (tool + homepage card + SEO)
- [ ] `i18n/locales/zh-TW.json` -- all i18n keys added (translated)
- [ ] `app/pages/index.vue` -- tool card added to `tools` array
- [ ] Usage limiter wired (cookie, FREE_LIMIT, modal, waiting room navigation)
- [ ] `useDownloadStore().setBlob()` called when limit exceeded
- [ ] SEO content sections added below separator
- [ ] In-article `<AdUnit>` components placed between SEO sections
- [ ] Tested: convert flow, download within free limit, waiting room flow after limit
- [ ] Cloud secrets / CI updated with new env vars (if any)
