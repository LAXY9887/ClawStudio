<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const tools = [
  {
    key: 'gifToSprite',
    icon: 'i-lucide-images',
    to: '/tools/gif-to-sprite'
  }
]
</script>

<template>
  <UPageHero
    :title="t('home.title')"
  />

  <UPageSection>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink
        v-for="tool in tools"
        :key="tool.key"
        :to="localePath(tool.to)"
        class="group block"
      >
        <UCard class="h-full transition-shadow group-hover:shadow-lg">
          <div class="flex items-start gap-4">
            <UIcon :name="tool.icon" class="text-3xl text-primary shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-lg">
                {{ t(`home.tools.${tool.key}.title`) }}
              </h3>
              <p class="text-sm text-muted mt-1">
                {{ t(`home.tools.${tool.key}.description`) }}
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </UPageSection>
</template>
