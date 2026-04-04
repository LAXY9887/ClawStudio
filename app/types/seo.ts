export interface SeoSection {
  type: 'text' | 'steps' | 'features' | 'useCases' | 'faq'
  titleKey: string
  contentKeys?: string[]
  stepKeys?: string[]
  itemKeys?: string[]
  adSlot?: string
}
