import { tanstackRouter } from '@tanstack/router-plugin/rspack'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import tailwindcss from '@tailwindcss/postcss'
import { fileURLToPath } from 'node:url'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [pluginReact()],
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
