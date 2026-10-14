export const ANALYTICS_MAX_BODY = 16 * 1024

export async function sha256(input: string | null | undefined): Promise<string | undefined> {
  if (!input) return undefined
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function assertSameOrigin(request: Request, options?: { requireHeader?: boolean }): void {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  let headerOrigin = origin
  if (!headerOrigin && referer) {
    try {
      headerOrigin = new URL(referer).origin
    } catch {
      throw Object.assign(new Error('Forbidden: malformed referer'), { status: 403 })
    }
  }

  if (options?.requireHeader && !headerOrigin) {
    throw Object.assign(new Error('Forbidden: missing origin header'), {
      status: 403,
    })
  }

  if (headerOrigin && headerOrigin !== requestUrl.origin) {
    throw Object.assign(new Error('Forbidden: cross-origin request'), {
      status: 403,
    })
  }
}

export async function parseJsonWithLimit<T = unknown>(request: Request, maxBytes = 10 * 1024): Promise<T> {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('Unsupported Media Type'), { status: 415 })
  }
  const reader = request.body?.getReader()
  if (!reader) throw Object.assign(new Error('Empty body'), { status: 400 })
  let received = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    received += value.byteLength
    if (received > maxBytes) {
      throw Object.assign(new Error('Payload Too Large'), { status: 413 })
    }
    chunks.push(value)
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(concatUint8Arrays(chunks))
  try {
    return JSON.parse(text) as T
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 })
  }
}

export function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, chunk) => {
      const [key, ...rest] = chunk.split('=')
      accumulator[key] = rest.join('=')
      return accumulator
    }, {})
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}
