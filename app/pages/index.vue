<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { groups } = useTools()
</script>

<template>
  <UPageHero
    :title="t('home.title')"
  />

  <UPageSection>
    <div class="space-y-12">
      <section v-for="group in groups" :key="group.key">
        <div class="flex items-center gap-2 mb-4">
          <UIcon :name="group.icon" class="text-xl text-primary" />
          <h2 class="text-xl font-semibold">
            {{ t(`relatedTools.groups.${group.key}`) }}
          </h2>
          <span class="text-sm text-muted">· {{ group.tools.length }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="tool in group.tools"
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
      </section>
    </div>
  </UPageSection>
</template>
