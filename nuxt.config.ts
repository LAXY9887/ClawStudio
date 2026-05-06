// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    'nuxt-gtag'
  ],

  gtag: {
    id: 'G-RZH9MFRD9W'
  },

  site: {
    url: 'https://clawstudiouo.com'
  },

  runtimeConfig: {
    gifServiceUrl: '',
    png2ssServiceUrl: '',
    uniimgcServiceUrl: '',
    exifrmServiceUrl: '',
    internalKey: '',
    public: {
      adsenseEnabled: false,
      adsenseClient: 'ca-pub-6385934484512467'
    }
  },

  i18n: {
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'zh-TW', language: 'zh-Hant-TW', name: '繁體中文', file: 'zh-TW.json' },
      { code: 'zh-CN', language: 'zh-Hans-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'ja', language: 'ja', name: '日本語', file: 'ja.json' },
      { code: 'ko', language: 'ko', name: '한국어', file: 'ko.json' },
      { code: 'de', language: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'es', language: 'es', name: 'Español', file: 'es.json' },
      { code: 'pt', language: 'pt', name: 'Português', file: 'pt.json' },
      { code: 'ru', language: 'ru', name: 'Русский', file: 'ru.json' }
    ],
    defaultLocale: 'en',
    langDir: '../i18n/locales',
    strategy: 'prefix_except_default',
    baseUrl: 'https://clawstudiouo.com'
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

  sitemap: {
    exclude: ['/download', '/*/download']
  },

  vite: {
    build: {
      sourcemap: false
    }
  },

  nitro: {
    minify: false
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
