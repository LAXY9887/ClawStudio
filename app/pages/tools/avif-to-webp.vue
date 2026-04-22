<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online AVIF to WebP Converter',
        'description': 'Convert AVIF images to WebP for broader browser compatibility while keeping file sizes small.',
        'url': 'https://clawstudiouo.com/tools/avif-to-webp',
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
  { type: 'text', titleKey: 'avifToWebp.seo.whatIs.title', contentKeys: ['avifToWebp.seo.whatIs.content', 'avifToWebp.seo.whatIs.content2', 'avifToWebp.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'avifToWebp.seo.whyConvert.title', contentKeys: ['avifToWebp.seo.whyConvert.content', 'avifToWebp.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'avifToWebp.seo.howTo.title', stepKeys: ['avifToWebp.seo.howTo.step1', 'avifToWebp.seo.howTo.step2', 'avifToWebp.seo.howTo.step3', 'avifToWebp.seo.howTo.step4'] },
  { type: 'features', titleKey: 'avifToWebp.seo.features.title', itemKeys: ['avifToWebp.seo.features.items.quality', 'avifToWebp.seo.features.items.compatibility', 'avifToWebp.seo.features.items.alpha', 'avifToWebp.seo.features.items.privacy', 'avifToWebp.seo.features.items.fast', 'avifToWebp.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'avifToWebp.seo.useCases.title', itemKeys: ['avifToWebp.seo.useCases.items.fallback', 'avifToWebp.seo.useCases.items.web', 'avifToWebp.seo.useCases.items.safari', 'avifToWebp.seo.useCases.items.cms'] },
  { type: 'faq', titleKey: 'avifToWebp.seo.faq.title', itemKeys: ['avifToWebp.seo.faq.items.whyConvert', 'avifToWebp.seo.faq.items.browserSupport', 'avifToWebp.seo.faq.items.sizeDifference', 'avifToWebp.seo.faq.items.quality', 'avifToWebp.seo.faq.items.privacy', 'avifToWebp.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('avifToWebp.title'),
  description: () => t('avifToWebp.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="avifToWebp.title"
    subtitle-key="avifToWebp.subtitle"
    prefix="avifToWebp"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="avifToWebp"
        accept-ext=".avif"
        output-ext="webp"
        output-mime="image/webp"
        api-endpoint="/api/uniimgc/avif"
        :extra-fields="{ source_format: 'avif', target_format: 'webp' }"
        :supports-quality="true"
        :default-quality="85"
        icon="i-lucide-zap"
      />
    </template>
  </ToolPageLayout>
</template>
