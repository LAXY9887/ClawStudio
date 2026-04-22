<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online WebP to AVIF Converter',
        'description': 'Convert WebP images to next-generation AVIF for even smaller files and better Core Web Vitals.',
        'url': 'https://clawstudiouo.com/tools/webp-to-avif',
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
  { type: 'text', titleKey: 'webpToAvif.seo.whatIs.title', contentKeys: ['webpToAvif.seo.whatIs.content', 'webpToAvif.seo.whatIs.content2', 'webpToAvif.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'webpToAvif.seo.whyAvif.title', contentKeys: ['webpToAvif.seo.whyAvif.content', 'webpToAvif.seo.whyAvif.content2'] },
  { type: 'steps', titleKey: 'webpToAvif.seo.howTo.title', stepKeys: ['webpToAvif.seo.howTo.step1', 'webpToAvif.seo.howTo.step2', 'webpToAvif.seo.howTo.step3', 'webpToAvif.seo.howTo.step4'] },
  { type: 'features', titleKey: 'webpToAvif.seo.features.title', itemKeys: ['webpToAvif.seo.features.items.compression', 'webpToAvif.seo.features.items.alpha', 'webpToAvif.seo.features.items.nextgen', 'webpToAvif.seo.features.items.privacy', 'webpToAvif.seo.features.items.fast', 'webpToAvif.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'webpToAvif.seo.useCases.title', itemKeys: ['webpToAvif.seo.useCases.items.web', 'webpToAvif.seo.useCases.items.migration', 'webpToAvif.seo.useCases.items.cdn', 'webpToAvif.seo.useCases.items.vitals'] },
  { type: 'faq', titleKey: 'webpToAvif.seo.faq.title', itemKeys: ['webpToAvif.seo.faq.items.vsWebp', 'webpToAvif.seo.faq.items.browserSupport', 'webpToAvif.seo.faq.items.sizeSavings', 'webpToAvif.seo.faq.items.fallback', 'webpToAvif.seo.faq.items.privacy', 'webpToAvif.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('webpToAvif.title'),
  description: () => t('webpToAvif.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="webpToAvif.title"
    subtitle-key="webpToAvif.subtitle"
    prefix="webpToAvif"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="webpToAvif"
        accept-ext=".webp"
        output-ext="avif"
        output-mime="image/avif"
        api-endpoint="/api/uniimgc/avif"
        :extra-fields="{ source_format: 'webp', target_format: 'avif', speed: '6' }"
        :supports-quality="true"
        :default-quality="75"
        icon="i-lucide-zap"
      />
    </template>
  </ToolPageLayout>
</template>
