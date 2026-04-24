<script setup lang="ts">
const { t } = useI18n()

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Free EXIF Remover & Privacy Scanner',
        'description': 'Scan and strip GPS, device, and timestamp metadata from photos. Supports JPEG, PNG, WebP, AVIF, TIFF, HEIC. Batch up to 10 files.',
        'url': 'https://clawstudiouo.com/tools/exif-remover',
        'applicationCategory': 'SecurityApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires a modern web browser',
        'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
        'author': { '@type': 'Organization', 'name': 'ClawStudiouo', 'url': 'https://clawstudiouo.com' }
      })
    }
  ]
})

const seoSections: import('~/types/seo').SeoSection[] = [
  { type: 'text', titleKey: 'exifRemover.seo.whatIs.title', contentKeys: ['exifRemover.seo.whatIs.content', 'exifRemover.seo.whatIs.content2', 'exifRemover.seo.whatIs.content3'] },
  { type: 'text', titleKey: 'exifRemover.seo.whyRemove.title', contentKeys: ['exifRemover.seo.whyRemove.content', 'exifRemover.seo.whyRemove.content2'] },
  { type: 'steps', titleKey: 'exifRemover.seo.howTo.title', stepKeys: ['exifRemover.seo.howTo.step1', 'exifRemover.seo.howTo.step2', 'exifRemover.seo.howTo.step3', 'exifRemover.seo.howTo.step4'] },
  { type: 'features', titleKey: 'exifRemover.seo.features.title', itemKeys: ['exifRemover.seo.features.items.heicLossless', 'exifRemover.seo.features.items.iccPreserved', 'exifRemover.seo.features.items.formatKept', 'exifRemover.seo.features.items.batch', 'exifRemover.seo.features.items.free', 'exifRemover.seo.features.items.privacy'] },
  { type: 'useCases', titleKey: 'exifRemover.seo.useCases.title', itemKeys: ['exifRemover.seo.useCases.items.social', 'exifRemover.seo.useCases.items.marketplace', 'exifRemover.seo.useCases.items.album', 'exifRemover.seo.useCases.items.journalism'] },
  { type: 'faq', titleKey: 'exifRemover.seo.faq.title', itemKeys: ['exifRemover.seo.faq.items.whatIsMetadata', 'exifRemover.seo.faq.items.heicQuality', 'exifRemover.seo.faq.items.colorShift', 'exifRemover.seo.faq.items.mobileSupport', 'exifRemover.seo.faq.items.storage', 'exifRemover.seo.faq.items.batchHowMany'] }
]

useSeoMeta({
  title: () => t('exifRemover.title'),
  description: () => t('exifRemover.subtitle')
})
</script>

<template>
  <ToolPageLayout
    title-key="exifRemover.title"
    subtitle-key="exifRemover.subtitle"
    prefix="exifRemover"
    :seo-sections="seoSections"
    api-url="https://rapidapi.com/lxya98874322688423/api/easy-photo-exif-extraction-removal"
    tutorial-url="https://rapidapi.com/lxya98874322688423/api/easy-photo-exif-extraction-removal/tutorials/how-to-strip-privacy-metadata-in-photos-using-easy-exifrm"
  >
    <template #workspace>
      <ExifCleaner />
    </template>
  </ToolPageLayout>
</template>
