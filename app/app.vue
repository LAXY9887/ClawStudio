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
          <div class="w-[160px] h-[600px] bg-muted/30 rounded-lg flex items-center justify-center text-muted text-xs">
            Ad
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <UMain class="flex-1 min-w-0">
        <NuxtPage />
      </UMain>

      <!-- Right Ad Sidebar -->
      <aside class="hidden xl:block w-[160px] shrink-0 p-4">
        <div class="sticky top-20">
          <div class="w-[160px] h-[600px] bg-muted/30 rounded-lg flex items-center justify-center text-muted text-xs">
            Ad
          </div>
        </div>
      </aside>
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
