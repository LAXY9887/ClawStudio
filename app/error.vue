<script setup lang="ts">
interface NuxtError {
  url?: string
  statusCode?: number
  statusMessage?: string
  message?: string
  stack?: string
}

defineProps<{
  error: NuxtError
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { groups } = useTools()

useSeoMeta({
  title: () => t('error.title'),
  description: () => t('error.description'),
  robots: 'noindex, nofollow'
})

function handleError() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center px-4 py-16">
    <div class="max-w-2xl w-full text-center space-y-8">
      <!-- Status + heading -->
      <div class="space-y-3">
        <p class="text-7xl sm:text-8xl font-extrabold text-primary/80 tracking-tight">
          {{ error.statusCode || 404 }}
        </p>
        <h1 class="text-2xl sm:text-3xl font-bold">
          {{ error.statusCode === 404 ? t('error.notFoundTitle') : t('error.genericTitle') }}
        </h1>
        <p class="text-muted max-w-lg mx-auto">
          {{ error.statusCode === 404 ? t('error.notFoundDescription') : t('error.genericDescription') }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap justify-center gap-3">
        <UButton
          icon="i-lucide-home"
          size="lg"
          :label="t('error.backHome')"
          @click="handleError"
        />
        <UButton
          icon="i-lucide-arrow-left"
          size="lg"
          variant="outline"
          color="neutral"
          :label="t('error.goBack')"
          @click="$router.back()"
        />
      </div>

      <!-- Quick links to tool groups -->
      <div class="pt-6 border-t border-muted space-y-4">
        <p class="text-sm text-muted">
          {{ t('error.tryTools') }}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <NuxtLink
            v-for="group in groups"
            :key="group.key"
            :to="localePath(group.tools[0]!.to)"
            class="group border border-muted rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div class="flex items-center gap-2 mb-2">
              <UIcon :name="group.icon" class="text-lg text-primary" />
              <p class="font-semibold text-sm group-hover:text-primary transition-colors">
                {{ t(`relatedTools.groups.${group.key}`) }}
              </p>
            </div>
            <p class="text-xs text-muted">
              {{ group.tools.length }} {{ t('error.toolsCount') }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
