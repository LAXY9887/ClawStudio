// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/html-indent': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/no-multiple-template-root': 'off',
    'vue/attributes-order': 'off',
    'nuxt/nuxt-config-keys-order': 'off',
    'vue/first-attribute-linebreak': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-empty': 'off',
    'vue/no-v-html': 'off'
  }
})
