<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online PNG to WebP Converter',
        'description': 'Convert PNG images to WebP for dramatically smaller web-optimized file sizes.',
        'url': 'https://clawstudiouo.com/tools/png-to-webp',
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
  { type: 'text', titleKey: 'pngToWebp.seo.whatIs.title', contentKeys: ['pngToWebp.seo.whatIs.content', 'pngToWebp.seo.whatIs.content2', 'pngToWebp.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'pngToWebp.seo.whyWebp.title', contentKeys: ['pngToWebp.seo.whyWebp.content', 'pngToWebp.seo.whyWebp.content2'] },
  { type: 'steps', titleKey: 'pngToWebp.seo.howTo.title', stepKeys: ['pngToWebp.seo.howTo.step1', 'pngToWebp.seo.howTo.step2', 'pngToWebp.seo.howTo.step3', 'pngToWebp.seo.howTo.step4'] },
  { type: 'features', titleKey: 'pngToWebp.seo.features.title', itemKeys: ['pngToWebp.seo.features.items.compression', 'pngToWebp.seo.features.items.lossless', 'pngToWebp.seo.features.items.alpha', 'pngToWebp.seo.features.items.privacy', 'pngToWebp.seo.features.items.fast', 'pngToWebp.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'pngToWebp.seo.useCases.title', itemKeys: ['pngToWebp.seo.useCases.items.web', 'pngToWebp.seo.useCases.items.mobile', 'pngToWebp.seo.useCases.items.ecommerce', 'pngToWebp.seo.useCases.items.cms'] },
  { type: 'faq', titleKey: 'pngToWebp.seo.faq.title', itemKeys: ['pngToWebp.seo.faq.items.browserSupport', 'pngToWebp.seo.faq.items.lossless', 'pngToWebp.seo.faq.items.sizeSavings', 'pngToWebp.seo.faq.items.transparency', 'pngToWebp.seo.faq.items.privacy', 'pngToWebp.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('pngToWebp.title'),
  description: () => t('pngToWebp.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="pngToWebp.title"
    subtitle-key="pngToWebp.subtitle"
    prefix="pngToWebp"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="pngToWebp"
        accept-ext=".png"
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
