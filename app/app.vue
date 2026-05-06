<script setup lang="ts">
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const localePath = useLocalePath()
const route = useRoute()
const i18nHead = useLocaleHead({ addSeoAttributes: true } as any)
const config = useRuntimeConfig()

const canonicalUrl = computed(() => `https://clawstudiouo.com${route.path}`)
const adsenseEnabled = Boolean(config.public.adsenseEnabled)
const adsenseClient = config.public.adsenseClient as string

const adScripts: Array<Record<string, unknown>> = []

if (adsenseEnabled && adsenseClient) {
  adScripts.push({
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
    async: true,
    crossorigin: 'anonymous'
  })
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
        <UButton
          icon="i-lucide-book-open"
          :label="t('nav.blog')"
          :to="localePath('/blog')"
          color="neutral"
          variant="ghost"
          size="sm"
        />
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
      <!-- Left Ad Sidebar（AdSense 版位，啟用後顯示） -->
      <aside v-if="adsenseEnabled" class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit ad-slot="8882057481" />
        </div>
      </aside>

      <!-- Main Content -->
      <UMain class="flex-1 min-w-0">
        <NuxtPage />
      </UMain>

      <!-- Right Ad Sidebar（同上） -->
      <aside v-if="adsenseEnabled" class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit ad-slot="3629730800" />
        </div>
      </aside>
    </div>

    <!-- Ad Slot: Above Footer（AdSense） -->
    <div v-if="adsenseEnabled" class="flex justify-center py-4">
      <AdUnit ad-slot="1939246744" format="autorelaxed" :responsive="false" />
    </div>

    <UFooter>
      <div style="width: 100%;" class="space-y-2">
        <div class="flex justify-center gap-4 text-sm flex-wrap">
          <NuxtLink to="/blog" class="text-muted hover:text-primary">
            {{ t('footer.blog') }}
          </NuxtLink>
          <NuxtLink to="/mcp" class="text-muted hover:text-primary">
            {{ t('footer.mcp') }}
          </NuxtLink>
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
