<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to AVIF Converter',
        'description': 'Convert PNG images to AVIF for best-in-class web compression with full transparency support.',
        'url': 'https://clawstudiouo.com/tools/png-to-avif',
        'applicationCategory': 'UtilitiesApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        'author': { '@type': 'Organization', 'name': 'ClawStudiouo', 'url': 'https://clawstudiouo.com' }
      })
    }
  ]
})

const seoSections: import('~/types/seo').SeoSection[] = [
  { type: 'text', titleKey: 'pngToAvif.seo.whatIs.title', contentKeys: ['pngToAvif.seo.whatIs.content', 'pngToAvif.seo.whatIs.content2', 'pngToAvif.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'pngToAvif.seo.whyAvif.title', contentKeys: ['pngToAvif.seo.whyAvif.content', 'pngToAvif.seo.whyAvif.content2'] },
  { type: 'steps', titleKey: 'pngToAvif.seo.howTo.title', stepKeys: ['pngToAvif.seo.howTo.step1', 'pngToAvif.seo.howTo.step2', 'pngToAvif.seo.howTo.step3', 'pngToAvif.seo.howTo.step4'] },
  { type: 'features', titleKey: 'pngToAvif.seo.features.title', itemKeys: ['pngToAvif.seo.features.items.compression', 'pngToAvif.seo.features.items.alpha', 'pngToAvif.seo.features.items.modern', 'pngToAvif.seo.features.items.privacy', 'pngToAvif.seo.features.items.fast', 'pngToAvif.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'pngToAvif.seo.useCases.title', itemKeys: ['pngToAvif.seo.useCases.items.web', 'pngToAvif.seo.useCases.items.mobile', 'pngToAvif.seo.useCases.items.cdn', 'pngToAvif.seo.useCases.items.hero'] },
  { type: 'faq', titleKey: 'pngToAvif.seo.faq.title', itemKeys: ['pngToAvif.seo.faq.items.browserSupport', 'pngToAvif.seo.faq.items.vsWebp', 'pngToAvif.seo.faq.items.sizeSavings', 'pngToAvif.seo.faq.items.transparency', 'pngToAvif.seo.faq.items.privacy', 'pngToAvif.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('pngToAvif.title'),
  description: () => t('pngToAvif.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="pngToAvif.title"
    subtitle-key="pngToAvif.subtitle"
    prefix="pngToAvif"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="pngToAvif"
        accept-ext=".png"
        output-ext="avif"
        output-mime="image/avif"
        api-endpoint="/api/uniimgc/avif"
        :extra-fields="{ source_format: 'png', target_format: 'avif', speed: '6' }"
        :supports-quality="true"
        :default-quality="75"
        icon="i-lucide-zap"
      />
    </template>
  </ToolPageLayout>
</template>
