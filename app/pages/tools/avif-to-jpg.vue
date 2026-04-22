<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online AVIF to JPG Converter',
        'description': 'Convert AVIF images to JPG for universal compatibility with email, print, and legacy applications.',
        'url': 'https://clawstudiouo.com/tools/avif-to-jpg',
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
  { type: 'text', titleKey: 'avifToJpg.seo.whatIs.title', contentKeys: ['avifToJpg.seo.whatIs.content', 'avifToJpg.seo.whatIs.content2', 'avifToJpg.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'avifToJpg.seo.whyConvert.title', contentKeys: ['avifToJpg.seo.whyConvert.content', 'avifToJpg.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'avifToJpg.seo.howTo.title', stepKeys: ['avifToJpg.seo.howTo.step1', 'avifToJpg.seo.howTo.step2', 'avifToJpg.seo.howTo.step3', 'avifToJpg.seo.howTo.step4'] },
  { type: 'features', titleKey: 'avifToJpg.seo.features.title', itemKeys: ['avifToJpg.seo.features.items.quality', 'avifToJpg.seo.features.items.compatibility', 'avifToJpg.seo.features.items.smaller', 'avifToJpg.seo.features.items.privacy', 'avifToJpg.seo.features.items.fast', 'avifToJpg.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'avifToJpg.seo.useCases.title', itemKeys: ['avifToJpg.seo.useCases.items.email', 'avifToJpg.seo.useCases.items.legacy', 'avifToJpg.seo.useCases.items.printing', 'avifToJpg.seo.useCases.items.social'] },
  { type: 'faq', titleKey: 'avifToJpg.seo.faq.title', itemKeys: ['avifToJpg.seo.faq.items.whyConvert', 'avifToJpg.seo.faq.items.transparency', 'avifToJpg.seo.faq.items.quality', 'avifToJpg.seo.faq.items.fileSize', 'avifToJpg.seo.faq.items.privacy', 'avifToJpg.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('avifToJpg.title'),
  description: () => t('avifToJpg.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="avifToJpg.title"
    subtitle-key="avifToJpg.subtitle"
    prefix="avifToJpg"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="avifToJpg"
        accept-ext=".avif"
        output-ext="jpg"
        output-mime="image/jpeg"
        api-endpoint="/api/uniimgc/avif"
        :extra-fields="{ source_format: 'avif', target_format: 'jpg' }"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-zap"
      />
    </template>
  </ToolPageLayout>
</template>
