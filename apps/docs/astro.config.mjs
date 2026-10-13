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
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Start', items: ['start/installation', 'start/nextjs', 'playground'] },
        {
          label: 'Guides',
          items: [
            'guides/events',
            'guides/consent-ui',
            'guides/providers',
            'guides/server-side-tracking',
            'guides/consent-records',
            'guides/names',
          ],
        },
        { label: 'Reference', items: ['reference/api'] },
        { label: 'How it works', items: [{ autogenerate: { directory: 'internals' } }] },
        { label: 'Help', items: ['guides/migrating-to-v1', 'guides/troubleshooting'] },
      ],
    }),
  ],
})
