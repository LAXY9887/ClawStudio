<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online JPG to WebP Converter',
        'description': 'Convert JPG images to WebP for smaller file sizes while preserving photographic quality.',
        'url': 'https://clawstudiouo.com/tools/jpg-to-webp',
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
  { type: 'text', titleKey: 'jpgToWebp.seo.whatIs.title', contentKeys: ['jpgToWebp.seo.whatIs.content', 'jpgToWebp.seo.whatIs.content2', 'jpgToWebp.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'jpgToWebp.seo.whyWebp.title', contentKeys: ['jpgToWebp.seo.whyWebp.content', 'jpgToWebp.seo.whyWebp.content2'] },
  { type: 'steps', titleKey: 'jpgToWebp.seo.howTo.title', stepKeys: ['jpgToWebp.seo.howTo.step1', 'jpgToWebp.seo.howTo.step2', 'jpgToWebp.seo.howTo.step3', 'jpgToWebp.seo.howTo.step4'] },
  { type: 'features', titleKey: 'jpgToWebp.seo.features.title', itemKeys: ['jpgToWebp.seo.features.items.compression', 'jpgToWebp.seo.features.items.photo', 'jpgToWebp.seo.features.items.quality', 'jpgToWebp.seo.features.items.privacy', 'jpgToWebp.seo.features.items.fast', 'jpgToWebp.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'jpgToWebp.seo.useCases.title', itemKeys: ['jpgToWebp.seo.useCases.items.web', 'jpgToWebp.seo.useCases.items.mobile', 'jpgToWebp.seo.useCases.items.ecommerce', 'jpgToWebp.seo.useCases.items.cdn'] },
  { type: 'faq', titleKey: 'jpgToWebp.seo.faq.title', itemKeys: ['jpgToWebp.seo.faq.items.browserSupport', 'jpgToWebp.seo.faq.items.qualityLoss', 'jpgToWebp.seo.faq.items.sizeSavings', 'jpgToWebp.seo.faq.items.lossless', 'jpgToWebp.seo.faq.items.privacy', 'jpgToWebp.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('jpgToWebp.title'),
  description: () => t('jpgToWebp.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="jpgToWebp.title"
    subtitle-key="jpgToWebp.subtitle"
    prefix="jpgToWebp"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="jpgToWebp"
        accept-ext=".jpg,.jpeg"
        output-ext="webp"
        output-mime="image/webp"
        api-endpoint="/api/uniimgc/webp"
        :supports-quality="true"
        :default-quality="80"
        :supports-lossless="true"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
