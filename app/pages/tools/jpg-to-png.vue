<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online JPG to PNG Converter',
        'description': 'Convert JPG images to lossless PNG format, ready for editing with alpha channel support.',
        'url': 'https://clawstudiouo.com/tools/jpg-to-png',
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
  { type: 'text', titleKey: 'jpgToPng.seo.whatIs.title', contentKeys: ['jpgToPng.seo.whatIs.content', 'jpgToPng.seo.whatIs.content2', 'jpgToPng.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'jpgToPng.seo.whyConvert.title', contentKeys: ['jpgToPng.seo.whyConvert.content', 'jpgToPng.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'jpgToPng.seo.howTo.title', stepKeys: ['jpgToPng.seo.howTo.step1', 'jpgToPng.seo.howTo.step2', 'jpgToPng.seo.howTo.step3', 'jpgToPng.seo.howTo.step4'] },
  { type: 'features', titleKey: 'jpgToPng.seo.features.title', itemKeys: ['jpgToPng.seo.features.items.lossless', 'jpgToPng.seo.features.items.alpha', 'jpgToPng.seo.features.items.privacy', 'jpgToPng.seo.features.items.fast', 'jpgToPng.seo.features.items.free', 'jpgToPng.seo.features.items.noSignup'] },
  { type: 'useCases', titleKey: 'jpgToPng.seo.useCases.title', itemKeys: ['jpgToPng.seo.useCases.items.editing', 'jpgToPng.seo.useCases.items.design', 'jpgToPng.seo.useCases.items.transparency', 'jpgToPng.seo.useCases.items.archival'] },
  { type: 'faq', titleKey: 'jpgToPng.seo.faq.title', itemKeys: ['jpgToPng.seo.faq.items.qualityGain', 'jpgToPng.seo.faq.items.fileSize', 'jpgToPng.seo.faq.items.transparency', 'jpgToPng.seo.faq.items.privacy', 'jpgToPng.seo.faq.items.maxSize', 'jpgToPng.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('jpgToPng.title'),
  description: () => t('jpgToPng.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="jpgToPng.title"
    subtitle-key="jpgToPng.subtitle"
    prefix="jpgToPng"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="jpgToPng"
        accept-ext=".jpg,.jpeg"
        output-ext="png"
        output-mime="image/png"
        api-endpoint="/api/uniimgc/jpg-to-png"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
