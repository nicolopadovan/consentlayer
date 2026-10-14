import type { AnalyticsEventPayload, EcommerceItem, UserIdentity } from './types'

const TIKTOK_EVENT_NAMES: Record<string, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  add_to_wishlist: 'AddToWishlist',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  sign_up: 'CompleteRegistration',
  lead: 'Lead',
  search: 'Search',
  contact: 'Contact',
  trial_started: 'StartTrial',
  subscription_started: 'Subscribe',
  customize_product: 'CustomizeProduct',
  schedule: 'Schedule',
  submit_application: 'SubmitApplication',
  find_location: 'FindLocation',
}

/** Translates a standard event into a TikTok standard event, or a custom one under its own name. */
export function toTikTokEvent(event: AnalyticsEventPayload): { name: string; params: Record<string, unknown> } {
  const { items, search_term, transaction_id, ...rest } = event.params as {
    items?: EcommerceItem[]
    search_term?: string
    transaction_id?: string
  } & Record<string, unknown>
  const params: Record<string, unknown> = { ...rest }
  if (Array.isArray(items) && items.length) {
    const id = (item: EcommerceItem) => item.item_variant ?? item.item_id
    params.content_ids = items.map(id)
    params.contents = items.map((item) => ({
      content_id: id(item),
      content_name: item.item_name,
      content_category: item.item_category,
      brand: item.item_brand,
      price: item.price,
      quantity: item.quantity ?? 1,
    }))
    params.content_type = 'product'
    params.num_items = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
  }
  if (search_term !== undefined) params.search_string = search_term
  if (transaction_id !== undefined) params.order_id = transaction_id
  return {
    name: TIKTOK_EVENT_NAMES[event.name] ?? event.name,
    params: { ...params, ...event.options.providers?.tiktok },
  }
}

/** Advanced matching for `ttq.identify`; the pixel hashes the values itself. */
export function tiktokUserData(identity: UserIdentity): Record<string, string> {
  const data: Record<string, string> = {}
  if (identity.email) data.email = identity.email.trim().toLowerCase()
  if (identity.phone) data.phone_number = `+${identity.phone.replace(/\D/g, '')}`
  if (identity.userId) data.external_id = identity.userId
  return data
}
