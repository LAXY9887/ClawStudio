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

const title = computed(() => t('site.name'))
const description = computed(() => t('site.slogan'))

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const showTerms = ref(false)

const termsItems = computed(() => {
  const items: string[] = []
  for (let i = 0; i < 6; i++) {
    items.push(t(`footer.termsContent.items[${i}]`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'))
  }
  return items
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
          <AdUnit ad-slot="8882057481" />
        </div>
      </aside>

      <!-- Main Content -->
      <UMain class="flex-1 min-w-0">
        <NuxtPage />
      </UMain>

      <!-- Right Ad Sidebar -->
      <aside class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <AdUnit ad-slot="3629730800" />
        </div>
      </aside>
    </div>

    <!-- Ad Slot: Above Footer -->
    <div class="flex justify-center py-4">
      <AdUnit ad-slot="1939246744" format="autorelaxed" :responsive="false" />
    </div>

    <UFooter>
      <div style="width: 100%;" class="space-y-2">
        <div class="flex justify-center gap-4 text-sm">
          <NuxtLink to="/privacy" class="text-muted hover:text-primary">
            {{ t('footer.privacy') }}
          </NuxtLink>
          <button class="text-muted hover:text-primary" @click="showTerms = true">
            {{ t('footer.terms') }}
          </button>
          <a href="mailto:angelcemept@gmail.com" class="text-muted hover:text-primary">
            {{ t('footer.contact') }}
          </a>
        </div>
        <p class="text-sm text-muted w-full text-center">
          {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        </p>
      </div>
    </UFooter>

    <!-- Terms of Service Modal -->
    <UModal v-model:open="showTerms">
      <template #content>
        <div class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <h2 class="text-xl font-bold">
            {{ t('footer.terms') }}
          </h2>
          <p class="text-muted leading-relaxed">
            {{ t('footer.termsContent.intro') }}
          </p>
          <ol class="space-y-3 text-sm text-muted leading-relaxed list-decimal pl-5">
            <li v-for="(item, i) in termsItems" :key="i" v-html="item" />
          </ol>
          <div class="flex justify-end pt-2">
            <UButton label="OK" @click="showTerms = false" />
          </div>
        </div>
      </template>
    </UModal>
  </UApp>
</template>
