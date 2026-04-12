<script setup lang="ts">
const props = withDefaults(defineProps<{
  adSlot: string
  format?: string
  layout?: string
  responsive?: boolean
}>(), {
  format: 'auto',
  layout: '',
  responsive: true
})

const config = useRuntimeConfig()
const provider = computed(() => config.public.adProvider as 'adsense' | 'monetag' | 'none')
const adsenseClient = computed(() => config.public.adsenseClient as string)

const adRef = ref<HTMLElement>()

onMounted(() => {
  if (provider.value !== 'adsense') return
  try {
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
  } catch {}
})

const adStyle = computed(() => {
  if (props.layout === 'in-article') {
    return 'display:block; text-align:center;'
  }
  return 'display:block'
})
</script>

<template>
  <!-- AdSense 模式：離散式版位，每個 AdUnit 渲染一個 <ins> -->
  <div v-if="provider === 'adsense'" class="ad-slot">
    <ins
      ref="adRef"
      class="adsbygoogle"
      :style="adStyle"
      :data-ad-client="adsenseClient"
      :data-ad-slot="adSlot"
      :data-ad-format="format"
      :data-ad-layout="layout || undefined"
      :data-full-width-responsive="responsive || undefined"
    />
  </div>
  <!-- Monetag 模式：全站式由 Multitag 自動覆蓋，元件不渲染實體版位 -->
  <!-- provider === 'none' 亦不渲染 -->
</template>
