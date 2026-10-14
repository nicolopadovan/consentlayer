export const metaNoscriptSrc = (pixelId: string) =>
  `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`

export const gtmNoscriptSrc = (containerId: string) =>
  `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(containerId)}`

const entities: Record<string, string> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }
const escapeAttribute = (value: unknown) => String(value).replace(/[&"<>]/g, (char) => entities[char])

const attributes = (attrs: Record<string, unknown>) =>
  Object.entries(attrs)
    .filter(
      ([name, value]) => /^[\w:-]+$/.test(name) && value != null && value !== false && typeof value !== 'function',
    )
    .map(([name, value]) => (value === true ? name : `${name}="${escapeAttribute(value)}"`))
    .join(' ')

// Browsers with JavaScript parse `<noscript>` content as text, so it hydrates only as an HTML string.
export const metaNoscriptImg = (pixelId: string, attrs: Record<string, unknown>) =>
  `<img ${attributes({ height: 1, width: 1, style: 'display:none', ...attrs, alt: '', src: metaNoscriptSrc(pixelId) })}>`

export const gtmNoscriptIframe = (containerId: string, attrs: Record<string, unknown>) =>
  `<iframe ${attributes({ title: 'Google Tag Manager', height: 0, width: 0, style: 'display:none;visibility:hidden', ...attrs, src: gtmNoscriptSrc(containerId) })}></iframe>`
