import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data'

type Entry = StarlightRouteData['sidebar'][number]

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  const headings = route.headings
    .filter((heading) => heading.depth === 2)
    .map<Entry>((heading) => ({
      type: 'link',
      label: heading.text,
      href: `#${heading.slug}`,
      isCurrent: false,
      badge: undefined,
      attrs: { class: 'sidebar-heading' },
    }))
  const withHeadings = (entries: Entry[]): Entry[] =>
    entries.flatMap((entry) =>
      entry.type === 'group'
        ? [{ ...entry, entries: withHeadings(entry.entries) }]
        : entry.isCurrent
          ? [entry, ...headings]
          : [entry],
    )
  route.sidebar = withHeadings(route.sidebar)
  route.toc = undefined
})
