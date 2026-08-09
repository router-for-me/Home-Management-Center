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
      // Home serves the embedded panel at the root; absolute asset paths stay
      // correct regardless of the depth of the referencing stylesheet.
      assetPrefix: '/',
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
      // The embedded backend only serves /assets/* besides the HTML entries,
      // so the favicon must live under assets/ instead of the dist root.
      copy: [{ from: './src/assets/brand/favicon.png', to: 'assets/image' }],
    },
    splitChunks: isDev
      ? false
      : {
          // Not `single-vendor`: folding every dependency into one chunk made
          // all three entries load the union of what any of them needed, and
          // the panel ships inside a versioned backend release, so the
          // cross-build cache reuse that preset optimises for never pays off.
          // Letting Rspack split by usage costs ~190 KB more on disk and saves
          // 47-106 KB gzipped on every entry.
          preset: 'default',
          // Charting and YAML are only reachable from lazy routes, but a
          // node_modules group with `chunks: 'all'` would still hoist them into
          // an initial chunk. Pinning them to async keeps them out of the
          // entries: charts serve the dashboard and observability workbenches,
          // YAML only the config workbench.
          cacheGroups: {
            charts: {
              test: /[\\/]node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+|decimal\.js-light)[\\/]/,
              name: 'charts',
              chunks: 'async',
              priority: 20,
              reuseExistingChunk: true,
            },
            yaml: {
              test: /[\\/]node_modules[\\/]yaml[\\/]/,
              name: 'yaml',
              chunks: 'async',
              priority: 20,
              reuseExistingChunk: true,
            },
          },
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
