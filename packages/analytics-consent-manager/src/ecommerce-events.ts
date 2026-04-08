import { getIdentity, saveIdentity } from './core/identity'
import { trackEvent } from './core/default-runtime'

type MoneyLike = {
  amount: number
  currencyCode: string
}

export interface ProductRef {
  id: string
  variantId?: string
  title?: string
  handle?: string
  price?: MoneyLike
  quantity?: number
  category?: string | null
}

export interface AddToCartPayload extends ProductRef {
  quantity: number
}

export interface PurchaseLine extends ProductRef {
  quantity: number
  price: MoneyLike
}

export interface PurchasePayload {
  orderId: string
  affiliation?: string
  value: number
  currency: string
  tax?: number
  shipping?: number
  coupon?: string | null
  lines: PurchaseLine[]
}

export async function trackViewContent(product: ProductRef): Promise<void> {
  await trackEvent('ViewContent', {
    product_id: product.id,
    variant_id: product.variantId,
    value: product.price?.amount,
    currency: product.price?.currencyCode,
    product_title: product.title,
    handle: product.handle,
    category: product.category,
  })
}

export async function trackAddToCart(item: AddToCartPayload): Promise<void> {
  await trackEvent('AddToCart', {
    product_id: item.id,
    variant_id: item.variantId,
    quantity: item.quantity,
    value: item.price?.amount,
    currency: item.price?.currencyCode,
  })
}

export async function trackAddToWishlist(item: ProductRef): Promise<void> {
  await trackEvent('AddToWishlist', {
    product_id: item.id,
    variant_id: item.variantId,
  })
}

export async function trackInitiateCheckout(
  input:
    | {
        id: string
        totalQuantity: number
        subtotal?: MoneyLike
        lines: Array<{
          merchandise: {
            id: string
            product: { id: string; title: string; handle: string }
            price: MoneyLike
          }
          quantity: number
        }>
      }
    | {
        id: string
        variantId?: string
        title?: string
        handle?: string
        price?: MoneyLike
        quantity?: number
      },
  opts?: { source?: 'mini-cart' | 'cart-page' | 'buy-now' },
): Promise<void> {
  const source = opts?.source
  if ('lines' in input) {
    await trackEvent('InitiateCheckout', {
      cart_id: input.id,
      items: input.totalQuantity,
      value: input.subtotal?.amount,
      currency: input.subtotal?.currencyCode,
      source,
    })
    return
  }
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1
  await trackEvent('InitiateCheckout', {
    product_id: input.id,
    variant_id: input.variantId,
    quantity,
    value: input.price ? input.price.amount * quantity : undefined,
    currency: input.price?.currencyCode,
    source: source ?? 'buy-now',
  })
}

export async function trackAddPaymentInfo(params: {
  value?: number
  currency?: string
}): Promise<void> {
  await trackEvent('AddPaymentInfo', params)
}

export async function trackPurchase(payload: PurchasePayload): Promise<void> {
  await trackEvent('Purchase', {
    order_id: payload.orderId,
    value: payload.value,
    currency: payload.currency,
    tax: payload.tax,
    shipping: payload.shipping,
    coupon: payload.coupon,
    items: payload.lines.length,
    quantity: payload.lines.reduce((sum, line) => sum + line.quantity, 0),
  })
}

export async function trackSubscribe(email?: string): Promise<void> {
  if (email) saveIdentity({ email })
  const identity = getIdentity()
  await trackEvent('Subscribe', {
    email: identity.email ?? email,
    method: 'newsletter',
  })
}

export async function trackLead(
  params: Record<string, unknown>,
): Promise<void> {
  await trackEvent('Lead', params)
}

export async function trackSearch(
  query: string,
  results?: number,
): Promise<void> {
  await trackEvent('Search', { query, results })
}

export async function trackContact(method: string): Promise<void> {
  await trackEvent('Contact', { method })
}

export async function trackCustomizeProduct(
  product: ProductRef,
): Promise<void> {
  await trackEvent('CustomizeProduct', { product_id: product.id })
}
