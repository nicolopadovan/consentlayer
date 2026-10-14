// @ts-check
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://consentlayer.vercel.app',
  redirects: { '/start/sveltekit': '/start/svelte/', '/start/solidstart': '/start/solid/' },
  integrations: [
    react(),
    starlight({
      title: 'ConsentLayer',
      disable404Route: true,
      description: 'Consent-first analytics for React, Next.js and the server.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/nicolopadovan/analytics-consent-manager-npm' },
      ],
      editLink: {
        baseUrl: 'https://github.com/nicolopadovan/analytics-consent-manager-npm/edit/main/apps/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Getting started', items: [{ label: 'Introduction', link: '/' }, 'start/installation', 'start/react', 'start/nextjs', 'start/vue', 'start/nuxt', 'start/svelte', 'start/solid', 'start/angular', 'start/javascript', 'playground'] },
        {
          label: 'Guides',
          items: [
            'guides/events',
            'guides/consent-ui',
            {
              label: 'Providers',
              collapsed: true,
              items: [
                { label: 'Overview', slug: 'guides/providers' },
                'guides/providers/ga4',
                'guides/providers/meta',
                'guides/providers/tiktok',
                'guides/providers/posthog',
                'guides/providers/sentry',
                'guides/providers/contentsquare',
                'guides/providers/vercel',
                'guides/providers/shopify',
                'guides/providers/hotjar',
              ],
            },
            'guides/server-side-tracking',
            'guides/consent-records',
            'guides/names',
          ],
        },
        { label: 'API reference', items: ['reference/api'] },
        { label: 'How it works', items: [{ autogenerate: { directory: 'internals' } }] },
        { label: 'Help', items: ['guides/migrating-to-v1', 'guides/troubleshooting', 'guides/roadmap', 'guides/changelog'] },
      ],
    }),
  ],
})
