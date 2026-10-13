import type { AnalyticsEventPayload, EcommerceItem, UserIdentity } from './types'

const META_EVENT_NAMES: Record<string, string> = {
  page_view: 'PageView',
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
  donate: 'Donate',
}
const META_STANDARD = new Set([...Object.values(META_EVENT_NAMES), 'PageView'])

/** Translates a standard event into a Meta standard event, or a custom one. */
export function toMetaEvent(event: AnalyticsEventPayload): {
  method: 'track' | 'trackCustom'
  name: string
  params: Record<string, unknown>
} {
  const standard =
    META_EVENT_NAMES[event.name] ?? (META_STANDARD.has(event.name) ? event.name : undefined)
  const { items, search_term, ...rest } = event.params as {
    items?: EcommerceItem[]
    search_term?: string
  } & Record<string, unknown>
  const params: Record<string, unknown> = { ...rest }
  if (Array.isArray(items) && items.length) {
    const id = (item: EcommerceItem) => item.item_variant ?? item.item_id
    params.content_ids = items.map(id)
    params.contents = items.map((item) => ({
      id: id(item),
      quantity: item.quantity ?? 1,
      item_price: item.price,
    }))
    params.content_type = 'product'
    params.num_items = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
  }
  if (search_term !== undefined) params.search_string = search_term
  return {
    method: standard ? 'track' : 'trackCustom',
    name: standard ?? event.name,
    params: { ...params, ...event.options.providers?.meta },
  }
}

/** Advanced matching; Meta accepts it only in `fbq('init')`. */
export function metaUserData(identity: UserIdentity): Record<string, string> {
  const data: Record<string, string> = {}
  if (identity.email) data.em = identity.email
  if (identity.phone) data.ph = identity.phone.replace(/\D/g, '')
  if (identity.userId) data.external_id = identity.userId
  return data
}
