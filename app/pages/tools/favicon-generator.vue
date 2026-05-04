<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online Favicon Generator',
        'description': 'Generate a full favicon pack (ICO, PNG, Apple Touch, Android, Web Manifest) from one source image.',
        'url': 'https://clawstudiouo.com/tools/favicon-generator',
        'applicationCategory': 'DesignApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        'author': { '@type': 'Organization', 'name': 'ClawStudiouo', 'url': 'https://clawstudiouo.com' }
      })
    }
  ]
})

const seoSections: import('~/types/seo').SeoSection[] = [
  { type: 'text', titleKey: 'faviconGenerator.seo.whatIs.title', contentKeys: ['faviconGenerator.seo.whatIs.content', 'faviconGenerator.seo.whatIs.content2', 'faviconGenerator.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'faviconGenerator.seo.contents.title', contentKeys: ['faviconGenerator.seo.contents.content', 'faviconGenerator.seo.contents.content2'] },
  { type: 'steps', titleKey: 'faviconGenerator.seo.howTo.title', stepKeys: ['faviconGenerator.seo.howTo.step1', 'faviconGenerator.seo.howTo.step2', 'faviconGenerator.seo.howTo.step3', 'faviconGenerator.seo.howTo.step4'] },
  { type: 'features', titleKey: 'faviconGenerator.seo.features.title', itemKeys: ['faviconGenerator.seo.features.items.completeSet', 'faviconGenerator.seo.features.items.pwa', 'faviconGenerator.seo.features.items.htmlSnippet', 'faviconGenerator.seo.features.items.privacy', 'faviconGenerator.seo.features.items.fast', 'faviconGenerator.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'faviconGenerator.seo.useCases.title', itemKeys: ['faviconGenerator.seo.useCases.items.newSite', 'faviconGenerator.seo.useCases.items.pwa', 'faviconGenerator.seo.useCases.items.rebrand', 'faviconGenerator.seo.useCases.items.dev'] },
  { type: 'faq', titleKey: 'faviconGenerator.seo.faq.title', itemKeys: ['faviconGenerator.seo.faq.items.sourceSize', 'faviconGenerator.seo.faq.items.svg', 'faviconGenerator.seo.faq.items.transparency', 'faviconGenerator.seo.faq.items.customize', 'faviconGenerator.seo.faq.items.privacy', 'faviconGenerator.seo.faq.items.free'] }
]

const file = ref<File | null>(null)
const status = ref<'idle' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

const resultBlob = ref<Blob | null>(null)
const resultSize = ref('')

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const previewUrl = ref('')

const htmlSnippet = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="shortcut icon" href="/favicon.ico">`

const snippetCopied = ref(false)

const FREE_LIMIT = 3
const usageCount = useCookie<number>('usage_count', { default: () => 0, maxAge: 60 * 60 * 24 })
const showAdModal = ref(false)
const remainingUses = computed(() => FREE_LIMIT - usageCount.value)
const limitExceeded = computed(() => usageCount.value >= FREE_LIMIT)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) handleFile(target.files[0])
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0])
}

function handleFile(f: File) {
  const accepted = ['.png', '.jpg', '.jpeg', '.webp']
  const name = f.name.toLowerCase()
  if (!accepted.some(ext => name.endsWith(ext))) {
    errorMessage.value = t('faviconGenerator.upload.accept')
    status.value = 'error'
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = f
  previewUrl.value = URL.createObjectURL(f)
  errorMessage.value = ''
  status.value = 'idle'
}

const hasInput = computed(() => !!file.value)

const previewSizes = [16, 32, 48, 180, 192, 512]

async function convert() {
  if (!file.value) return
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file.value)

    const response = await $fetch.raw('/api/uniimgc/favicon', {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob
    resultBlob.value = blob
    resultSize.value = formatSize(blob.size)
    status.value = 'done'

    if (usageCount.value >= FREE_LIMIT) {
      useDownloadStore().setBlob(blob, 'favicon-pack.zip')
      showAdModal.value = true
    }
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { message?: string, detail?: string } }
    errorMessage.value = err.data?.message || err.data?.detail || t('faviconGenerator.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = 'favicon-pack.zip'
  a.click()
  URL.revokeObjectURL(url)
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(htmlSnippet)
    snippetCopied.value = true
    setTimeout(() => (snippetCopied.value = false), 2000)
  } catch { /* clipboard unavailable */ }
}

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = null
  previewUrl.value = ''
  status.value = 'idle'
  errorMessage.value = ''
  resultBlob.value = null
  resultSize.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function submitConvert() {
  if (!hasInput.value) return
  usageCount.value++
  convert()
}

function onAdConfirm() {
  showAdModal.value = false
  const localePath = useLocalePath()
  navigateTo({
    path: localePath('/download'),
    query: { type: 'faviconGenerator', from: localePath('/tools/favicon-generator') }
  })
}

useSeoMeta({
  title: () => t('faviconGenerator.title'),
  description: () => t('faviconGenerator.subtitle')
})

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <ToolPageLayout
    title-key="faviconGenerator.title"
    subtitle-key="faviconGenerator.subtitle"
    prefix="faviconGenerator"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <div v-if="status === 'idle' || status === 'error'">
        <!-- Preview (with multi-size grid) -->
        <div v-if="previewUrl" class="space-y-3">
          <div class="border border-muted rounded-lg p-4 bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:10px_10px]">
            <p class="text-sm font-medium mb-3 text-center">{{ t('faviconGenerator.preview.title') }}</p>
            <div class="flex flex-wrap items-end justify-center gap-4">
              <div v-for="size in previewSizes" :key="size" class="text-center">
                <img
                  :src="previewUrl"
                  :alt="`${size}px preview`"
                  :style="{ width: `${Math.min(size, 96)}px`, height: `${Math.min(size, 96)}px` }"
                  class="object-contain mx-auto"
                >
                <p class="text-xs text-muted mt-1 font-mono">{{ size }}×{{ size }}</p>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-sm text-muted">{{ file?.name }} · {{ formatSize(file?.size || 0) }}</p>
            <UButton :label="t('faviconGenerator.upload.changeFile')" size="xs" color="neutral" variant="ghost" @click="fileInput?.click()" />
          </div>
          <input ref="fileInput" type="file" accept=".png,.jpg,.jpeg,.webp" class="hidden" @change="onFileSelect">
        </div>

        <!-- Drop zone -->
        <div
          v-else
          class="relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors"
          :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
          @click="fileInput?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept=".png,.jpg,.jpeg,.webp" class="hidden" @change="onFileSelect">
          <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
          <p class="font-medium text-lg">{{ t('faviconGenerator.upload.title') }}</p>
          <p class="text-sm text-muted mt-2">{{ t('faviconGenerator.upload.limit') }}</p>
        </div>

        <div class="flex justify-end mt-4">
          <UButton
            :label="t('faviconGenerator.convert')"
            icon="i-lucide-package"
            :disabled="!hasInput"
            @click="submitConvert"
          />
        </div>

        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
          {{ t('faviconGenerator.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <UAlert v-if="status === 'error'" color="error" :title="errorMessage" class="mt-4">
          <template #actions>
            <UButton :label="t('faviconGenerator.status.retry')" color="error" variant="outline" size="sm" @click="reset" />
          </template>
        </UAlert>
      </div>

      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">{{ t('faviconGenerator.status.converting') }}</p>
      </div>

      <div v-if="status === 'done'" class="space-y-6">
        <UAlert
          color="success"
          icon="i-lucide-check-circle"
          :title="t('faviconGenerator.result.title')"
          :description="t('faviconGenerator.result.info', { size: resultSize })"
        />

        <!-- Files contained -->
        <div>
          <h3 class="font-semibold text-sm mb-2">{{ t('faviconGenerator.result.filesTitle') }}</h3>
          <ul class="text-sm space-y-1 text-muted font-mono">
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> favicon.ico</li>
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> favicon-16x16.png</li>
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> favicon-32x32.png</li>
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> apple-touch-icon.png (180×180)</li>
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> android-chrome-192x192.png</li>
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> android-chrome-512x512.png</li>
            <li class="flex items-center gap-2"><UIcon name="i-lucide-file" class="text-xs" /> site.webmanifest</li>
          </ul>
        </div>

        <!-- HTML snippet -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-sm">{{ t('faviconGenerator.result.snippetTitle') }}</h3>
            <UButton
              :label="snippetCopied ? t('faviconGenerator.result.copied') : t('faviconGenerator.result.copy')"
              :icon="snippetCopied ? 'i-lucide-check' : 'i-lucide-copy'"
              size="xs"
              color="neutral"
              variant="outline"
              @click="copySnippet"
            />
          </div>
          <pre class="bg-default border border-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">{{ htmlSnippet }}</pre>
        </div>

        <div class="flex gap-3">
          <UButton v-if="!limitExceeded" :label="t('faviconGenerator.result.download')" icon="i-lucide-download" size="lg" @click="downloadResult" />
          <UButton v-if="limitExceeded" :label="t('faviconGenerator.adModal.watch')" icon="i-lucide-arrow-right" size="lg" @click="showAdModal = true" />
          <UButton :label="t('faviconGenerator.result.reset')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="lg" @click="reset" />
        </div>
      </div>
    </template>
  </ToolPageLayout>

  <UModal v-model:open="showAdModal">
    <template #content>
      <div class="p-6 text-center space-y-4">
        <UIcon name="i-lucide-heart" class="text-4xl text-primary mx-auto" />
        <h3 class="text-lg font-bold">{{ t('faviconGenerator.adModal.title') }}</h3>
        <p class="text-sm text-muted">{{ t('faviconGenerator.adModal.description') }}</p>
        <div class="flex justify-center gap-3 pt-2">
          <UButton :label="t('faviconGenerator.adModal.watch')" size="lg" @click="onAdConfirm" />
          <UButton :label="t('faviconGenerator.adModal.close')" color="neutral" variant="outline" size="lg" @click="showAdModal = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
