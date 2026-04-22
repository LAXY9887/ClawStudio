<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online WebP to HEIC Converter',
        'description': 'Convert WebP images to Apple HEIC format for efficient storage on iPhone and Mac.',
        'url': 'https://clawstudiouo.com/tools/webp-to-heic',
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
  { type: 'text', titleKey: 'webpToHeic.seo.whatIs.title', contentKeys: ['webpToHeic.seo.whatIs.content', 'webpToHeic.seo.whatIs.content2', 'webpToHeic.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'webpToHeic.seo.whyConvert.title', contentKeys: ['webpToHeic.seo.whyConvert.content', 'webpToHeic.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'webpToHeic.seo.howTo.title', stepKeys: ['webpToHeic.seo.howTo.step1', 'webpToHeic.seo.howTo.step2', 'webpToHeic.seo.howTo.step3', 'webpToHeic.seo.howTo.step4'] },
  { type: 'features', titleKey: 'webpToHeic.seo.features.title', itemKeys: ['webpToHeic.seo.features.items.compression', 'webpToHeic.seo.features.items.quality', 'webpToHeic.seo.features.items.apple', 'webpToHeic.seo.features.items.privacy', 'webpToHeic.seo.features.items.fast', 'webpToHeic.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'webpToHeic.seo.useCases.title', itemKeys: ['webpToHeic.seo.useCases.items.iphone', 'webpToHeic.seo.useCases.items.storage', 'webpToHeic.seo.useCases.items.icloud', 'webpToHeic.seo.useCases.items.archival'] },
  { type: 'faq', titleKey: 'webpToHeic.seo.faq.title', itemKeys: ['webpToHeic.seo.faq.items.whyHeic', 'webpToHeic.seo.faq.items.compatibility', 'webpToHeic.seo.faq.items.quality', 'webpToHeic.seo.faq.items.transparency', 'webpToHeic.seo.faq.items.privacy', 'webpToHeic.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('webpToHeic.title'),
  description: () => t('webpToHeic.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="webpToHeic.title"
    subtitle-key="webpToHeic.subtitle"
    prefix="webpToHeic"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="webpToHeic"
        accept-ext=".webp"
        output-ext="heic"
        output-mime="image/heic"
        api-endpoint="/api/uniimgc/heic"
        :extra-fields="{ source_format: 'webp', target_format: 'heic' }"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-smartphone"
      />
    </template>
  </ToolPageLayout>
</template>
