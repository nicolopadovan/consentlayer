import type { EcommerceItem, StandardEvents } from './core/types'

type MoneyLike = {
  amount: number | string
  currencyCode: string
}

/** A product or cart line, in the shape most storefront APIs return. */
export type ProductRef = {
  id: string
  variantId?: string
  title?: string
  vendor?: string
  category?: string | null
  price?: MoneyLike
  quantity?: number
}

/** A cart: its lines and optional subtotal. */
export type CartRef = {
  subtotal?: MoneyLike
  lines: ProductRef[]
}

/** A completed order. */
export type OrderRef = {
  orderId: string
  value: number
  currency: string
  tax?: number
  shipping?: number
  coupon?: string | null
  lines: ProductRef[]
}

/** Converts a product to a GA4-style item. */
export function toItem(product: ProductRef): EcommerceItem {
  return {
    item_id: product.id,
    item_name: product.title,
    item_variant: product.variantId,
    item_brand: product.vendor,
    item_category: product.category ?? undefined,
    price: product.price ? Number(product.price.amount) : undefined,
    quantity: product.quantity ?? 1,
  }
}

/** Params for `view_item`, `add_to_cart`, `remove_from_cart`, `add_to_wishlist`. */
export function productParams(product: ProductRef): StandardEvents['view_item'] {
  const item = toItem(product)
  return {
    value: item.price === undefined ? undefined : item.price * (item.quantity ?? 1),
    currency: product.price?.currencyCode,
    items: [item],
  }
}

/** Params for `begin_checkout`, `add_payment_info`, `add_shipping_info`. */
export function cartParams(cart: CartRef): StandardEvents['begin_checkout'] {
  const items = cart.lines.map(toItem)
  return {
    value: cart.subtotal
      ? Number(cart.subtotal.amount)
      : items.reduce((sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1), 0),
    currency: cart.subtotal?.currencyCode ?? cart.lines[0]?.price?.currencyCode,
    items,
  }
}

/** Params for `purchase`. */
export function orderParams(order: OrderRef): StandardEvents['purchase'] {
  return {
    transaction_id: order.orderId,
    value: order.value,
    currency: order.currency,
    tax: order.tax,
    shipping: order.shipping,
    coupon: order.coupon ?? undefined,
    items: order.lines.map(toItem),
  }
}
