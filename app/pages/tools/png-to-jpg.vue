<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to JPG Converter',
        'description': 'Convert PNG images to JPG for smaller file sizes. Transparent backgrounds are flattened to white.',
        'url': 'https://clawstudiouo.com/tools/png-to-jpg',
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
  { type: 'text', titleKey: 'pngToJpg.seo.whatIs.title', contentKeys: ['pngToJpg.seo.whatIs.content', 'pngToJpg.seo.whatIs.content2', 'pngToJpg.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'pngToJpg.seo.whyConvert.title', contentKeys: ['pngToJpg.seo.whyConvert.content', 'pngToJpg.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'pngToJpg.seo.howTo.title', stepKeys: ['pngToJpg.seo.howTo.step1', 'pngToJpg.seo.howTo.step2', 'pngToJpg.seo.howTo.step3', 'pngToJpg.seo.howTo.step4'] },
  { type: 'features', titleKey: 'pngToJpg.seo.features.title', itemKeys: ['pngToJpg.seo.features.items.quality', 'pngToJpg.seo.features.items.sizeReduction', 'pngToJpg.seo.features.items.privacy', 'pngToJpg.seo.features.items.fast', 'pngToJpg.seo.features.items.free', 'pngToJpg.seo.features.items.noSignup'] },
  { type: 'useCases', titleKey: 'pngToJpg.seo.useCases.title', itemKeys: ['pngToJpg.seo.useCases.items.web', 'pngToJpg.seo.useCases.items.email', 'pngToJpg.seo.useCases.items.social', 'pngToJpg.seo.useCases.items.storage'] },
  { type: 'faq', titleKey: 'pngToJpg.seo.faq.title', itemKeys: ['pngToJpg.seo.faq.items.transparency', 'pngToJpg.seo.faq.items.quality', 'pngToJpg.seo.faq.items.sizeSavings', 'pngToJpg.seo.faq.items.reversible', 'pngToJpg.seo.faq.items.privacy', 'pngToJpg.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('pngToJpg.title'),
  description: () => t('pngToJpg.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="pngToJpg.title"
    subtitle-key="pngToJpg.subtitle"
    prefix="pngToJpg"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="pngToJpg"
        accept-ext=".png"
        output-ext="jpg"
        output-mime="image/jpeg"
        api-endpoint="/api/uniimgc/png-to-jpg"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
