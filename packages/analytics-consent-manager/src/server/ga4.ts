export type Ga4MeasurementEventInput = {
  clientId?: string
  userId?: string
  eventName?: string
  params?: Record<string, unknown>
}

export function createGa4MeasurementPayload(
  input: Ga4MeasurementEventInput,
) {
  return {
    client_id: input.clientId ?? '555.555',
    user_id: input.userId,
    events: [
      {
        name: input.eventName ?? 'page_view',
        params: input.params ?? {},
      },
    ],
  }
}

export function createGa4CollectUrl(input: {
  measurementId: string
  apiSecret: string
}): string {
  const url = new URL('https://www.google-analytics.com/mp/collect')
  url.searchParams.set('measurement_id', input.measurementId)
  url.searchParams.set('api_secret', input.apiSecret)
  return url.toString()
}

export async function sendGa4MeasurementEvent(input: {
  measurementId: string
  apiSecret: string
  payload: ReturnType<typeof createGa4MeasurementPayload>
  fetchImpl?: typeof fetch
}) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error('fetch is required to send GA4 measurement events')
  }
  return fetchImpl(
    createGa4CollectUrl({
      measurementId: input.measurementId,
      apiSecret: input.apiSecret,
    }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    },
  )
}
