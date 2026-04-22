<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online HEIC to JPG Converter',
        'description': 'Convert iPhone HEIC photos to universally compatible JPG format in your browser.',
        'url': 'https://clawstudiouo.com/tools/heic-to-jpg',
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
  { type: 'text', titleKey: 'heicToJpg.seo.whatIs.title', contentKeys: ['heicToJpg.seo.whatIs.content', 'heicToJpg.seo.whatIs.content2', 'heicToJpg.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'heicToJpg.seo.whyConvert.title', contentKeys: ['heicToJpg.seo.whyConvert.content', 'heicToJpg.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'heicToJpg.seo.howTo.title', stepKeys: ['heicToJpg.seo.howTo.step1', 'heicToJpg.seo.howTo.step2', 'heicToJpg.seo.howTo.step3', 'heicToJpg.seo.howTo.step4'] },
  { type: 'features', titleKey: 'heicToJpg.seo.features.title', itemKeys: ['heicToJpg.seo.features.items.quality', 'heicToJpg.seo.features.items.privacy', 'heicToJpg.seo.features.items.fast', 'heicToJpg.seo.features.items.compatible', 'heicToJpg.seo.features.items.free', 'heicToJpg.seo.features.items.noSignup'] },
  { type: 'useCases', titleKey: 'heicToJpg.seo.useCases.title', itemKeys: ['heicToJpg.seo.useCases.items.windows', 'heicToJpg.seo.useCases.items.social', 'heicToJpg.seo.useCases.items.email', 'heicToJpg.seo.useCases.items.editing'] },
  { type: 'faq', titleKey: 'heicToJpg.seo.faq.title', itemKeys: ['heicToJpg.seo.faq.items.whatIsHeic', 'heicToJpg.seo.faq.items.quality', 'heicToJpg.seo.faq.items.metadata', 'heicToJpg.seo.faq.items.batchSize', 'heicToJpg.seo.faq.items.privacy', 'heicToJpg.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('heicToJpg.title'),
  description: () => t('heicToJpg.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="heicToJpg.title"
    subtitle-key="heicToJpg.subtitle"
    prefix="heicToJpg"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="heicToJpg"
        accept-ext=".heic,.heif"
        output-ext="jpg"
        output-mime="image/jpeg"
        api-endpoint="/api/uniimgc/heic"
        :extra-fields="{ source_format: 'heic', target_format: 'jpg' }"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
