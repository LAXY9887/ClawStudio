<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online AVIF to PNG Converter',
        'description': 'Convert AVIF images to universally compatible PNG for editing, legacy tools, and older browsers.',
        'url': 'https://clawstudiouo.com/tools/avif-to-png',
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
  { type: 'text', titleKey: 'avifToPng.seo.whatIs.title', contentKeys: ['avifToPng.seo.whatIs.content', 'avifToPng.seo.whatIs.content2', 'avifToPng.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'avifToPng.seo.whyConvert.title', contentKeys: ['avifToPng.seo.whyConvert.content', 'avifToPng.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'avifToPng.seo.howTo.title', stepKeys: ['avifToPng.seo.howTo.step1', 'avifToPng.seo.howTo.step2', 'avifToPng.seo.howTo.step3', 'avifToPng.seo.howTo.step4'] },
  { type: 'features', titleKey: 'avifToPng.seo.features.title', itemKeys: ['avifToPng.seo.features.items.lossless', 'avifToPng.seo.features.items.alpha', 'avifToPng.seo.features.items.compatibility', 'avifToPng.seo.features.items.privacy', 'avifToPng.seo.features.items.fast', 'avifToPng.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'avifToPng.seo.useCases.title', itemKeys: ['avifToPng.seo.useCases.items.editing', 'avifToPng.seo.useCases.items.legacy', 'avifToPng.seo.useCases.items.printing', 'avifToPng.seo.useCases.items.design'] },
  { type: 'faq', titleKey: 'avifToPng.seo.faq.title', itemKeys: ['avifToPng.seo.faq.items.whyConvert', 'avifToPng.seo.faq.items.qualityLoss', 'avifToPng.seo.faq.items.fileSize', 'avifToPng.seo.faq.items.transparency', 'avifToPng.seo.faq.items.privacy', 'avifToPng.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('avifToPng.title'),
  description: () => t('avifToPng.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="avifToPng.title"
    subtitle-key="avifToPng.subtitle"
    prefix="avifToPng"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="avifToPng"
        accept-ext=".avif"
        output-ext="png"
        output-mime="image/png"
        api-endpoint="/api/uniimgc/avif"
        :extra-fields="{ source_format: 'avif', target_format: 'png' }"
        icon="i-lucide-zap"
      />
    </template>
  </ToolPageLayout>
</template>
