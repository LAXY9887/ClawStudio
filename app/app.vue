<script setup lang="ts">
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const i18nHead = useLocaleHead({ addSeoAttributes: true } as any)
const config = useRuntimeConfig()
const adProvider = config.public.adProvider as 'adsense' | 'monetag' | 'none'
const adsenseClient = config.public.adsenseClient as string
const monetagMultitagSrc = config.public.monetagMultitagSrc as string
const monetagMultitagZone = config.public.monetagMultitagZone as string
const monetagPushSrc = config.public.monetagPushSrc as string
const monetagPushZone = config.public.monetagPushZone as string
const monetagInpagePushSrc = config.public.monetagInpagePushSrc as string
const monetagInpagePushZone = config.public.monetagInpagePushZone as string
const monetagVignetteSrc = config.public.monetagVignetteSrc as string
const monetagVignetteZone = config.public.monetagVignetteZone as string

// 防禦性檢查：只接受 https:// 開頭的完整 URL，避免誤設的 env var（例如字面字串 "monetag"）
// 被當成相對路徑解析為 https://domain.com/monetag 造成 404
function isValidAdScriptSrc(src: string): boolean {
  return src.startsWith('https://') || src.startsWith('http://')
}

const adScripts: Array<Record<string, unknown>> = []
if (adProvider === 'adsense' && adsenseClient) {
  adScripts.push({
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
    async: true,
    crossorigin: 'anonymous'
  })
} else if (adProvider === 'monetag') {
  if (isValidAdScriptSrc(monetagMultitagSrc) && monetagMultitagZone) {
    adScripts.push({
      'src': monetagMultitagSrc,
      'data-zone': monetagMultitagZone,
      'data-cfasync': 'false',
      'async': true
    })
  }
  if (isValidAdScriptSrc(monetagInpagePushSrc) && monetagInpagePushZone) {
    // In-Page Push 的原始 loader 會把 script append 到 <body>，
    // 腳本內部也會檢查自己的 parent，必須用 tagPosition: 'bodyClose' 放在 body 末端
    adScripts.push({
      'src': monetagInpagePushSrc,
      'data-zone': monetagInpagePushZone,
      'data-cfasync': 'false',
      'async': true,
      'tagPosition': 'bodyClose'
    })
  }
  if (isValidAdScriptSrc(monetagVignetteSrc) && monetagVignetteZone) {
    // Vignette 同樣要求掛在 <body>（見 In-Page Push 說明）
    adScripts.push({
      'src': monetagVignetteSrc,
      'data-zone': monetagVignetteZone,
      'data-cfasync': 'false',
      'async': true,
      'tagPosition': 'bodyClose'
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
    ...(i18nHead.value.link || [])
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
      <!-- Left Ad Sidebar (AdSense 專用離散版位) -->
      <aside v-if="adProvider === 'adsense'" class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit ad-slot="8882057481" />
        </div>
      </aside>

      <!-- Main Content -->
      <UMain class="flex-1 min-w-0">
        <NuxtPage />
      </UMain>

      <!-- Right Ad Sidebar (AdSense 專用離散版位) -->
      <aside v-if="adProvider === 'adsense'" class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit ad-slot="3629730800" />
        </div>
      </aside>
    </div>

    <!-- Ad Slot: Above Footer (AdSense 專用離散版位) -->
    <div v-if="adProvider === 'adsense'" class="flex justify-center py-4">
      <AdUnit ad-slot="1939246744" format="autorelaxed" :responsive="false" />
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
          <a href="mailto:angelcemept@gmail.com" class="text-muted hover:text-primary">
            {{ t('footer.contact') }}
          </a>
        </div>
        <p class="text-sm text-muted w-full text-center">
          {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        </p>
      </div>
    </UFooter>

  </UApp>
</template>
