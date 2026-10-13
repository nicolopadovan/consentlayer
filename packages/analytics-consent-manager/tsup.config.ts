import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ecommerce: 'src/ecommerce.ts',
    'react/index': 'src/react/index.ts',
    'providers/meta': 'src/providers/meta.ts',
    'providers/ga4': 'src/providers/ga4.ts',
    'providers/shopify': 'src/providers/shopify.ts',
    'providers/hotjar': 'src/providers/hotjar.ts',
    'providers/vercel': 'src/providers/vercel.ts',
    'providers/tiktok': 'src/providers/tiktok.ts',
    'server/index': 'src/server/index.ts',
    'ui/index': 'src/ui/index.ts',
  },
  dts: true,
  format: ['esm'],
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  async onSuccess() {
    const target = path.resolve('dist/ui/styles.css')
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(path.resolve('src/ui/styles.css'), target)
  },
})
