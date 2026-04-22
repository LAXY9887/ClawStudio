<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { groups, totalCount, findByPath } = useTools()

const currentPath = computed(() => route.path)
const currentTool = computed(() => findByPath(currentPath.value))
</script>

<template>
  <UPopover :content="{ align: 'start', sideOffset: 4 }">
    <UButton
      variant="outline"
      color="neutral"
      size="sm"
      trailing-icon="i-lucide-chevron-down"
    >
      <UIcon name="i-lucide-wrench" class="text-sm" />
      <span class="text-xs">{{ t('relatedTools.label') }}</span>
      <span v-if="currentTool" class="text-xs text-primary font-medium">
        · {{ t(`relatedTools.${currentTool.tool.key}`) }}
      </span>
      <span v-else class="text-xs text-muted">· {{ totalCount }}</span>
    </UButton>

    <template #content>
      <div class="p-3 space-y-4 min-w-72 max-w-sm">
        <div v-for="group in groups" :key="group.key">
          <div class="flex items-center gap-1.5 mb-1.5 px-1">
            <UIcon :name="group.icon" class="text-xs text-muted" />
            <p class="text-xs font-semibold text-muted uppercase tracking-wide">
              {{ t(`relatedTools.groups.${group.key}`) }}
            </p>
          </div>
          <div class="flex flex-col">
            <NuxtLink
              v-for="tool in group.tools"
              :key="tool.key"
              :to="localePath(tool.to)"
              class="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors"
              :class="currentPath.includes(tool.to)
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-default hover:bg-elevated'"
            >
              <UIcon :name="tool.icon" class="text-sm shrink-0" />
              <span>{{ t(`relatedTools.${tool.key}`) }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
