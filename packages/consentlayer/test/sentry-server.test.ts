import { describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }))
vi.mock('@sentry/nextjs', () => sdk)

const { sentryInstrumentation } = await import('../src/sentry/server')

describe('sentryInstrumentation', () => {
  it('starts Sentry without personal data, and not at all without a DSN', () => {
    sentryInstrumentation({ dsn: undefined }).register()
    expect(sdk.init).not.toHaveBeenCalled()

    const { register, onRequestError } = sentryInstrumentation({ dsn: 'https://k@o1.ingest.sentry.io/1' })
    register()
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dataCollection: expect.objectContaining({ userInfo: false, cookies: false, httpHeaders: false }) as unknown,
      }),
    )
    expect(onRequestError).toBe(sdk.captureRequestError)
  })
})
