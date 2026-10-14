export const metaNoscriptSrc = (pixelId: string) =>
  `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`

const entities: Record<string, string> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }
const escapeAttribute = (value: unknown) => String(value).replace(/[&"<>]/g, (char) => entities[char])

// Browsers with JavaScript parse `<noscript>` content as text, so it hydrates only as an HTML string.
export const metaNoscriptImg = (pixelId: string, attrs: Record<string, unknown>) =>
  `<img ${Object.entries<unknown>({ height: 1, width: 1, style: 'display:none', ...attrs, alt: '', src: metaNoscriptSrc(pixelId) })
    .filter(([name, value]) => /^[\w:-]+$/.test(name) && value != null && value !== false && typeof value !== 'function')
    .map(([name, value]) => (value === true ? name : `${name}="${escapeAttribute(value)}"`))
    .join(' ')}>`
