import { tanstackRouter } from '@tanstack/router-plugin/rspack'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import tailwindcss from '@tailwindcss/postcss'
import { fileURLToPath } from 'node:url'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))
const managementProxyTarget =
  process.env.MANAGEMENT_DEV_PROXY_TARGET?.trim() || 'http://127.0.0.1:8327'

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    proxy: {
      '/v0/management': {
        target: managementProxyTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  html: {
    favicon: './src/assets/brand/favicon.png',
    template: './index.html',
  },
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: true,
          routesDirectory: './src/routes',
          generatedRouteTree: './src/routeTree.gen.ts',
          quoteStyle: 'single',
        }),
      ],
    },
    postcss: {
      postcssOptions: {
        plugins: [tailwindcss()],
      },
    },
  },
})
