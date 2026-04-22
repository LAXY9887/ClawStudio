<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to HEIC Converter',
        'description': 'Convert PNG images to Apple HEIC format for efficient storage on iPhone and Mac.',
        'url': 'https://clawstudiouo.com/tools/png-to-heic',
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
  { type: 'text', titleKey: 'pngToHeic.seo.whatIs.title', contentKeys: ['pngToHeic.seo.whatIs.content', 'pngToHeic.seo.whatIs.content2', 'pngToHeic.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'pngToHeic.seo.whyConvert.title', contentKeys: ['pngToHeic.seo.whyConvert.content', 'pngToHeic.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'pngToHeic.seo.howTo.title', stepKeys: ['pngToHeic.seo.howTo.step1', 'pngToHeic.seo.howTo.step2', 'pngToHeic.seo.howTo.step3', 'pngToHeic.seo.howTo.step4'] },
  { type: 'features', titleKey: 'pngToHeic.seo.features.title', itemKeys: ['pngToHeic.seo.features.items.compression', 'pngToHeic.seo.features.items.quality', 'pngToHeic.seo.features.items.apple', 'pngToHeic.seo.features.items.privacy', 'pngToHeic.seo.features.items.fast', 'pngToHeic.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'pngToHeic.seo.useCases.title', itemKeys: ['pngToHeic.seo.useCases.items.iphone', 'pngToHeic.seo.useCases.items.storage', 'pngToHeic.seo.useCases.items.icloud', 'pngToHeic.seo.useCases.items.screenshots'] },
  { type: 'faq', titleKey: 'pngToHeic.seo.faq.title', itemKeys: ['pngToHeic.seo.faq.items.whyHeic', 'pngToHeic.seo.faq.items.transparency', 'pngToHeic.seo.faq.items.quality', 'pngToHeic.seo.faq.items.compatibility', 'pngToHeic.seo.faq.items.privacy', 'pngToHeic.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('pngToHeic.title'),
  description: () => t('pngToHeic.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="pngToHeic.title"
    subtitle-key="pngToHeic.subtitle"
    prefix="pngToHeic"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="pngToHeic"
        accept-ext=".png"
        output-ext="heic"
        output-mime="image/heic"
        api-endpoint="/api/uniimgc/heic"
        :extra-fields="{ source_format: 'png', target_format: 'heic' }"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-smartphone"
      />
    </template>
  </ToolPageLayout>
</template>
