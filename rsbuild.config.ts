import { tanstackRouter } from '@tanstack/router-plugin/rspack'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import tailwindcss from '@tailwindcss/postcss'
import type { IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))
const managementProxyTarget =
  process.env.MANAGEMENT_DEV_PROXY_TARGET?.trim() || 'http://127.0.0.1:8327'

function isHtmlNavigationRequest(req: IncomingMessage) {
  return req.method === 'GET' && String(req.headers.accept ?? '').includes('text/html')
}

export default defineConfig(({ command }) => {
  const isDev = command === 'dev'

  return {
    plugins: [pluginReact()],
    server: {
      publicDir: false,
      proxy: {
        '/v0/management': {
          target: managementProxyTarget,
          changeOrigin: true,
        },
        '/user': {
          target: managementProxyTarget,
          changeOrigin: true,
          bypass: (req) => (isHtmlNavigationRequest(req) ? true : undefined),
        },
      },
    },
    dev: {
      lazyCompilation: false,
    },
    resolve: {
      alias: {
        '@': srcPath,
      },
    },
    output: {
      assetPrefix: './',
      distPath: {
        js: 'assets/js',
        jsAsync: 'assets/js',
        css: 'assets/css',
        cssAsync: 'assets/css',
        svg: 'assets/svg',
        font: 'assets/font',
        image: 'assets/image',
        media: 'assets/media',
        assets: 'assets',
      },
      filenameHash: true,
      inlineScripts: false,
      inlineStyles: false,
      legalComments: 'none',
      sourceMap: false,
    },
    splitChunks: isDev
      ? false
      : {
          preset: 'single-vendor',
        },
    source: {
      entry: {
        index: './src/entries/bridge.tsx',
        management: './src/entries/management.tsx',
        user: './src/entries/user.tsx',
      },
    },
    html: {
      template: './index.html',
      title({ entryName }) {
        if (entryName === 'management') return 'Home Center Management'
        if (entryName === 'user') return 'Home Center User'
        return 'Home Center'
      },
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            autoCodeSplitting: false,
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
  }
})
