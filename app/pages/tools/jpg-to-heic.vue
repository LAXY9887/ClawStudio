<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online JPG to HEIC Converter',
        'description': 'Convert JPG photos to Apple HEIC format for efficient storage on iPhone and Mac.',
        'url': 'https://clawstudiouo.com/tools/jpg-to-heic',
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
  { type: 'text', titleKey: 'jpgToHeic.seo.whatIs.title', contentKeys: ['jpgToHeic.seo.whatIs.content', 'jpgToHeic.seo.whatIs.content2', 'jpgToHeic.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'jpgToHeic.seo.whyConvert.title', contentKeys: ['jpgToHeic.seo.whyConvert.content', 'jpgToHeic.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'jpgToHeic.seo.howTo.title', stepKeys: ['jpgToHeic.seo.howTo.step1', 'jpgToHeic.seo.howTo.step2', 'jpgToHeic.seo.howTo.step3', 'jpgToHeic.seo.howTo.step4'] },
  { type: 'features', titleKey: 'jpgToHeic.seo.features.title', itemKeys: ['jpgToHeic.seo.features.items.compression', 'jpgToHeic.seo.features.items.quality', 'jpgToHeic.seo.features.items.apple', 'jpgToHeic.seo.features.items.privacy', 'jpgToHeic.seo.features.items.fast', 'jpgToHeic.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'jpgToHeic.seo.useCases.title', itemKeys: ['jpgToHeic.seo.useCases.items.iphone', 'jpgToHeic.seo.useCases.items.storage', 'jpgToHeic.seo.useCases.items.icloud', 'jpgToHeic.seo.useCases.items.archival'] },
  { type: 'faq', titleKey: 'jpgToHeic.seo.faq.title', itemKeys: ['jpgToHeic.seo.faq.items.whyHeic', 'jpgToHeic.seo.faq.items.compatibility', 'jpgToHeic.seo.faq.items.quality', 'jpgToHeic.seo.faq.items.sizeSavings', 'jpgToHeic.seo.faq.items.privacy', 'jpgToHeic.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('jpgToHeic.title'),
  description: () => t('jpgToHeic.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="jpgToHeic.title"
    subtitle-key="jpgToHeic.subtitle"
    prefix="jpgToHeic"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="jpgToHeic"
        accept-ext=".jpg,.jpeg"
        output-ext="heic"
        output-mime="image/heic"
        api-endpoint="/api/uniimgc/heic"
        :extra-fields="{ source_format: 'jpg', target_format: 'heic' }"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-smartphone"
      />
    </template>
  </ToolPageLayout>
</template>
