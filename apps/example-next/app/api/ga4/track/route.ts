import {
  ANALYTICS_MAX_BODY,
  assertSameOrigin,
  createGa4MeasurementPayload,
  parseJsonWithLimit,
  sendGa4MeasurementEvent,
} from '@nicolopadovan/analytics-consent-manager/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request, { requireHeader: true })
    const body = await parseJsonWithLimit<{
      event_name?: string
      params?: Record<string, unknown>
      client_id?: string
      user_id?: string
    }>(request, ANALYTICS_MAX_BODY)

    const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
    const apiSecret = process.env.GA4_API_SECRET
    if (!measurementId || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: 'Missing GA4 configuration' },
        { status: 500 },
      )
    }

    const response = await sendGa4MeasurementEvent({
      measurementId,
      apiSecret,
      payload: createGa4MeasurementPayload({
        clientId: body.client_id,
        userId: body.user_id,
        eventName: body.event_name,
        params: body.params,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        { ok: false, error: text },
        { status: response.status },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
