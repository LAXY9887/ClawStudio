<script setup lang="ts">
const props = withDefaults(defineProps<{
  adSlot?: string
  format?: string
  layout?: string
  responsive?: boolean
}>(), {
  format: 'auto',
  layout: '',
  responsive: true
})

const config = useRuntimeConfig()
const adsenseEnabled = computed(() => Boolean(config.public.adsenseEnabled))
const adsenseClient = computed(() => config.public.adsenseClient as string)

const showAdsense = computed(() => adsenseEnabled.value && Boolean(props.adSlot))

const adStyle = computed(() => {
  if (props.layout === 'in-article') return 'display:block; text-align:center;'
  return 'display:block'
})

onMounted(() => {
  if (showAdsense.value) {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  }
})
</script>

<template>
  <div v-if="showAdsense" class="ad-slot">
    <ins
      class="adsbygoogle"
      :style="adStyle"
      :data-ad-client="adsenseClient"
      :data-ad-slot="adSlot"
      :data-ad-format="format"
      :data-ad-layout="layout || undefined"
      :data-full-width-responsive="responsive || undefined"
    />
  </div>
</template>
