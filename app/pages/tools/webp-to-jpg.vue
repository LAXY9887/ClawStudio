<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free Online WebP to JPG Converter',
        'description': 'Convert WebP images to JPG for broad compatibility with legacy tools, email clients, and print pipelines.',
        'url': 'https://clawstudiouo.com/tools/webp-to-jpg',
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
  { type: 'text', titleKey: 'webpToJpg.seo.whatIs.title', contentKeys: ['webpToJpg.seo.whatIs.content', 'webpToJpg.seo.whatIs.content2', 'webpToJpg.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'webpToJpg.seo.whyConvert.title', contentKeys: ['webpToJpg.seo.whyConvert.content', 'webpToJpg.seo.whyConvert.content2'] },
  { type: 'steps', titleKey: 'webpToJpg.seo.howTo.title', stepKeys: ['webpToJpg.seo.howTo.step1', 'webpToJpg.seo.howTo.step2', 'webpToJpg.seo.howTo.step3', 'webpToJpg.seo.howTo.step4'] },
  { type: 'features', titleKey: 'webpToJpg.seo.features.title', itemKeys: ['webpToJpg.seo.features.items.quality', 'webpToJpg.seo.features.items.compatibility', 'webpToJpg.seo.features.items.smaller', 'webpToJpg.seo.features.items.privacy', 'webpToJpg.seo.features.items.fast', 'webpToJpg.seo.features.items.free'] },
  { type: 'useCases', titleKey: 'webpToJpg.seo.useCases.title', itemKeys: ['webpToJpg.seo.useCases.items.email', 'webpToJpg.seo.useCases.items.legacy', 'webpToJpg.seo.useCases.items.printing', 'webpToJpg.seo.useCases.items.social'] },
  { type: 'faq', titleKey: 'webpToJpg.seo.faq.title', itemKeys: ['webpToJpg.seo.faq.items.whyConvert', 'webpToJpg.seo.faq.items.transparency', 'webpToJpg.seo.faq.items.quality', 'webpToJpg.seo.faq.items.fileSize', 'webpToJpg.seo.faq.items.privacy', 'webpToJpg.seo.faq.items.free'] }
]

useSeoMeta({
  title: () => t('webpToJpg.title'),
  description: () => t('webpToJpg.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="webpToJpg.title"
    subtitle-key="webpToJpg.subtitle"
    prefix="webpToJpg"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-heic-image-converter/tutorials/how-to-use-easy-universal-img-processor"
  >
    <template #workspace>
      <FormatConverter
        tool-key="webpToJpg"
        accept-ext=".webp"
        output-ext="jpg"
        output-mime="image/jpeg"
        api-endpoint="/api/uniimgc/webp"
        :extra-fields="{ target_format: 'jpg' }"
        :supports-quality="true"
        :default-quality="90"
        icon="i-lucide-image"
      />
    </template>
  </ToolPageLayout>
</template>
