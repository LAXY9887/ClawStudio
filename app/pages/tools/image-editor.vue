<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'Free Online Image Editor — Crop, Resize & Compress',
      'url': 'https://clawstudiouo.com/tools/image-editor',
      'applicationCategory': 'MultimediaApplication',
      'operatingSystem': 'Any',
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
      'featureList': ['Crop image', 'Resize image', 'Compress image', 'Rotate image', 'Flip image', 'No upload required']
    })
  }]
})

const seoSections: import('~/types/seo').SeoSection[] = [
  {
    type: 'text',
    titleKey: 'imageEditor.seo.whatIs.title',
    contentKeys: ['imageEditor.seo.whatIs.content', 'imageEditor.seo.whatIs.content2']
  },
  {
    type: 'steps',
    titleKey: 'imageEditor.seo.howTo.title',
    stepKeys: [
      'imageEditor.seo.howTo.step1',
      'imageEditor.seo.howTo.step2',
      'imageEditor.seo.howTo.step3',
      'imageEditor.seo.howTo.step4'
    ]
  },
  {
    type: 'features',
    titleKey: 'imageEditor.seo.features.title',
    itemKeys: [
      'imageEditor.seo.features.items.crop',
      'imageEditor.seo.features.items.resize',
      'imageEditor.seo.features.items.compress',
      'imageEditor.seo.features.items.rotate',
      'imageEditor.seo.features.items.privacy',
      'imageEditor.seo.features.items.format'
    ]
  },
  {
    type: 'useCases',
    titleKey: 'imageEditor.seo.useCases.title',
    itemKeys: [
      'imageEditor.seo.useCases.items.social',
      'imageEditor.seo.useCases.items.email',
      'imageEditor.seo.useCases.items.web',
      'imageEditor.seo.useCases.items.screenshot'
    ]
  },
  {
    type: 'faq',
    titleKey: 'imageEditor.seo.faq.title',
    itemKeys: [
      'imageEditor.seo.faq.items.privacy',
      'imageEditor.seo.faq.items.formats',
      'imageEditor.seo.faq.items.pngCompress',
      'imageEditor.seo.faq.items.quality'
    ]
  }
]

useSeoMeta({
  title: () => t('imageEditor.title'),
  description: () => t('imageEditor.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="imageEditor.title"
    subtitle-key="imageEditor.subtitle"
    prefix="imageEditor"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
  >
    <template #workspace>
      <ImageEditor />
    </template>
  </ToolPageLayout>
</template>
