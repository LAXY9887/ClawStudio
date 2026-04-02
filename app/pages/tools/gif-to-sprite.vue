<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('gifToSprite.title'),
  description: () => t('gifToSprite.subtitle')
})

// State
const mode = ref<'spritesheet' | 'frames'>('spritesheet')
const file = ref<File | null>(null)
const gifUrl = ref('')
const status = ref<'idle' | 'uploading' | 'converting' | 'done' | 'error'>('idle')
const errorMessage = ref('')

// Result
const resultBlob = ref<Blob | null>(null)
const resultUrl = ref('')
const resultInfo = ref({ width: 0, height: 0, size: '' })

// Advanced options
const columns = ref<number | undefined>(undefined)
const padding = ref(0)
const removeBg = ref(false)
const bgColorMode = ref<'auto' | 'custom'>('auto')
const bgColorHex = ref('#FFFFFF')
const tolerance = ref(30)

// File input ref
const fileInput = ref<HTMLInputElement>()

// Drag state
const isDragging = ref(false)

// GIF preview
const previewUrl = ref('')

// Accordion state - default open
const openOptions = ref(['options'])

// Usage limiter
const FREE_LIMIT = 5
const usageCount = useCookie<number>('usage_count', { default: () => 0, maxAge: 60 * 60 * 24 })
const showAdModal = ref(false)
const remainingUses = computed(() => FREE_LIMIT - usageCount.value)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) {
    handleFile(target.files[0])
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const droppedFile = e.dataTransfer?.files[0]
  if (droppedFile) {
    handleFile(droppedFile)
  }
}

function handleFile(f: File) {
  if (!f.name.toLowerCase().endsWith('.gif')) {
    errorMessage.value = t('gifToSprite.upload.accept')
    status.value = 'error'
    return
  }
  if (f.size > 20 * 1024 * 1024) {
    errorMessage.value = t('gifToSprite.upload.limit')
    status.value = 'error'
    return
  }
  file.value = f
  gifUrl.value = ''
  errorMessage.value = ''
  status.value = 'idle'
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(f)
}

const hasInput = computed(() => !!file.value || !!gifUrl.value.trim())

async function convert() {
  status.value = 'converting'
  errorMessage.value = ''

  try {
    const formData = new FormData()

    if (file.value) {
      formData.append('file', file.value)
    } else if (gifUrl.value) {
      formData.append('url', gifUrl.value)
    } else {
      return
    }

    // Advanced options
    if (mode.value === 'spritesheet') {
      if (columns.value && columns.value > 0) formData.append('columns', String(columns.value))
      if (padding.value > 0) formData.append('padding', String(padding.value))
    }
    if (removeBg.value) {
      formData.append('remove_bg', 'true')
      formData.append('bg_color', bgColorMode.value === 'auto' ? 'auto' : bgColorHex.value)
      formData.append('tolerance', String(tolerance.value))
    }

    const endpoint = mode.value === 'spritesheet' ? '/api/convert' : '/api/frames'

    const response = await $fetch.raw(endpoint, {
      method: 'POST',
      body: formData,
      responseType: 'blob'
    })

    const blob = response._data as unknown as Blob

    if (mode.value === 'spritesheet') {
      resultBlob.value = blob
      resultUrl.value = URL.createObjectURL(blob)
      resultInfo.value.size = formatSize(blob.size)

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        resultInfo.value.width = img.naturalWidth
        resultInfo.value.height = img.naturalHeight
      }
      img.src = resultUrl.value
    } else {
      // Frames mode: trigger download directly
      resultBlob.value = blob
      downloadResult()
    }

    status.value = 'done'
  } catch (e: unknown) {
    status.value = 'error'
    const err = e as { data?: { detail?: string } }
    errorMessage.value = err.data?.detail || t('gifToSprite.status.error')
  }
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = mode.value === 'spritesheet' ? 'spritesheet.png' : 'frames.zip'
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  file.value = null
  gifUrl.value = ''
  status.value = 'idle'
  errorMessage.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultBlob.value = null
  resultUrl.value = ''
  resultInfo.value = { width: 0, height: 0, size: '' }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function submitConvert() {
  if (!file.value && !gifUrl.value.trim()) return
  if (usageCount.value >= FREE_LIMIT) {
    showAdModal.value = true
    return
  }
  if (gifUrl.value.trim()) file.value = null
  usageCount.value++
  convert()
}

function onAdWatched() {
  showAdModal.value = false
  usageCount.value = 0
}

onMounted(() => {
  // Initialize in-article ad slots
  const adSlots = document.querySelectorAll('.ad-slot .adsbygoogle')
  adSlots.forEach(() => {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  })
})

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 pt-6 space-y-4">
    <div class="text-center">
      <h1 class="text-2xl font-bold">
        {{ t('gifToSprite.title') }}
      </h1>
      <p class="text-sm text-muted mt-1">
        {{ t('gifToSprite.subtitle') }}
      </p>
    </div>
      <!-- Mode Selector -->
      <UTabs
        :items="[
          { label: t('gifToSprite.mode.spritesheet'), value: 'spritesheet' },
          { label: t('gifToSprite.mode.frames'), value: 'frames' }
        ]"
        :model-value="mode"
        @update:model-value="mode = ($event as 'spritesheet' | 'frames')"
      />

      <!-- Upload Zone (shown when idle or error) -->
      <div v-if="status === 'idle' || status === 'error'">
        <!-- Drop Zone -->
        <div
          class="relative border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors"
          :class="[
            isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50',
            previewUrl ? 'p-4' : 'p-16'
          ]"
          @click="fileInput?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".gif"
            class="hidden"
            @change="onFileSelect"
          >
          <!-- GIF Preview -->
          <template v-if="previewUrl">
            <img
              :src="previewUrl"
              :alt="file?.name"
              class="max-h-48 mx-auto rounded"
            >
            <p class="text-sm text-muted mt-2">
              {{ file?.name }} · {{ formatSize(file?.size || 0) }}
            </p>
            <p class="text-xs text-muted mt-1">
              {{ t('gifToSprite.upload.changeFile') }}
            </p>
          </template>
          <!-- Empty State -->
          <template v-else>
            <UIcon name="i-lucide-upload" class="text-4xl text-muted mx-auto mb-4" />
            <p class="font-medium text-lg">
              {{ t('gifToSprite.upload.title') }}
            </p>
            <p class="text-sm text-muted mt-2">
              {{ t('gifToSprite.upload.limit') }}
            </p>
          </template>
        </div>

        <!-- URL Input + Convert -->
        <div class="flex gap-2 mt-4">
          <UInput
            v-model="gifUrl"
            :placeholder="t('gifToSprite.url.placeholder')"
            :disabled="!!file"
            class="flex-1"
            @keyup.enter="submitConvert"
          />
          <UButton
            :label="t('gifToSprite.convert')"
            icon="i-lucide-sparkles"
            :disabled="!hasInput"
            @click="submitConvert"
          />
        </div>

        <!-- Remaining uses -->
        <p v-if="remainingUses <= 3 && remainingUses > 0" class="text-xs text-muted text-center">
          {{ t('gifToSprite.adModal.remaining', { count: remainingUses }, remainingUses) }}
        </p>

        <!-- Error -->
        <UAlert
          v-if="status === 'error'"
          color="error"
          :title="errorMessage"
          class="mt-4"
        >
          <template #actions>
            <UButton
              :label="t('gifToSprite.status.retry')"
              color="error"
              variant="outline"
              size="sm"
              @click="reset"
            />
          </template>
        </UAlert>

        <!-- Advanced Options -->
        <UAccordion
          :items="[{ label: t('gifToSprite.options.title'), value: 'options' }]"
          v-model="openOptions"
          class="mt-4"
        >
          <template #body>
            <div class="space-y-4 pt-2">
              <!-- Spritesheet-only options -->
              <div v-if="mode === 'spritesheet'" class="grid grid-cols-2 gap-4">
                <UFormField :label="t('gifToSprite.options.columns')" :hint="t('gifToSprite.options.columnsHint')">
                  <UInput v-model.number="columns" type="number" :min="1" :placeholder="'Auto'" />
                </UFormField>
                <UFormField :label="t('gifToSprite.options.padding')">
                  <UInput v-model.number="padding" type="number" :min="0" />
                </UFormField>
              </div>

              <!-- Background Removal -->
              <div class="border border-muted rounded-lg p-4 space-y-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <p class="font-medium">
                      {{ t('gifToSprite.options.removeBg') }}
                    </p>
                    <p class="text-xs text-muted mt-1">
                      {{ t('gifToSprite.options.removeBgHint') }}
                    </p>
                  </div>
                  <USwitch v-model="removeBg" />
                </div>

                <template v-if="removeBg">
                  <USeparator />

                  <!-- Background Color -->
                  <div class="space-y-2">
                    <p class="text-sm font-medium">
                      {{ t('gifToSprite.options.bgColor') }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ t('gifToSprite.options.bgColorHint') }}
                    </p>
                    <URadioGroup
                      v-model="bgColorMode"
                      :items="[
                        { label: t('gifToSprite.options.bgColorAuto'), value: 'auto' },
                        { label: t('gifToSprite.options.bgColorCustom'), value: 'custom' }
                      ]"
                    />
                    <div v-if="bgColorMode === 'custom'" class="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        :value="bgColorHex"
                        class="w-10 h-10 rounded cursor-pointer border border-muted bg-transparent p-0.5"
                        @input="bgColorHex = ($event.target as HTMLInputElement).value.toUpperCase()"
                      >
                      <UInput
                        v-model="bgColorHex"
                        placeholder="#FFFFFF"
                        class="flex-1"
                      />
                    </div>
                  </div>

                  <USeparator />

                  <!-- Tolerance -->
                  <div class="space-y-2">
                    <p class="text-sm font-medium">
                      {{ t('gifToSprite.options.tolerance') }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ t('gifToSprite.options.toleranceHint') }}
                    </p>
                    <UInput v-model.number="tolerance" type="number" :min="0" :max="255" class="max-w-32" />
                  </div>
                </template>
              </div>
            </div>
          </template>
        </UAccordion>
      </div>

      <!-- Converting Status -->
      <div v-if="status === 'converting'" class="text-center py-16">
        <UIcon name="i-lucide-loader-circle" class="text-5xl text-primary animate-spin mx-auto mb-4" />
        <p class="text-lg font-medium">
          {{ t('gifToSprite.status.converting') }}
        </p>
      </div>

      <!-- Result -->
      <div v-if="status === 'done'" class="space-y-6">
        <!-- Spritesheet Preview -->
        <div v-if="mode === 'spritesheet' && resultUrl">
          <h3 class="font-semibold text-lg mb-2">
            {{ t('gifToSprite.result.spritesheet.title') }}
          </h3>
          <div class="border border-muted rounded-xl overflow-auto bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img
              :src="resultUrl"
              alt="Spritesheet preview"
              class="max-w-full"
            >
          </div>
          <p class="text-sm text-muted mt-2">
            {{ t('gifToSprite.result.spritesheet.info', resultInfo) }}
          </p>
        </div>

        <!-- Frames info -->
        <div v-if="mode === 'frames'">
          <UAlert
            color="success"
            icon="i-lucide-check-circle"
            :title="t('gifToSprite.result.frames.title')"
            :description="t('gifToSprite.result.frames.info')"
          />
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <UButton
            :label="mode === 'spritesheet' ? t('gifToSprite.result.spritesheet.download') : t('gifToSprite.result.frames.download')"
            icon="i-lucide-download"
            size="lg"
            @click="downloadResult"
          />
          <UButton
            :label="t('gifToSprite.result.reset')"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            size="lg"
            @click="reset"
          />
        </div>
      </div>
  </div>

  <!-- SEO Content Sections -->
  <USeparator class="my-4" />

  <UPageSection>
    <div class="max-w-3xl mx-auto space-y-12">
      <!-- API Promotion -->
      <section>
        <h2 class="text-2xl font-bold mb-4">
          {{ t('gifToSprite.seo.api.title') }}
        </h2>
        <p class="text-muted leading-relaxed mb-3">
          {{ t('gifToSprite.seo.api.content') }}
        </p>
        <p class="text-muted leading-relaxed mb-6">
          {{ t('gifToSprite.seo.api.content2') }}
        </p>

        <!-- API Highlights -->
        <div class="border border-muted rounded-lg p-5 mb-6">
          <h3 class="font-semibold mb-3">
            {{ t('gifToSprite.seo.api.features.title') }}
          </h3>
          <ul class="space-y-2 text-sm text-muted">
            <li v-for="key in ['endpoints', 'input', 'params', 'limit', 'formats', 'response']" :key="key" class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
              <span>{{ t(`gifToSprite.seo.api.features.${key}`) }}</span>
            </li>
          </ul>
        </div>

        <!-- CTA Buttons -->
        <div class="flex flex-wrap gap-3">
          <UButton
            :label="t('gifToSprite.seo.api.cta')"
            icon="i-lucide-external-link"
            to="https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites"
            target="_blank"
            size="lg"
          />
          <UButton
            :label="t('gifToSprite.seo.api.tutorial')"
            icon="i-lucide-book-open"
            to="https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites/tutorials/how-to-use-easy-gif-to-sprites"
            target="_blank"
            color="neutral"
            variant="outline"
            size="lg"
          />
        </div>
      </section>

      <!-- Ad Slot: Before What Is -->
      <div class="ad-slot flex justify-center">
        <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-6385934484512467"
          data-ad-slot="7383145112"
        />
      </div>

      <!-- What is a Sprite Sheet -->
      <section>
        <h2 class="text-2xl font-bold mb-4">
          {{ t('gifToSprite.seo.whatIs.title') }}
        </h2>
        <p class="text-muted leading-relaxed mb-3">
          {{ t('gifToSprite.seo.whatIs.content') }}
        </p>
        <p class="text-muted leading-relaxed">
          {{ t('gifToSprite.seo.whatIs.content2') }}
        </p>
      </section>

      <!-- Ad Slot: Before What Is Frames -->
      <div class="ad-slot flex justify-center">
        <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-6385934484512467"
          data-ad-slot="3210094258"
        />
      </div>

      <!-- What is Frame Extraction -->
      <section>
        <h2 class="text-2xl font-bold mb-4">
          {{ t('gifToSprite.seo.whatIsFrames.title') }}
        </h2>
        <p class="text-muted leading-relaxed mb-3">
          {{ t('gifToSprite.seo.whatIsFrames.content') }}
        </p>
        <p class="text-muted leading-relaxed">
          {{ t('gifToSprite.seo.whatIsFrames.content2') }}
        </p>
      </section>

      <!-- Ad Slot: Before How To -->
      <div class="ad-slot flex justify-center">
        <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-6385934484512467"
          data-ad-slot="8504655099"
        />
      </div>

      <!-- How To -->
      <section>
        <h2 class="text-2xl font-bold mb-6">
          {{ t('gifToSprite.seo.howTo.title') }}
        </h2>
        <div class="space-y-6">
          <div v-for="step in ['step1', 'step2', 'step3', 'step4']" :key="step">
            <h3 class="text-lg font-semibold mb-2">
              {{ t(`gifToSprite.seo.howTo.${step}.title`) }}
            </h3>
            <p class="text-muted leading-relaxed">
              {{ t(`gifToSprite.seo.howTo.${step}.content`) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Ad Slot: Before Features -->
      <div class="ad-slot flex justify-center">
        <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-6385934484512467"
          data-ad-slot="5316113927"
        />
      </div>

      <!-- Features -->
      <section>
        <h2 class="text-2xl font-bold mb-6">
          {{ t('gifToSprite.seo.features.title') }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="key in ['spritesheet', 'frames', 'columns', 'padding', 'removeBg', 'url', 'privacy']"
            :key="key"
            class="border border-muted rounded-lg p-5"
          >
            <h3 class="font-semibold mb-2">
              {{ t(`gifToSprite.seo.features.items.${key}.title`) }}
            </h3>
            <p class="text-sm text-muted leading-relaxed">
              {{ t(`gifToSprite.seo.features.items.${key}.content`) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Ad Slot: Before Use Cases -->
      <div class="ad-slot flex justify-center">
        <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-6385934484512467"
          data-ad-slot="3438159116"
        />
      </div>

      <!-- Use Cases -->
      <section>
        <h2 class="text-2xl font-bold mb-6">
          {{ t('gifToSprite.seo.useCases.title') }}
        </h2>
        <div class="space-y-6">
          <div
            v-for="key in ['gamedev', 'css', 'motionGraphics', 'emotes']"
            :key="key"
          >
            <h3 class="text-lg font-semibold mb-2">
              {{ t(`gifToSprite.seo.useCases.items.${key}.title`) }}
            </h3>
            <p class="text-muted leading-relaxed">
              {{ t(`gifToSprite.seo.useCases.items.${key}.content`) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Ad Slot: Before FAQ -->
      <div class="ad-slot flex justify-center">
        <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-6385934484512467"
          data-ad-slot="7191573428"
        />
      </div>

      <!-- FAQ -->
      <section>
        <h2 class="text-2xl font-bold mb-6">
          {{ t('gifToSprite.seo.faq.title') }}
        </h2>
        <UAccordion
          :items="[
            'formats', 'maxSize', 'maxFrames', 'transparency',
            'autoColumns', 'bgRemoval', 'tolerance', 'free', 'api'
          ].map(key => ({
            label: t(`gifToSprite.seo.faq.items.${key}.q`),
            value: key,
            content: t(`gifToSprite.seo.faq.items.${key}.a`)
          }))"
        />
      </section>
    </div>
  </UPageSection>

  <!-- Ad Modal -->
  <UModal v-model:open="showAdModal">
    <template #content>
      <div class="p-6 text-center space-y-4">
        <UIcon name="i-lucide-tv" class="text-4xl text-primary mx-auto" />
        <h3 class="text-lg font-bold">
          {{ t('gifToSprite.adModal.title') }}
        </h3>
        <p class="text-sm text-muted">
          {{ t('gifToSprite.adModal.description') }}
        </p>

        <!-- Ad placeholder -->
        <div class="w-full h-[250px] bg-muted/30 rounded-lg flex items-center justify-center text-muted text-xs">
          Ad
        </div>

        <div class="flex justify-center gap-3 pt-2">
          <UButton
            :label="t('gifToSprite.adModal.watch')"
            icon="i-lucide-play"
            size="lg"
            @click="onAdWatched"
          />
          <UButton
            :label="t('gifToSprite.adModal.close')"
            color="neutral"
            variant="outline"
            size="lg"
            @click="showAdModal = false"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
