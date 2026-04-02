<script setup lang="ts">
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  script: [
    {
      src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6385934484512467',
      async: true,
      crossorigin: 'anonymous'
    }
  ],
  htmlAttrs: {
    lang: locale
  }
})

function pushAd() {
  if (import.meta.client) {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  }
}

onMounted(() => {
  pushAd()
  pushAd()
  pushAd()
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
    to: switchLocalePath(l.code as 'en' | 'zh-TW'),
    active: l.code === locale.value
  }))
)
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="text-lg font-bold">
          {{ t('site.name') }}
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
      <!-- Left Ad Sidebar -->
      <aside class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <ins class="adsbygoogle"
            style="display:block"
            data-ad-client="ca-pub-6385934484512467"
            data-ad-slot="8882057481"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </aside>

      <!-- Main Content -->
      <UMain class="flex-1 min-w-0">
        <NuxtPage />
      </UMain>

      <!-- Right Ad Sidebar -->
      <aside class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <ins class="adsbygoogle"
            style="display:block"
            data-ad-client="ca-pub-6385934484512467"
            data-ad-slot="3629730800"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </aside>
    </div>

    <!-- Ad Slot: Above Footer -->
    <div class="ad-slot flex justify-center py-4">
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-format="autorelaxed"
        data-ad-client="ca-pub-6385934484512467"
        data-ad-slot="1939246744"
      />
    </div>

    <UFooter>
      <div style="width: 100%;">
        <p class="text-sm text-muted w-full text-center">
          {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        </p>
      </div>
    </UFooter>
  </UApp>
</template>
