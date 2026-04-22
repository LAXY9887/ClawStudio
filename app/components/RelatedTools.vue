<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { groups, findByPath } = useTools()

const currentPath = computed(() => route.path)
const currentTool = computed(() => findByPath(currentPath.value))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="text-xs text-muted mr-1">{{ t('relatedTools.label') }}:</span>

    <UPopover
      v-for="group in groups"
      :key="group.key"
      :content="{ align: 'start', sideOffset: 4 }"
    >
      <UButton
        variant="outline"
        :color="currentTool?.group.key === group.key ? 'primary' : 'neutral'"
        size="sm"
        trailing-icon="i-lucide-chevron-down"
      >
        <UIcon :name="group.icon" class="text-sm" />
        <span class="text-xs">{{ t(`relatedTools.groups.${group.key}`) }}</span>
        <span
          v-if="currentTool?.group.key === group.key"
          class="text-xs text-primary font-medium"
        >
          · {{ t(`relatedTools.${currentTool.tool.key}`) }}
        </span>
        <span v-else class="text-xs text-muted">· {{ group.tools.length }}</span>
      </UButton>

      <template #content>
        <div class="p-2 min-w-56 max-w-sm">
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
      </template>
    </UPopover>
  </div>
</template>
