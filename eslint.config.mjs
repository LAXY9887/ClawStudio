// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/html-indent': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/no-multiple-template-root': 'off',
    'vue/attributes-order': 'off',
    'nuxt/nuxt-config-keys-order': 'off'
  }
})
