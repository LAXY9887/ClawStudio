<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online WebP to PNG Converter',
        'description': 'Convert WebP images back to universally compatible PNG format with full transparency.',
        'url': 'https://clawstudiouo.com/tools/webp-to-png',
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
  { type: 'text', titleKey: 'webpToPng.seo.whatIs.title', contentKeys: ['webpToPng.seo.whatIs.content', 'webpToPng.seo.whatIs.content2', 'webpToPng.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'webpToPng.seo.whyConvert.title', contentKeys: ['webpToPng.seo.whyConvert.content', 'webpToPng.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'webpToPng.seo.howTo.title', stepKeys: ['webpToPng.seo.howTo.step1', 'webpToPng.seo.howTo.step2', 'webpToPng.seo.howTo.step3', 'webpToPng.seo.howTo.step4'] },
  { type: 'features', titleKey: 'webpToPng.seo.features.title', itemKeys: ['webpToPng.seo.features.items.lossless', 'webpToPng.seo.features.items.alpha', 'webpToPng.seo.features.items.compatibility', 'webpToPng.seo.features.items.privacy', 'webpToPng.seo.features.items.fast', 'webpToPng.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'webpToPng.seo.useCases.title', itemKeys: ['webpToPng.seo.useCases.items.editing', 'webpToPng.seo.useCases.items.legacy', 'webpToPng.seo.useCases.items.printing', 'webpToPng.seo.useCases.items.design'] },
  { type: 'faq', titleKey: 'webpToPng.seo.faq.title', itemKeys: ['webpToPng.seo.faq.items.whyConvert', 'webpToPng.seo.faq.items.qualityLoss', 'webpToPng.seo.faq.items.fileSize', 'webpToPng.seo.faq.items.transparency', 'webpToPng.seo.faq.items.privacy', 'webpToPng.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('webpToPng.title'),
  description: () => t('webpToPng.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="webpToPng.title"
    subtitle-key="webpToPng.subtitle"
    prefix="webpToPng"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="webpToPng"
        accept-ext=".webp"
        output-ext="png"
        output-mime="image/png"
        api-endpoint="/api/uniimgc/webp"
        :extra-fields="{ target_format: 'png' }"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
