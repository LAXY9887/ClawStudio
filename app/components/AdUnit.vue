<script setup lang="ts">
const props = withDefaults(defineProps<{
  slot: string
  format?: string
  layout?: string
  responsive?: boolean
}>(), {
  format: 'auto',
  layout: '',
  responsive: true
})

const adRef = ref<HTMLElement>()

onMounted(() => {
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
  <div class="ad-slot">
    <ins
      ref="adRef"
      class="adsbygoogle"
      :style="adStyle"
      data-ad-client="ca-pub-6385934484512467"
      :data-ad-slot="slot"
      :data-ad-format="format"
      :data-ad-layout="layout || undefined"
      :data-full-width-responsive="responsive || undefined"
    />
  </div>
</template>
