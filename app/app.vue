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

const showTerms = ref(false)

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
      <div style="width: 100%;" class="space-y-2">
        <div class="flex justify-center gap-4 text-sm">
          <NuxtLink to="/privacy" class="text-muted hover:text-primary">
            {{ t('footer.privacy') }}
          </NuxtLink>
          <button class="text-muted hover:text-primary" @click="showTerms = true">
            {{ t('footer.terms') }}
          </button>
          <NuxtLink to="/contact" class="text-muted hover:text-primary">
            {{ t('footer.contact') }}
          </NuxtLink>
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
            <li v-for="(item, i) in (t('footer.termsContent.items') as unknown as string[])" :key="i" v-html="item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')" />
          </ol>
          <div class="flex justify-end pt-2">
            <UButton label="OK" @click="showTerms = false" />
          </div>
        </div>
      </template>
    </UModal>
  </UApp>
</template>
