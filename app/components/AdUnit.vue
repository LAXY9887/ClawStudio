<script setup lang="ts">
const props = withDefaults(defineProps<{
  // 共用
  network?: 'adsense' | 'adsterra'
  // AdSense
  adSlot?: string
  format?: string
  layout?: string
  responsive?: boolean
  // Adsterra
  adsterraFormat?: 'banner' | 'native'
  adsterraKey?: string
  adsterraDomain?: string
  adsterraWidth?: number
  adsterraHeight?: number
}>(), {
  network: 'adsense',
  format: 'auto',
  layout: '',
  responsive: true,
  adsterraFormat: 'banner'
})

const config = useRuntimeConfig()
const adsenseEnabled = computed(() => Boolean(config.public.adsenseEnabled))
const adsterraEnabled = computed(() => Boolean(config.public.adsterraEnabled))
const adsenseClient = computed(() => config.public.adsenseClient as string)

const showAdsense = computed(() => props.network === 'adsense' && adsenseEnabled.value && Boolean(props.adSlot))
const showAdsterraBanner = computed(() =>
  props.network === 'adsterra'
  && adsterraEnabled.value
  && props.adsterraFormat === 'banner'
  && Boolean(props.adsterraKey)
  && Boolean(props.adsterraDomain)
  && Boolean(props.adsterraWidth)
  && Boolean(props.adsterraHeight)
)
const showAdsterraNative = computed(() =>
  props.network === 'adsterra'
  && adsterraEnabled.value
  && props.adsterraFormat === 'native'
  && Boolean(props.adsterraKey)
  && Boolean(props.adsterraDomain)
)

const adStyle = computed(() => {
  if (props.layout === 'in-article') return 'display:block; text-align:center;'
  return 'display:block'
})

// Adsterra Banner：用 iframe srcdoc 隔離 atOptions 全域變數
// 每個 iframe 有獨立 window，多個 banner 可同頁不互相覆蓋
const bannerSrcdoc = computed(() => {
  if (!showAdsterraBanner.value) return ''
  const key = String(props.adsterraKey).replace(/'/g, '')
  const domain = String(props.adsterraDomain).replace(/['"<>]/g, '')
  const w = Number(props.adsterraWidth)
  const h = Number(props.adsterraHeight)
  // 注意：閉合 script 標籤必須跳脫，否則 Vue SFC parser 會誤判 setup 區塊結束；
  // ESLint 的 no-useless-escape 對 \/ 會誤報，必須關閉。
  /* eslint-disable no-useless-escape */
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;overflow:hidden;">`
    + `<script>atOptions={'key':'${key}','format':'iframe','height':${h},'width':${w},'params':{}};<\/script>`
    + `<script src="//${domain}/${key}/invoke.js"><\/script>`
    + `</body></html>`
  /* eslint-enable no-useless-escape */
})

// Adsterra Native：onMounted 動態 append script，targeting 對應的 container div
onMounted(() => {
  if (showAdsense.value) {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  }
  if (showAdsterraNative.value) {
    try {
      const s = document.createElement('script')
      s.async = true
      s.setAttribute('data-cfasync', 'false')
      s.src = `https://${props.adsterraDomain}/${props.adsterraKey}/invoke.js`
      document.body.appendChild(s)
    } catch {}
  }
})
</script>

<template>
  <!-- AdSense：每個版位渲染一個 <ins>，全站 SDK 在 app.vue 載一次 -->
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

  <!-- Adsterra Banner：iframe srcdoc 隔離 -->
  <div v-else-if="showAdsterraBanner" class="ad-slot adsterra-banner flex justify-center">
    <iframe
      :srcdoc="bannerSrcdoc"
      :width="adsterraWidth"
      :height="adsterraHeight"
      frameborder="0"
      scrolling="no"
      style="border:0;display:block;max-width:100%;"
    />
  </div>

  <!-- Adsterra Native：container div + 動態 script（onMounted） -->
  <div v-else-if="showAdsterraNative" class="ad-slot adsterra-native">
    <div :id="`container-${adsterraKey}`" />
  </div>
</template>
