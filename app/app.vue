<script setup lang="ts">
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()
const i18nHead = useLocaleHead({ addSeoAttributes: true } as any)
const config = useRuntimeConfig()

const canonicalUrl = computed(() => `https://clawstudiouo.com${route.path}`)
const adsenseEnabled = Boolean(config.public.adsenseEnabled)
const adsterraEnabled = Boolean(config.public.adsterraEnabled)
const monetagEnabled = Boolean(config.public.monetagEnabled)
const adsenseClient = config.public.adsenseClient as string
const monetagMultitagSrc = config.public.monetagMultitagSrc as string
const monetagMultitagZone = config.public.monetagMultitagZone as string
const monetagPushSrc = config.public.monetagPushSrc as string
const monetagPushZone = config.public.monetagPushZone as string
const monetagInpagePushSrc = config.public.monetagInpagePushSrc as string
const monetagInpagePushZone = config.public.monetagInpagePushZone as string
const monetagVignetteSrc = config.public.monetagVignetteSrc as string
const monetagVignetteZone = config.public.monetagVignetteZone as string
const adsterraBannerKey = config.public.adsterraBannerKey as string
const adsterraBannerDomain = config.public.adsterraBannerDomain as string
// 注意：adsterraNative{Key,Domain} 在 SeoSections.vue 直接讀，不在這裡使用

// 防禦性檢查：只接受 https:// 開頭的完整 URL，避免誤設的 env var（例如字面字串 "monetag"）
// 被當成相對路徑解析為 https://domain.com/monetag 造成 404
function isValidAdScriptSrc(src: string): boolean {
  return src.startsWith('https://') || src.startsWith('http://')
}

// Monetag 的 In-Page Push / Vignette 官方 loader 是 inline IIFE，會在 runtime 動態建立
// 新的 <script> 並 append 到 <body>。驗證器似乎會字面上比對這段 IIFE 模式，所以我們
// 完全複製它，而不是用 Nuxt 結構化 script 物件渲染成靜態 <script src>。
function buildMonetagInlineLoader(src: string, zone: string): string {
  return `(function(s){s.dataset.zone='${zone}',s.src='${src}'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`
}

const adScripts: Array<Record<string, unknown>> = []

// 三家獨立判斷，可同時載入；Adsterra 不需全域 SDK（每個 iframe 自帶 invoke.js）
if (adsenseEnabled && adsenseClient) {
  adScripts.push({
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
    async: true,
    crossorigin: 'anonymous'
  })
}
if (monetagEnabled) {
  if (isValidAdScriptSrc(monetagMultitagSrc) && monetagMultitagZone) {
    adScripts.push({
      'src': monetagMultitagSrc,
      'data-zone': monetagMultitagZone,
      'data-cfasync': 'false',
      'async': true
    })
  }
  if (isValidAdScriptSrc(monetagInpagePushSrc) && monetagInpagePushZone) {
    // 使用 inline IIFE loader（逐字複製 Monetag 官方提供的載入程式碼），
    // 這樣 Monetag 驗證器能精準匹配到預期的程式碼模式。
    adScripts.push({
      innerHTML: buildMonetagInlineLoader(monetagInpagePushSrc, monetagInpagePushZone),
      tagPosition: 'bodyClose'
    })
  }
  if (isValidAdScriptSrc(monetagVignetteSrc) && monetagVignetteZone) {
    // Vignette 同樣使用 inline IIFE loader（見 In-Page Push 說明）
    adScripts.push({
      innerHTML: buildMonetagInlineLoader(monetagVignetteSrc, monetagVignetteZone),
      tagPosition: 'bodyClose'
    })
  }
  if (isValidAdScriptSrc(monetagPushSrc)) {
    const pushScript: Record<string, unknown> = {
      'src': monetagPushSrc,
      'data-cfasync': 'false',
      'async': true
    }
    if (monetagPushZone) pushScript['data-zone'] = monetagPushZone
    adScripts.push(pushScript)
  }
}

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ...(i18nHead.value.meta || [])
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'canonical', href: canonicalUrl },
    ...((i18nHead.value.link || []).filter(l => (l as { rel?: string }).rel !== 'canonical'))
  ],
  script: adScripts as never,
  htmlAttrs: {
    ...i18nHead.value.htmlAttrs
  }
})

const title = computed(() => t('site.name'))
const description = computed(() => t('site.slogan'))

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const allLocales = computed(() => locales.value as Array<{ code: string, name: string }>)

const currentLocaleName = computed(() =>
  allLocales.value.find(l => l.code === locale.value)?.name || locale.value
)

const localeItems = computed(() =>
  allLocales.value.map(l => ({
    label: l.name,
    to: switchLocalePath(l.code as 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'de' | 'es' | 'pt' | 'ru'),
    active: l.code === locale.value
  }))
)
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="flex items-center">
          <img src="/logo_light.png" alt="ClawStudiouo" class="h-8 dark:hidden">
          <img src="/logo_dark.png" alt="ClawStudiouo" class="h-8 hidden dark:block">
        </NuxtLink>
      </template>

      <template #right>
        <UDropdownMenu :items="localeItems">
          <UButton
            icon="i-lucide-globe"
            :label="currentLocaleName"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </UDropdownMenu>
        <UColorModeButton />
      </template>
    </UHeader>

    <div class="flex min-h-[calc(100vh-var(--ui-header-height)-60px)]">
      <!-- Left Ad Sidebar（AdSense 版位，啟用後顯示；Adsterra 待建立 sidebar zone） -->
      <aside v-if="adsenseEnabled" class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit network="adsense" ad-slot="8882057481" />
        </div>
      </aside>

      <!-- Main Content -->
      <UMain class="flex-1 min-w-0">
        <NuxtPage />
      </UMain>

      <!-- Right Ad Sidebar（同上） -->
      <aside v-if="adsenseEnabled" class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit network="adsense" ad-slot="3629730800" />
        </div>
      </aside>
    </div>

    <!-- Ad Slot: Above Footer（Adsterra Banner 728×90 優先；AdSense 啟用時 fallback） -->
    <div v-if="adsterraEnabled" class="flex justify-center py-4">
      <AdUnit
        network="adsterra"
        adsterra-format="banner"
        :adsterra-key="adsterraBannerKey"
        :adsterra-domain="adsterraBannerDomain"
        :adsterra-width="728"
        :adsterra-height="90"
      />
    </div>
    <div v-else-if="adsenseEnabled" class="flex justify-center py-4">
      <AdUnit network="adsense" ad-slot="1939246744" format="autorelaxed" :responsive="false" />
    </div>

    <UFooter>
      <div style="width: 100%;" class="space-y-2">
        <div class="flex justify-center gap-4 text-sm">
          <NuxtLink to="/privacy" class="text-muted hover:text-primary">
            {{ t('footer.privacy') }}
          </NuxtLink>
          <NuxtLink to="/terms" class="text-muted hover:text-primary">
            {{ t('footer.terms') }}
          </NuxtLink>
          <NuxtLink to="/about" class="text-muted hover:text-primary">
            {{ t('footer.about') }}
          </NuxtLink>
          <NuxtLink to="/contact" class="text-muted hover:text-primary">
            {{ t('footer.contact') }}
          </NuxtLink>
        </div>
        <p class="text-sm text-muted w-full text-center">
          {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        </p>
        <!-- Language quick links for crawlers (native <a>, no JS needed) -->
        <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted pt-2">
          <a
            v-for="loc in (locales as Array<{ code: string, name: string }>)"
            :key="loc.code"
            :href="switchLocalePath(loc.code as 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'de' | 'es' | 'pt' | 'ru')"
            :hreflang="loc.code"
            class="hover:text-primary"
          >
            {{ loc.name }}
          </a>
        </div>
      </div>
    </UFooter>

  </UApp>
</template>
