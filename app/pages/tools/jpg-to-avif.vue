<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online JPG to AVIF Converter',
        'description': 'Convert JPG photos to AVIF for dramatically smaller file sizes — 50% smaller than JPG at the same quality.',
        'url': 'https://clawstudiouo.com/tools/jpg-to-avif',
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
  { type: 'text', titleKey: 'jpgToAvif.seo.whatIs.title', contentKeys: ['jpgToAvif.seo.whatIs.content', 'jpgToAvif.seo.whatIs.content2', 'jpgToAvif.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'jpgToAvif.seo.whyAvif.title', contentKeys: ['jpgToAvif.seo.whyAvif.content', 'jpgToAvif.seo.whyAvif.content2'] },
  { type: 'steps', titleKey: 'jpgToAvif.seo.howTo.title', stepKeys: ['jpgToAvif.seo.howTo.step1', 'jpgToAvif.seo.howTo.step2', 'jpgToAvif.seo.howTo.step3', 'jpgToAvif.seo.howTo.step4'] },
  { type: 'features', titleKey: 'jpgToAvif.seo.features.title', itemKeys: ['jpgToAvif.seo.features.items.compression', 'jpgToAvif.seo.features.items.photo', 'jpgToAvif.seo.features.items.modern', 'jpgToAvif.seo.features.items.privacy', 'jpgToAvif.seo.features.items.fast', 'jpgToAvif.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'jpgToAvif.seo.useCases.title', itemKeys: ['jpgToAvif.seo.useCases.items.web', 'jpgToAvif.seo.useCases.items.photography', 'jpgToAvif.seo.useCases.items.cdn', 'jpgToAvif.seo.useCases.items.mobile'] },
  { type: 'faq', titleKey: 'jpgToAvif.seo.faq.title', itemKeys: ['jpgToAvif.seo.faq.items.browserSupport', 'jpgToAvif.seo.faq.items.sizeSavings', 'jpgToAvif.seo.faq.items.quality', 'jpgToAvif.seo.faq.items.fallback', 'jpgToAvif.seo.faq.items.privacy', 'jpgToAvif.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('jpgToAvif.title'),
  description: () => t('jpgToAvif.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="jpgToAvif.title"
    subtitle-key="jpgToAvif.subtitle"
    prefix="jpgToAvif"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="jpgToAvif"
        accept-ext=".jpg,.jpeg"
        output-ext="avif"
        output-mime="image/avif"
        api-endpoint="/api/uniimgc/avif"
        :extra-fields="{ source_format: 'jpg', target_format: 'avif', speed: '6' }"
        :supports-quality="true"
        :default-quality="75"
        icon="i-lucide-zap"
      />
    </template>
  </ToolPageLayout>
</template>
