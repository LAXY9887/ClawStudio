<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online HEIC to WebP Converter',
        'description': 'Convert iPhone HEIC photos directly to modern WebP — smaller than JPG, with transparency support.',
        'url': 'https://clawstudiouo.com/tools/heic-to-webp',
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
  { type: 'text', titleKey: 'heicToWebp.seo.whatIs.title', contentKeys: ['heicToWebp.seo.whatIs.content', 'heicToWebp.seo.whatIs.content2', 'heicToWebp.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'heicToWebp.seo.whyWebp.title', contentKeys: ['heicToWebp.seo.whyWebp.content', 'heicToWebp.seo.whyWebp.content2'] },
  { type: 'steps', titleKey: 'heicToWebp.seo.howTo.title', stepKeys: ['heicToWebp.seo.howTo.step1', 'heicToWebp.seo.howTo.step2', 'heicToWebp.seo.howTo.step3', 'heicToWebp.seo.howTo.step4'] },
  { type: 'features', titleKey: 'heicToWebp.seo.features.title', itemKeys: ['heicToWebp.seo.features.items.compression', 'heicToWebp.seo.features.items.lossless', 'heicToWebp.seo.features.items.alpha', 'heicToWebp.seo.features.items.privacy', 'heicToWebp.seo.features.items.fast', 'heicToWebp.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'heicToWebp.seo.useCases.title', itemKeys: ['heicToWebp.seo.useCases.items.web', 'heicToWebp.seo.useCases.items.mobile', 'heicToWebp.seo.useCases.items.cms', 'heicToWebp.seo.useCases.items.cdn'] },
  { type: 'faq', titleKey: 'heicToWebp.seo.faq.title', itemKeys: ['heicToWebp.seo.faq.items.whyWebp', 'heicToWebp.seo.faq.items.browserSupport', 'heicToWebp.seo.faq.items.lossless', 'heicToWebp.seo.faq.items.sizeSavings', 'heicToWebp.seo.faq.items.privacy', 'heicToWebp.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('heicToWebp.title'),
  description: () => t('heicToWebp.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="heicToWebp.title"
    subtitle-key="heicToWebp.subtitle"
    prefix="heicToWebp"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="heicToWebp"
        accept-ext=".heic,.heif"
        output-ext="webp"
        output-mime="image/webp"
        api-endpoint="/api/uniimgc/heic"
        :extra-fields="{ source_format: 'heic', target_format: 'webp' }"
        :supports-quality="true"
        :default-quality="85"
        icon="i-lucide-smartphone"
      />
    </template>
  </ToolPageLayout>
</template>
