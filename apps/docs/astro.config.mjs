// @ts-check
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://consentlayer.vercel.app',
  integrations: [
    react(),
    starlight({
      title: 'consentlayer',
      disable404Route: true,
      description: 'Consent-first analytics for React, Next.js and the server.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/nicolopadovan/analytics-consent-manager-npm' },
      ],
      editLink: {
        baseUrl: 'https://github.com/nicolopadovan/analytics-consent-manager-npm/edit/main/apps/docs/',
      },
      sidebar: [
        { label: 'Start', items: ['index', 'start/installation', 'start/nextjs', 'playground'] },
        {
          label: 'Guides',
          items: [
            'guides/events',
            'guides/consent-ui',
            'guides/providers',
            'guides/server-side-tracking',
            'guides/names',
            'guides/migrating-to-v1',
            'guides/troubleshooting',
          ],
        },
        { label: 'How it works', items: [{ autogenerate: { directory: 'internals' } }] },
      ],
    }),
  ],
})
