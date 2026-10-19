import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/shop')({
  validateSearch: (search): { page: number } => ({ page: Number(search.page) || 1 }),
  head: ({ match }) => ({ meta: [{ title: `Shop, page ${match.search.page} | ConsentLayer with TanStack Start` }] }),
  component: Shop,
})

function Shop() {
  const { page } = Route.useSearch()

  return (
    <section>
      <h1>Shop, page {page}</h1>
      <Link to="/shop" search={{ page: page + 1 }}>
        Next page
      </Link>
    </section>
  )
}
