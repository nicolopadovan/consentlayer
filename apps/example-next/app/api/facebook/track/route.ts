import {
  ANALYTICS_MAX_BODY,
  assertSameOrigin,
  createMetaEventPayload,
  parseJsonWithLimit,
  sendMetaCapiEvent,
} from '@your-scope/analytics-consent-manager/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request, { requireHeader: true })
    const body = await parseJsonWithLimit<{
      event_name?: string
      event_id?: string
      event_source_url?: string
      value?: number
      currency?: string
      custom_data?: Record<string, unknown>
      user?: {
        email?: string
        phone?: string
        external_id?: string
        fbc?: string
        fbp?: string
      }
    }>(request, ANALYTICS_MAX_BODY)

    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID
    const accessToken = process.env.META_TOKEN
    if (!pixelId || !accessToken) {
      return NextResponse.json(
        { ok: false, error: 'Missing Meta configuration' },
        { status: 500 },
      )
    }

    const payload = createMetaEventPayload({
      eventName: body.event_name,
      eventId: body.event_id,
      eventSourceUrl: body.event_source_url,
      value: body.value,
      currency: body.currency,
      customData: body.custom_data,
      user: body.user,
      cookieHeader: request.headers.get('cookie') ?? '',
      clientIpAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      clientUserAgent: request.headers.get('user-agent') ?? undefined,
    })

    const response = await sendMetaCapiEvent({
      pixelId,
      accessToken,
      testEventCode: process.env.FACEBOOK_TEST_EVENT_CODE,
      payload,
    })

    const json: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: json },
        { status: response.status },
      )
    }

    return NextResponse.json({ ok: true, meta: json })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    )
  }
}
