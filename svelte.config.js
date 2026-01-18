import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    cssHash: ({ hash, css }) => `god-${hash(css)}`
  },
  vitePlugin: {
    inspector: {
      toggleKeyCombo: 'meta-shift',
      holdMode: true,
      showToggleButton: 'always',
      toggleButtonPos: 'bottom-right',
    }
  }
}
