<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online HEIC to PNG Converter',
        'description': 'Convert iPhone HEIC photos to lossless PNG format with full transparency support.',
        'url': 'https://clawstudiouo.com/tools/heic-to-png',
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
  { type: 'text', titleKey: 'heicToPng.seo.whatIs.title', contentKeys: ['heicToPng.seo.whatIs.content', 'heicToPng.seo.whatIs.content2', 'heicToPng.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'heicToPng.seo.whyConvert.title', contentKeys: ['heicToPng.seo.whyConvert.content', 'heicToPng.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'heicToPng.seo.howTo.title', stepKeys: ['heicToPng.seo.howTo.step1', 'heicToPng.seo.howTo.step2', 'heicToPng.seo.howTo.step3', 'heicToPng.seo.howTo.step4'] },
  { type: 'features', titleKey: 'heicToPng.seo.features.title', itemKeys: ['heicToPng.seo.features.items.lossless', 'heicToPng.seo.features.items.privacy', 'heicToPng.seo.features.items.fast', 'heicToPng.seo.features.items.compatible', 'heicToPng.seo.features.items.free', 'heicToPng.seo.features.items.noSignup'] },
  { type: 'useCases', titleKey: 'heicToPng.seo.useCases.title', itemKeys: ['heicToPng.seo.useCases.items.editing', 'heicToPng.seo.useCases.items.archival', 'heicToPng.seo.useCases.items.design', 'heicToPng.seo.useCases.items.documentation'] },
  { type: 'faq', titleKey: 'heicToPng.seo.faq.title', itemKeys: ['heicToPng.seo.faq.items.whyPng', 'heicToPng.seo.faq.items.fileSize', 'heicToPng.seo.faq.items.quality', 'heicToPng.seo.faq.items.privacy', 'heicToPng.seo.faq.items.maxSize', 'heicToPng.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('heicToPng.title'),
  description: () => t('heicToPng.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="heicToPng.title"
    subtitle-key="heicToPng.subtitle"
    prefix="heicToPng"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="heicToPng"
        accept-ext=".heic,.heif"
        output-ext="png"
        output-mime="image/png"
        api-endpoint="/api/uniimgc/heic"
        :extra-fields="{ source_format: 'heic', target_format: 'png' }"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
