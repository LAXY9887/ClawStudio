<script setup lang="ts">
// 工作區內的 Adsterra Native Banner shorthand
// 用法：在工具頁的「remaining uses」提示文字下方插入 <WorkspaceNativeAd />
// 自動讀 runtimeConfig 的 zone key/domain，並依 adsterraEnabled 決定是否渲染
const config = useRuntimeConfig()
const adsterraEnabled = computed(() => Boolean(config.public.adsterraEnabled))
const adsterraNativeKey = computed(() => config.public.adsterraNativeKey as string)
const adsterraNativeDomain = computed(() => config.public.adsterraNativeDomain as string)
</script>

<template>
  <AdUnit
    v-if="adsterraEnabled && adsterraNativeKey && adsterraNativeDomain"
    network="adsterra"
    adsterra-format="native"
    :adsterra-key="adsterraNativeKey"
    :adsterra-domain="adsterraNativeDomain"
  />
</template>
