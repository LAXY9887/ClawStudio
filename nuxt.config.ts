// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap'
  ],

  site: {
    url: 'https://clawstudiouo.com'
  },

  runtimeConfig: {
    gifServiceUrl: '',
    png2ssServiceUrl: '',
    internalKey: '',
    public: {
      // 'adsense' | 'monetag' | 'none'
      adProvider: 'monetag',
      adsenseClient: 'ca-pub-6385934484512467',
      // Monetag: Multitag (all-in-one)
      monetagMultitagSrc: 'https://quge5.com/88/tag.min.js',
      monetagMultitagZone: '228851',
      // Monetag: Push Notifications（zone 內嵌於 URL 的 ?z= 參數）
      monetagPushSrc: 'https://5gvci.com/act/files/tag.min.js?z=10864789',
      monetagPushZone: '',
      // Monetag: Push Notifications Service Worker 設定
      // 由 /sw.js 動態 server route 讀取，空值會自動改送「自我註銷」墓碑 SW
      monetagPushSwDomain: '3nbf4.com',
      monetagPushSwZoneId: '10864789',
      // Monetag: In-Page Push（native-style 浮動 banner）
      monetagInpagePushSrc: 'https://nap5k.com/tag.min.js',
      monetagInpagePushZone: '10864907',
      // Monetag: Vignette Banner（插頁式強制顯示，侵略性較高）
      monetagVignetteSrc: 'https://n6wxm.com/vignette.min.js',
      monetagVignetteZone: '10864918',
      // Monetag: Direct Link（等待室下載按鈕並行開啟）
      monetagDirectLink: 'https://omg10.com/4/10864766',
      // Monetag: Direct Link 備用（目前未使用，保留給未來版位）
      monetagDirectLinkAlt: 'https://omg10.com/4/10864781'
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
    exclude: ['/download']
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
