<script setup lang="ts">
import type { SeoSection } from '~/types/seo'

const { t } = useI18n()

const props = defineProps<{
  prefix: string
  sections: SeoSection[]
  apiHighlightKeys?: string[]
}>()

// API promo is shared across all tools
const apiFeatureKeys = props.apiHighlightKeys || ['endpoints', 'input', 'params', 'limit', 'formats', 'response']
</script>

<template>
  <USeparator class="my-4" />

  <UPageSection>
    <div class="max-w-3xl mx-auto space-y-12">
      <!-- API Promotion (shared) -->
      <section>
        <h2 class="text-2xl font-bold mb-4">
          {{ t(`${prefix}.seo.api.title`) }}
        </h2>
        <p class="text-muted leading-relaxed mb-3">
          {{ t(`${prefix}.seo.api.content`) }}
        </p>
        <p class="text-muted leading-relaxed mb-6">
          {{ t(`${prefix}.seo.api.content2`) }}
        </p>

        <div class="border border-muted rounded-lg p-5 mb-6">
          <h3 class="font-semibold mb-3">
            {{ t(`${prefix}.seo.api.features.title`) }}
          </h3>
          <ul class="space-y-2 text-sm text-muted">
            <li v-for="key in apiFeatureKeys" :key="key" class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="text-primary shrink-0 mt-0.5" />
              <span>{{ t(`${prefix}.seo.api.features.${key}`) }}</span>
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton
            :label="t(`${prefix}.seo.api.cta`)"
            icon="i-lucide-external-link"
            to="https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites"
            target="_blank"
            size="lg"
          />
          <UButton
            :label="t(`${prefix}.seo.api.tutorial`)"
            icon="i-lucide-book-open"
            to="https://rapidapi.com/lxya98874322688423/api/easy-gif-to-sprites/tutorials/how-to-use-easy-gif-to-sprites"
            target="_blank"
            color="neutral"
            variant="outline"
            size="lg"
          />
        </div>
      </section>

      <!-- Dynamic Sections -->
      <template v-for="(section, idx) in sections" :key="idx">
        <!-- Ad before section -->
        <AdUnit v-if="section.adSlot" :ad-slot="section.adSlot" format="fluid" layout="in-article" />

        <!-- Text Section -->
        <section v-if="section.type === 'text'">
          <h2 class="text-2xl font-bold mb-4">
            {{ t(section.titleKey) }}
          </h2>
          <p v-for="key in section.contentKeys" :key="key" class="text-muted leading-relaxed mb-3">
            {{ t(key) }}
          </p>
        </section>

        <!-- Steps Section -->
        <section v-else-if="section.type === 'steps'">
          <h2 class="text-2xl font-bold mb-6">
            {{ t(section.titleKey) }}
          </h2>
          <div class="space-y-6">
            <div v-for="step in section.stepKeys" :key="step">
              <h3 class="text-lg font-semibold mb-2">
                {{ t(`${step}.title`) }}
              </h3>
              <p class="text-muted leading-relaxed">
                {{ t(`${step}.content`) }}
              </p>
            </div>
          </div>
        </section>

        <!-- Features Grid -->
        <section v-else-if="section.type === 'features'">
          <h2 class="text-2xl font-bold mb-6">
            {{ t(section.titleKey) }}
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="key in section.itemKeys"
              :key="key"
              class="border border-muted rounded-lg p-5"
            >
              <h3 class="font-semibold mb-2">
                {{ t(`${key}.title`) }}
              </h3>
              <p class="text-sm text-muted leading-relaxed">
                {{ t(`${key}.content`) }}
              </p>
            </div>
          </div>
        </section>

        <!-- Use Cases -->
        <section v-else-if="section.type === 'useCases'">
          <h2 class="text-2xl font-bold mb-6">
            {{ t(section.titleKey) }}
          </h2>
          <div class="space-y-6">
            <div v-for="key in section.itemKeys" :key="key">
              <h3 class="text-lg font-semibold mb-2">
                {{ t(`${key}.title`) }}
              </h3>
              <p class="text-muted leading-relaxed">
                {{ t(`${key}.content`) }}
              </p>
            </div>
          </div>
        </section>

        <!-- FAQ -->
        <section v-else-if="section.type === 'faq'">
          <h2 class="text-2xl font-bold mb-6">
            {{ t(section.titleKey) }}
          </h2>
          <UAccordion
            :items="(section.itemKeys || []).map(key => ({
              label: t(`${key}.q`),
              value: key,
              content: t(`${key}.a`)
            }))"
          />
        </section>
      </template>
    </div>
  </UPageSection>
</template>
