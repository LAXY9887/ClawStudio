<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { groups } = useTools()
const { entries } = useWhatsNew()

const TYPE_LABELS: Record<string, string> = {
  mcp: 'MCP',
  blog: 'Blog',
  tool: 'Tool'
}

const TYPE_COLORS: Record<string, 'primary' | 'info' | 'success'> = {
  mcp: 'primary',
  blog: 'info',
  tool: 'success'
}
</script>

<template>
  <UPageSection>
    <div class="space-y-12">
      <!-- Compact page header -->
      <div class="text-center space-y-2 pt-2">
        <h1 class="text-4xl font-bold tracking-tight">
          {{ t('home.title') }}
        </h1>
        <p class="text-muted text-lg">
          {{ t('home.subtitle') }}
        </p>
      </div>

      <!-- What's New -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-sparkles" class="text-xl text-primary" />
          <h2 class="text-xl font-semibold">
            {{ t('home.whatsNew.heading') }}
          </h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <NuxtLink
            v-for="entry in entries"
            :key="entry.key"
            :to="localePath(entry.to)"
            class="group block"
          >
            <UCard class="h-full transition-shadow group-hover:shadow-lg">
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <UBadge
                    :label="TYPE_LABELS[entry.type]"
                    :color="TYPE_COLORS[entry.type]"
                    variant="subtle"
                  />
                  <UBadge
                    v-if="entry.isNew"
                    label="New"
                    color="success"
                    variant="solid"
                    size="xs"
                  />
                </div>
                <div class="flex items-start gap-3">
                  <UIcon :name="entry.icon" class="text-2xl text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 class="font-semibold">
                      {{ t(`home.whatsNew.items.${entry.key}.title`) }}
                    </h3>
                    <p class="text-sm text-muted mt-1">
                      {{ t(`home.whatsNew.items.${entry.key}.description`) }}
                    </p>
                  </div>
                </div>
                <p class="text-xs text-muted">
                  {{ entry.date }}
                </p>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- Tool groups (unchanged) -->
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
